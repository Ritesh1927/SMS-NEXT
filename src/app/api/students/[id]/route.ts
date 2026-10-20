import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser, requireStaffSectionAccess, getTeacherExtraPowers, teacherPowerAllows } from "@/lib/auth-server";
import type { TokenPayload } from "@/lib/helpers";
import { Student } from "@/models/Student";
import { Parent } from "@/models/Parent";
import { resequenceRollNumbers } from "@/lib/rollNumber";
import { isClassTeacherOfSection } from "@/lib/teacherClasses";

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
      // Non-teaching staff with the Role system's "view" grant for Students
      // bypass the class-teacher check below; everyone else (incl. a
      // non-teaching staff member without that grant) falls through to it,
      // which correctly also rejects them -- they're never a class teacher.
      const staffGate = await requireStaffSectionAccess(req, "students", "view");
      if ("error" in staffGate) {
        const isClassTeacher = await isClassTeacherOfSection(auth.id, auth.schoolId, student.class, student.section);
        if (!isClassTeacher) {
          const powers = await getTeacherExtraPowers(auth);
          if (!teacherPowerAllows(powers, "studentsEdit", student.class)) {
            return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 403 });
          }
        }
      }
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
  await connectDB();
  const { id } = await params;

  // No genuine teacher path existed here at all before Teacher Power Roles
  // -- the Role gate is tried first (schooladmin or non-teaching staff with
  // "edit"), and only on its failure does a teacher's Power Role get a
  // chance, scoped to the specific student's class.
  const gate = await requireStaffSectionAccess(req, "students", "edit");
  let auth: TokenPayload;
  if ("error" in gate) {
    const teacherAuth = getAuthUser(req);
    if (!teacherAuth || teacherAuth.role !== "teacher") return gate.error;
    const target = await Student.findOne({ _id: id, school: teacherAuth.schoolId }).select("class");
    if (!target) return NextResponse.json({ success: false, message: "Student not found." }, { status: 404 });
    const powers = await getTeacherExtraPowers(teacherAuth);
    if (!teacherPowerAllows(powers, "studentsEdit", target.class)) return gate.error;
    auth = teacherAuth;
  } else {
    auth = gate.auth;
  }

  try {
    const body = await req.json();

    // PATCH is a partial update, so every check here only fires for a field
    // actually present in the body -- unlike POST's required-field checks,
    // this isn't re-requiring anything, just format-checking whatever was
    // sent, matching the rules POST already enforces on create.
    if (body.name !== undefined && !String(body.name).trim()) {
      return NextResponse.json({ success: false, message: "Student name cannot be empty." }, { status: 400 });
    }
    if (body.phone && !/^\d{10}$/.test(body.phone)) {
      return NextResponse.json({ success: false, message: "Student phone must be exactly 10 digits." }, { status: 400 });
    }
    if (body.dateOfBirth && new Date(body.dateOfBirth) > new Date()) {
      return NextResponse.json({ success: false, message: "Date of birth cannot be in the future." }, { status: 400 });
    }
    if (body.admissionDate && new Date(body.admissionDate) > new Date()) {
      return NextResponse.json({ success: false, message: "Admission date cannot be a future date." }, { status: 400 });
    }
    if (body.aadhaarNumber && !/^\d{12}$/.test(body.aadhaarNumber)) {
      return NextResponse.json({ success: false, message: "Aadhaar must be exactly 12 digits." }, { status: 400 });
    }
    if (body.emergencyPhone && !/^\d{10}$/.test(body.emergencyPhone)) {
      return NextResponse.json({ success: false, message: "Emergency phone must be exactly 10 digits." }, { status: 400 });
    }
    if (body.parentEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.parentEmail)) {
      return NextResponse.json({ success: false, message: "Invalid parent email format." }, { status: 400 });
    }
    if (body.parentPhone && !/^\d{10}$/.test(body.parentPhone)) {
      return NextResponse.json({ success: false, message: "Parent phone must be exactly 10 digits." }, { status: 400 });
    }
    if (body.motherPhone && !/^\d{10}$/.test(body.motherPhone)) {
      return NextResponse.json({ success: false, message: "Mother's phone must be exactly 10 digits." }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (body[key] !== undefined) updates[key] = body[key];
    }
    const parentBody: Record<string, unknown> = {};
    for (const key of PARENT_SYNC_FIELDS) {
      if (body[key] !== undefined) parentBody[key] = body[key];
    }

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
  await connectDB();
  const gate = await requireStaffSectionAccess(req, "students", "delete");
  if ("error" in gate) return gate.error;
  const { auth } = gate;

  try {
    const { id } = await params;

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
