import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Student } from "@/models/Student";
import { Parent } from "@/models/Parent";
import { generatePassword, hashPassword, escapeRegex } from "@/lib/helpers";
import { sendCredentialsMail } from "@/lib/mail";
import { withAttendancePercent } from "@/lib/studentAttendance";
import { resequenceRollNumbers } from "@/lib/rollNumber";

function requireSchoolAdmin(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") return null;
  return auth;
}

export async function GET(req: Request) {
  const auth = requireSchoolAdmin(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");
    const studentClass = searchParams.get("class");
    const section = searchParams.get("section");

    const query: Record<string, unknown> = { school: auth.schoolId };
    if (studentClass) query.class = studentClass;
    if (section) query.section = section;
    if (search) {
      const rx = { $regex: escapeRegex(search), $options: "i" };
      query.$or = [{ name: rx }, { studentId: rx }, { rollNumber: rx }];
    }

    const students = await Student.find(query)
      .select("-password")
      .populate("parent", "name motherName motherPhone email phone occupation motherOccupation")
      // rollNumber is a plain "1", "2", "3"... string, so sorting by it
      // lexicographically would put "10" before "2" — sort by name instead,
      // which is equivalent now that roll number always tracks name order.
      .collation({ locale: "en" })
      .sort({ class: 1, name: 1 })
      .lean();

    const data = await withAttendancePercent(auth.schoolId, students);

    return NextResponse.json({ success: true, count: data.length, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load students." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const auth = requireSchoolAdmin(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    const body = await req.json();
    const {
      name, phone, studentClass, section, dateOfBirth, gender, address, bloodGroup,
      parentName, motherName, motherPhone, parentEmail, parentPhone, parentRelation,
      fatherOccupation, motherOccupation,
      admissionDate, admissionNo, previousSchool, aadhaarNumber,
      emergencyContact, emergencyPhone, emergencyRelation,
      religion, category,
    } = body;

    if (!name || !studentClass) return NextResponse.json({ success: false, message: "Name and class required." }, { status: 400 });
    if (!dateOfBirth) return NextResponse.json({ success: false, message: "Date of birth is required." }, { status: 400 });
    if (!parentName) return NextResponse.json({ success: false, message: "Father's name is required." }, { status: 400 });
    if (!motherName) return NextResponse.json({ success: false, message: "Mother's name is required." }, { status: 400 });
    if (!parentPhone) return NextResponse.json({ success: false, message: "Parent phone is required." }, { status: 400 });
    if (!parentEmail) return NextResponse.json({ success: false, message: "Parent email is required." }, { status: 400 });
    if (!admissionDate) return NextResponse.json({ success: false, message: "Admission date is required." }, { status: 400 });
    if (new Date(admissionDate) > new Date()) {
      return NextResponse.json({ success: false, message: "Admission date cannot be a future date." }, { status: 400 });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(parentEmail)) {
      return NextResponse.json({ success: false, message: "Invalid parent email format." }, { status: 400 });
    }
    if (phone && !/^\d{10}$/.test(phone)) {
      return NextResponse.json({ success: false, message: "Student phone must be exactly 10 digits." }, { status: 400 });
    }
    if (!/^\d{10}$/.test(parentPhone)) {
      return NextResponse.json({ success: false, message: "Parent phone must be exactly 10 digits." }, { status: 400 });
    }
    if (new Date(dateOfBirth) > new Date()) {
      return NextResponse.json({ success: false, message: "Date of birth cannot be in the future." }, { status: 400 });
    }
    if (aadhaarNumber && !/^\d{12}$/.test(aadhaarNumber)) {
      return NextResponse.json({ success: false, message: "Aadhaar must be exactly 12 digits." }, { status: 400 });
    }
    if (emergencyPhone && !/^\d{10}$/.test(emergencyPhone)) {
      return NextResponse.json({ success: false, message: "Emergency phone must be exactly 10 digits." }, { status: 400 });
    }

    await connectDB();

    if (aadhaarNumber) {
      const dupAadhaar = await Student.findOne({ school: auth.schoolId, aadhaarNumber, isActive: true });
      if (dupAadhaar) {
        return NextResponse.json(
          { success: false, message: `Aadhaar number "${aadhaarNumber}" is already registered to another student.` },
          { status: 400 },
        );
      }
    }

    let finalAdmissionNo = admissionNo;
    if (!finalAdmissionNo) {
      const count = await Student.countDocuments({ school: auth.schoolId });
      const year = new Date().getFullYear();
      finalAdmissionNo = "ADM-" + year + "-" + String(count + 1).padStart(4, "0");
    }
    const existingAdm = await Student.findOne({ admissionNo: finalAdmissionNo, school: auth.schoolId });
    if (existingAdm) {
      return NextResponse.json(
        { success: false, message: `Admission number "${finalAdmissionNo}" already exists.` },
        { status: 400 },
      );
    }

    if (phone) {
      const existing = await Student.findOne({ phone, school: auth.schoolId });
      if (existing) {
        if (existing.parent && parentEmail) {
          const existingParent = await Parent.findOne({ email: parentEmail, school: auth.schoolId });
          if (!existingParent || String(existing.parent) !== String(existingParent._id)) {
            return NextResponse.json(
              { success: false, message: "This phone number is already used by another student." },
              { status: 400 },
            );
          }
        } else {
          return NextResponse.json(
            { success: false, message: "This phone number is already used by another student." },
            { status: 400 },
          );
        }
      }
    }

    const student = await Student.create({
      name,
      phone: phone || "",
      class: studentClass,
      section: section || "",
      dateOfBirth: dateOfBirth || null,
      gender: gender || "male",
      address: address || "",
      bloodGroup: bloodGroup || "",
      school: auth.schoolId,
      classTeacher: null,
      isVerified: true,
      admissionDate: admissionDate || null,
      admissionNo: finalAdmissionNo,
      previousSchool: previousSchool || "",
      aadhaarNumber: aadhaarNumber || "",
      emergencyContact: emergencyContact || "",
      emergencyPhone: emergencyPhone || "",
      emergencyRelation: emergencyRelation || "",
      religion: religion || "",
      category: category || "",
    });

    let parent = null;
    let parentTempPassword: string | null = null;
    if (parentName && parentEmail) {
      const existingParent = await Parent.findOne({ email: parentEmail, school: auth.schoolId });
      if (existingParent) {
        existingParent.students.push(student._id);
        if (motherName) existingParent.motherName = motherName;
        if (motherPhone) existingParent.motherPhone = motherPhone;
        if (fatherOccupation) existingParent.occupation = fatherOccupation;
        if (motherOccupation) existingParent.motherOccupation = motherOccupation;
        await existingParent.save();
        parent = existingParent;
      } else {
        const parentRawPass = generatePassword();
        parentTempPassword = parentRawPass;
        parent = await Parent.create({
          name: parentName,
          motherName: motherName || "",
          motherPhone: motherPhone || "",
          email: parentEmail,
          phone: parentPhone || "",
          occupation: fatherOccupation || "",
          motherOccupation: motherOccupation || "",
          relation: parentRelation || "father",
          school: auth.schoolId,
          students: [student._id],
          password: await hashPassword(parentRawPass),
        });
        try {
          await sendCredentialsMail(parentEmail, { name: parentName, userId: "PARENT", email: parentEmail, password: parentRawPass });
        } catch (e) {
          console.log("Parent mail error:", e instanceof Error ? e.message : e);
        }
      }
      student.parent = parent._id;
      await student.save();
    }

    await resequenceRollNumbers(auth.schoolId, studentClass, section || "");
    const finalStudent = await Student.findById(student._id).select("-password");

    const studentData = (finalStudent || student).toObject() as unknown as Record<string, unknown>;
    delete studentData.password;
    let parentData: Record<string, unknown> | null = null;
    if (parent) {
      parentData = parent.toObject() as unknown as Record<string, unknown>;
      delete parentData.password;
    }

    return NextResponse.json(
      {
        success: true,
        message: "Student created successfully.",
        data: studentData,
        parent: parentData,
        parentTempPassword,
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to create student." },
      { status: 500 },
    );
  }
}
