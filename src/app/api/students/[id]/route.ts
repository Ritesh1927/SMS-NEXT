import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Student } from "@/models/Student";
import { Parent } from "@/models/Parent";
import { resequenceRollNumbers } from "@/lib/rollNumber";
import { isClassTeacherOfSection } from "@/lib/teacherClasses";

function requireSchoolAdmin(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") return null;
  return auth;
}

// rollNumber is deliberately not in this list — it's auto-assigned from
// alphabetical order within a class+section, not something the admin sets.
const ALLOWED_FIELDS = [
  "name", "phone", "class", "section", "dateOfBirth", "gender", "address", "bloodGroup",
  "isActive", "admissionDate", "admissionNo", "previousSchool", "aadhaarNumber",
  "emergencyContact", "emergencyPhone", "emergencyRelation", "religion", "category",
] as const;

// Read-only: schooladmins can view any student; teachers only the students
// of a class they're the *class teacher* of (not merely a subject teacher
// of) -- narrower than the student list at /api/teachers/my-students, which
// also includes their subject-taught classes.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    await connectDB();

    const student = await Student.findOne({ _id: id, school: auth.schoolId })
      .select("-password")
      .populate("parent", "name motherName motherPhone email phone relation occupation motherOccupation");
    if (!student) return NextResponse.json({ success: false, message: "Student not found." }, { status: 404 });

    if (auth.role === "teacher") {
      const isClassTeacher = await isClassTeacherOfSection(auth.id, auth.schoolId, student.class, student.section);
      if (!isClassTeacher) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 403 });
    }

    return NextResponse.json({ success: true, data: student });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load student." },
      { status: 500 },
    );
  }
}

const PARENT_SYNC_FIELDS = ["parentName", "motherName", "motherPhone", "parentPhone", "parentEmail", "fatherOccupation", "motherOccupation"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireSchoolAdmin(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json();
    const updates: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (body[key] !== undefined) updates[key] = body[key];
    }
    const parentBody: Record<string, unknown> = {};
    for (const key of PARENT_SYNC_FIELDS) {
      if (body[key] !== undefined) parentBody[key] = body[key];
    }

    await connectDB();

    if (updates.admissionNo) {
      const dup = await Student.findOne({ admissionNo: updates.admissionNo, school: auth.schoolId, _id: { $ne: id } });
      if (dup) {
        return NextResponse.json(
          { success: false, message: `Admission number "${updates.admissionNo}" already exists.` },
          { status: 400 },
        );
      }
    }

    // Needed regardless of which fields changed, so the roster this student
    // is leaving (if class/section moved) can be resequenced too, below.
    const before = await Student.findOne({ _id: id, school: auth.schoolId }).select("class section");
    if (!before) return NextResponse.json({ success: false, message: "Student not found." }, { status: 404 });

    if (updates.aadhaarNumber) {
      const dupAadhaar = await Student.findOne({
        school: auth.schoolId, aadhaarNumber: updates.aadhaarNumber, _id: { $ne: id }, isActive: true,
      });
      if (dupAadhaar) {
        return NextResponse.json(
          { success: false, message: `Aadhaar number "${updates.aadhaarNumber}" is already registered to another student.` },
          { status: 400 },
        );
      }
    }

    const student = await Student.findOneAndUpdate({ _id: id, school: auth.schoolId }, updates, {
      returnDocument: "after",
    }).select("-password");
    if (!student) return NextResponse.json({ success: false, message: "Student not found." }, { status: 404 });

    if (student.parent && Object.keys(parentBody).length > 0) {
      const parentUpdates: Record<string, unknown> = {};
      if (parentBody.parentName) parentUpdates.name = parentBody.parentName;
      if (parentBody.motherName !== undefined) parentUpdates.motherName = parentBody.motherName;
      if (parentBody.motherPhone !== undefined) parentUpdates.motherPhone = parentBody.motherPhone;
      if (parentBody.parentPhone) parentUpdates.phone = parentBody.parentPhone;
      if (parentBody.parentEmail) parentUpdates.email = parentBody.parentEmail;
      if (parentBody.fatherOccupation !== undefined) parentUpdates.occupation = parentBody.fatherOccupation;
      if (parentBody.motherOccupation !== undefined) parentUpdates.motherOccupation = parentBody.motherOccupation;
      await Parent.findOneAndUpdate({ _id: student.parent, school: auth.schoolId }, parentUpdates);
    }

    // Name, class, or section may have changed — resequence whatever
    // roster(s) this student now belongs to (and the one it left, if moved).
    await resequenceRollNumbers(auth.schoolId, student.class, student.section);
    if (student.class !== before.class || student.section !== before.section) {
      await resequenceRollNumbers(auth.schoolId, before.class, before.section);
    }
    const finalStudent = await Student.findOne({ _id: id, school: auth.schoolId }).select("-password");

    return NextResponse.json({ success: true, message: "Student updated.", data: finalStudent || student });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to update student." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireSchoolAdmin(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    const { id } = await params;
    await connectDB();

    const student = await Student.findOne({ _id: id, school: auth.schoolId });
    if (!student) return NextResponse.json({ success: false, message: "Student not found." }, { status: 404 });

    // No Fee model yet, so unlike SMS-BACKEND (which soft-deletes students
    // with fee history) this always hard-deletes — nothing to preserve.
    if (student.parent) {
      const parent = await Parent.findById(student.parent);
      if (parent) {
        parent.students = parent.students.filter((sId) => sId.toString() !== student._id.toString());
        if (parent.students.length === 0) parent.isActive = false;
        await parent.save();
      }
    }

    await Student.findOneAndDelete({ _id: id, school: auth.schoolId });
    await resequenceRollNumbers(auth.schoolId, student.class, student.section);
    return NextResponse.json({ success: true, message: "Student deleted." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to delete student." },
      { status: 500 },
    );
  }
}
