import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Student } from "@/models/Student";
import { Parent, type IParent } from "@/models/Parent";
import { Class } from "@/models/Class";
import { generatePassword, hashPassword } from "@/lib/helpers";
import { sendCredentialsMail } from "@/lib/mail";
import { parseWorkbookRows } from "@/lib/excelImport";
import { STUDENT_KEYS } from "@/lib/bulkImportFields";

const MAX_ROWS = 500;
const MAX_FILE_BYTES = 5 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function requireSchoolAdmin(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") return null;
  return auth;
}

function tenDigitPhone(raw: string): string | null {
  const digits = raw.replace(/\D/g, "");
  return digits.length === 10 ? digits : null;
}

function parseDate(raw: string): Date | null {
  if (!raw) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

interface RowResult {
  row: number;
  name: string;
  status: "created" | "failed";
  message?: string;
  studentId?: string;
}

export async function POST(req: Request) {
  const auth = requireSchoolAdmin(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: "No file uploaded." }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ success: false, message: "File is too large — must be under 5 MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rawRows = await parseWorkbookRows(buffer);
    if (rawRows.length === 0) {
      return NextResponse.json({ success: false, message: "No data rows found in the uploaded file." }, { status: 400 });
    }
    if (rawRows.length > MAX_ROWS) {
      return NextResponse.json(
        { success: false, message: `Too many rows — upload at most ${MAX_ROWS} students at a time.` },
        { status: 400 },
      );
    }

    await connectDB();

    const [existingClasses, existingStudents, existingParents, studentCount] = await Promise.all([
      Class.find({ school: auth.schoolId }).select("name section"),
      Student.find({ school: auth.schoolId, isActive: true }).select("class section rollNumber"),
      Parent.find({ school: auth.schoolId }).select("email students"),
      Student.countDocuments({ school: auth.schoolId }),
    ]);

    const classesByName = new Map<string, string[]>();
    const classKeySet = new Set<string>();
    for (const c of existingClasses) {
      classKeySet.add(`${c.name}::${c.section}`);
      classesByName.set(c.name, [...(classesByName.get(c.name) || []), c.section]);
    }

    const usedRollKeys = new Set(existingStudents.map((s) => `${s.class}::${s.section}::${s.rollNumber}`));
    const parentsByEmail = new Map<string, IParent>(existingParents.map((p) => [p.email.toLowerCase(), p]));

    let admissionSeq = studentCount;
    const year = new Date().getFullYear();

    const results: RowResult[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const excelRow = i + 2;
      const row = rawRows[i];
      const name = (row[STUDENT_KEYS.name] || "").trim();

      const fail = (message: string) => results.push({ row: excelRow, name: name || "(no name)", status: "failed", message });

      if (!name) { fail("Student name is required."); continue; }

      const studentClass = (row[STUDENT_KEYS.studentClass] || "").trim();
      let section = (row[STUDENT_KEYS.section] || "").trim().toUpperCase();
      if (!studentClass) { fail("Class is required."); continue; }
      if (!classesByName.has(studentClass)) { fail(`Class "${studentClass}" was not found — create it first under Classes.`); continue; }
      if (!section) {
        const sections = classesByName.get(studentClass) || [];
        if (sections.length === 1) section = sections[0];
        else { fail(`Class "${studentClass}" has multiple sections — specify one in the Section column.`); continue; }
      }
      if (!classKeySet.has(`${studentClass}::${section}`)) { fail(`Class "${studentClass}-${section}" was not found — create it first under Classes.`); continue; }

      const rollNumber = (row[STUDENT_KEYS.rollNumber] || "").trim();
      if (!rollNumber) { fail("Roll number is required."); continue; }
      const rollKey = `${studentClass}::${section}::${rollNumber}`;
      if (usedRollKeys.has(rollKey)) { fail(`Roll number "${rollNumber}" is already used in class ${studentClass}-${section}.`); continue; }

      const dobRaw = (row[STUDENT_KEYS.dateOfBirth] || "").trim();
      if (!dobRaw) { fail("Date of birth is required."); continue; }
      const dateOfBirth = parseDate(dobRaw);
      if (!dateOfBirth) { fail(`Invalid date of birth "${dobRaw}" — use YYYY-MM-DD.`); continue; }
      if (dateOfBirth > new Date()) { fail("Date of birth cannot be in the future."); continue; }

      const genderRaw = (row[STUDENT_KEYS.gender] || "").trim().toLowerCase();
      const gender = genderRaw || "male";
      if (!["male", "female", "other"].includes(gender)) { fail(`Invalid gender "${genderRaw}" — use male, female, or other.`); continue; }

      const phoneRaw = (row[STUDENT_KEYS.phone] || "").trim();
      let phone = "";
      if (phoneRaw) {
        const digits = tenDigitPhone(phoneRaw);
        if (!digits) { fail(`Student phone "${phoneRaw}" must be exactly 10 digits.`); continue; }
        phone = digits;
      }

      const parentName = (row[STUDENT_KEYS.parentName] || "").trim();
      if (!parentName) { fail("Father's name is required."); continue; }
      const motherName = (row[STUDENT_KEYS.motherName] || "").trim();
      if (!motherName) { fail("Mother's name is required."); continue; }

      const parentPhoneRaw = (row[STUDENT_KEYS.parentPhone] || "").trim();
      const parentPhone = tenDigitPhone(parentPhoneRaw);
      if (!parentPhone) { fail(`Father phone "${parentPhoneRaw}" must be exactly 10 digits.`); continue; }

      const parentEmail = (row[STUDENT_KEYS.parentEmail] || "").trim().toLowerCase();
      if (!parentEmail) { fail("Father's email is required."); continue; }
      if (!EMAIL_RE.test(parentEmail)) { fail(`Invalid father email "${parentEmail}".`); continue; }

      const motherPhoneRaw = (row[STUDENT_KEYS.motherPhone] || "").trim();
      let motherPhone = "";
      if (motherPhoneRaw) {
        const digits = tenDigitPhone(motherPhoneRaw);
        if (!digits) { fail(`Mother phone "${motherPhoneRaw}" must be exactly 10 digits.`); continue; }
        motherPhone = digits;
      }

      const admissionDateRaw = (row[STUDENT_KEYS.admissionDate] || "").trim();
      if (!admissionDateRaw) { fail("Admission date is required."); continue; }
      const admissionDate = parseDate(admissionDateRaw);
      if (!admissionDate) { fail(`Invalid admission date "${admissionDateRaw}" — use YYYY-MM-DD.`); continue; }
      if (admissionDate > new Date()) { fail("Admission date cannot be in the future."); continue; }

      const address = (row[STUDENT_KEYS.address] || "").trim();
      const bloodGroup = (row[STUDENT_KEYS.bloodGroup] || "").trim();

      // Everything validated — this row is going in. Mark the roll number
      // used immediately so a later duplicate row in the same file is
      // caught too, not just duplicates against what was already in the DB.
      usedRollKeys.add(rollKey);
      admissionSeq += 1;
      const admissionNo = `ADM-${year}-${String(admissionSeq).padStart(4, "0")}`;

      try {
        const student = await Student.create({
          name,
          phone,
          class: studentClass,
          section,
          rollNumber,
          dateOfBirth,
          gender: gender as "male" | "female" | "other",
          address,
          bloodGroup,
          school: auth.schoolId,
          classTeacher: null,
          isVerified: true,
          admissionDate,
          admissionNo,
        });

        let parent = parentsByEmail.get(parentEmail);
        if (parent) {
          parent.students.push(student._id);
          if (motherName) parent.motherName = motherName;
          if (motherPhone) parent.motherPhone = motherPhone;
          await parent.save();
        } else {
          const parentRawPass = generatePassword();
          parent = await Parent.create({
            name: parentName,
            motherName,
            motherPhone,
            email: parentEmail,
            phone: parentPhone,
            relation: "father",
            school: auth.schoolId,
            students: [student._id],
            password: await hashPassword(parentRawPass),
          });
          parentsByEmail.set(parentEmail, parent);
          try {
            await sendCredentialsMail(parentEmail, { name: parentName, userId: "PARENT", email: parentEmail, password: parentRawPass });
          } catch (e) {
            console.log("Bulk import parent mail error:", e instanceof Error ? e.message : e);
          }
        }
        student.parent = parent._id;
        await student.save();

        results.push({ row: excelRow, name, status: "created", studentId: student.studentId });
      } catch (err) {
        results.push({ row: excelRow, name, status: "failed", message: err instanceof Error ? err.message : "Failed to create student." });
      }
    }

    const created = results.filter((r) => r.status === "created");
    const failed = results.filter((r) => r.status === "failed");

    return NextResponse.json({
      success: true,
      message: `${created.length} student${created.length === 1 ? "" : "s"} created${failed.length > 0 ? `, ${failed.length} failed` : ""}.`,
      data: { createdCount: created.length, failedCount: failed.length, results },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to process the uploaded file." },
      { status: 500 },
    );
  }
}
