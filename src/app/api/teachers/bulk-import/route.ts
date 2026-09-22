import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Teacher } from "@/models/Teacher";
import { generatePassword, hashPassword } from "@/lib/helpers";
import { sendCredentialsMail } from "@/lib/mail";
import { parseWorkbookRows } from "@/lib/excelImport";
import { TEACHER_KEYS } from "@/lib/bulkImportFields";

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
  teacherId?: string;
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
        { success: false, message: `Too many rows — upload at most ${MAX_ROWS} staff at a time.` },
        { status: 400 },
      );
    }

    await connectDB();

    const existingTeachers = await Teacher.find({ school: auth.schoolId }).select("email");
    const usedEmails = new Set(existingTeachers.map((t) => t.email.toLowerCase()));

    const results: RowResult[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const excelRow = i + 2;
      const row = rawRows[i];
      const name = (row[TEACHER_KEYS.name] || "").trim();

      const fail = (message: string) => results.push({ row: excelRow, name: name || "(no name)", status: "failed", message });

      if (!name) { fail("Name is required."); continue; }

      const email = (row[TEACHER_KEYS.email] || "").trim().toLowerCase();
      if (!email) { fail("Email is required."); continue; }
      if (!EMAIL_RE.test(email)) { fail(`Invalid email "${email}".`); continue; }
      if (usedEmails.has(email)) { fail(`Email "${email}" is already used by another staff member.`); continue; }

      const staffTypeRaw = (row[TEACHER_KEYS.staffType] || "").trim().toLowerCase();
      const staffType = staffTypeRaw === "non-teaching" ? "non-teaching" : "teaching";
      if (staffTypeRaw && staffType !== staffTypeRaw) { fail(`Invalid staff type "${staffTypeRaw}" — use teaching or non-teaching.`); continue; }
      const isTeaching = staffType === "teaching";

      const primarySubject = (row[TEACHER_KEYS.primarySubject] || "").trim();
      if (isTeaching && !primarySubject) { fail("Primary subject is required for teaching staff."); continue; }

      const phoneRaw = (row[TEACHER_KEYS.phone] || "").trim();
      let phone = "";
      if (phoneRaw) {
        const digits = tenDigitPhone(phoneRaw);
        if (!digits) { fail(`Phone "${phoneRaw}" must be exactly 10 digits.`); continue; }
        phone = digits;
      }

      const dobRaw = (row[TEACHER_KEYS.dateOfBirth] || "").trim();
      let dateOfBirth: Date | null = null;
      if (dobRaw) {
        dateOfBirth = parseDate(dobRaw);
        if (!dateOfBirth) { fail(`Invalid date of birth "${dobRaw}" — use YYYY-MM-DD.`); continue; }
        if (dateOfBirth > new Date()) { fail("Date of birth cannot be in the future."); continue; }
      }

      const joiningDateRaw = (row[TEACHER_KEYS.joiningDate] || "").trim();
      let joiningDate: Date | null = null;
      if (joiningDateRaw) {
        joiningDate = parseDate(joiningDateRaw);
        if (!joiningDate) { fail(`Invalid joining date "${joiningDateRaw}" — use YYYY-MM-DD.`); continue; }
      }

      const genderRaw = (row[TEACHER_KEYS.gender] || "").trim().toLowerCase();
      const gender = genderRaw || "male";
      if (!["male", "female", "other"].includes(gender)) { fail(`Invalid gender "${genderRaw}" — use male, female, or other.`); continue; }

      const employmentTypeRaw = (row[TEACHER_KEYS.employmentType] || "").trim().toLowerCase();
      const employmentType = employmentTypeRaw || "full-time";
      if (!["full-time", "part-time", "contract"].includes(employmentType)) {
        fail(`Invalid employment type "${employmentTypeRaw}" — use full-time, part-time, or contract.`);
        continue;
      }

      const secondarySubject = (row[TEACHER_KEYS.secondarySubject] || "").trim();
      const subjects = (row[TEACHER_KEYS.subjects] || "")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const designation = (row[TEACHER_KEYS.designation] || "").trim() || (isTeaching ? "Teacher" : "Staff");
      const department = (row[TEACHER_KEYS.department] || "").trim();
      const qualification = (row[TEACHER_KEYS.qualification] || "").trim();
      const experience = (row[TEACHER_KEYS.experience] || "").trim();
      const address = (row[TEACHER_KEYS.address] || "").trim();
      const bloodGroup = (row[TEACHER_KEYS.bloodGroup] || "").trim();

      // Reserve the email immediately so a later duplicate row in the same
      // file is caught too, not just duplicates against the existing DB.
      usedEmails.add(email);

      try {
        const rawPassword = generatePassword();
        const teacher = await Teacher.create({
          name,
          email,
          phone,
          staffType,
          department: isTeaching ? "" : department,
          subjects: isTeaching ? subjects : [],
          primarySubject: isTeaching ? primarySubject : "",
          secondarySubject: isTeaching ? secondarySubject : "",
          qualification,
          experience,
          designation,
          password: await hashPassword(rawPassword),
          school: auth.schoolId,
          isVerified: true,
          gender: gender as "male" | "female" | "other",
          dateOfBirth,
          address,
          bloodGroup,
          joiningDate,
          employmentType: employmentType as "full-time" | "part-time" | "contract",
        });

        try {
          await sendCredentialsMail(email, { name, userId: teacher.teacherId, email, password: rawPassword });
        } catch (e) {
          console.log("Bulk import teacher mail error:", e instanceof Error ? e.message : e);
        }

        results.push({ row: excelRow, name, status: "created", teacherId: teacher.teacherId });
      } catch (err) {
        results.push({ row: excelRow, name, status: "failed", message: err instanceof Error ? err.message : "Failed to create staff member." });
      }
    }

    const created = results.filter((r) => r.status === "created");
    const failed = results.filter((r) => r.status === "failed");

    return NextResponse.json({
      success: true,
      message: `${created.length} staff member${created.length === 1 ? "" : "s"} created${failed.length > 0 ? `, ${failed.length} failed` : ""}.`,
      data: { createdCount: created.length, failedCount: failed.length, results },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to process the uploaded file." },
      { status: 500 },
    );
  }
}
