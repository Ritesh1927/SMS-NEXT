import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Teacher } from "@/models/Teacher";
import { Parent } from "@/models/Parent";
import { Student } from "@/models/Student";
import { Homework } from "@/models/Homework";
import { TimetableEntry } from "@/models/TimetableEntry";
import { AttendanceRecord } from "@/models/AttendanceRecord";
import { Class } from "@/models/Class";
import { FeePayment } from "@/models/FeePayment";

// DELETE /api/usermaster/[role]/[id] — role is "teacher" | "non-teaching" |
// "parent". "non-teaching" staff live in the Teacher collection too
// (distinguished by staffType), so both map to the same model.
export async function DELETE(req: Request, { params }: { params: Promise<{ role: string; id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { role, id } = await params;
    await connectDB();

    if (role === "teacher" || role === "non-teaching") {
      const teacher = await Teacher.findOne({ _id: id, school: auth.schoolId });
      if (!teacher) return NextResponse.json({ success: false, message: "Teacher not found." }, { status: 404 });

      const [hwCount, ttCount, attCount, classCount] = await Promise.all([
        Homework.countDocuments({ assignedBy: teacher._id, assignedByModel: "Teacher", school: auth.schoolId }),
        TimetableEntry.countDocuments({ teacherId: teacher._id, school: auth.schoolId }),
        AttendanceRecord.countDocuments({ "markedBy.id": teacher._id, school: auth.schoolId }),
        Class.countDocuments({ classTeacher: teacher._id, school: auth.schoolId }),
      ]);

      const blocks: string[] = [];
      if (hwCount) blocks.push(`${hwCount} homework`);
      if (ttCount) blocks.push(`${ttCount} timetable`);
      if (attCount) blocks.push(`${attCount} attendance`);
      if (classCount) blocks.push(`${classCount} class teacher`);

      if (blocks.length > 0) {
        return NextResponse.json(
          { success: false, message: `Cannot delete "${teacher.name}" — has ${blocks.join(", ")} records. Deactivate instead.`, code: "HAS_TRANSACTIONS" },
          { status: 409 },
        );
      }

      await Teacher.findOneAndDelete({ _id: id, school: auth.schoolId });
      return NextResponse.json({ success: true, message: `"${teacher.name}" deleted permanently.` });
    }

    if (role === "parent") {
      const parent = await Parent.findOne({ _id: id, school: auth.schoolId });
      if (!parent) return NextResponse.json({ success: false, message: "Parent not found." }, { status: 404 });

      const [feeCount, activeChildren] = await Promise.all([
        FeePayment.countDocuments({ school: auth.schoolId, student: { $in: parent.students } }),
        Student.countDocuments({ parent: parent._id, school: auth.schoolId, isActive: true }),
      ]);

      const blocks: string[] = [];
      if (feeCount) blocks.push(`${feeCount} fee payment`);
      if (activeChildren) blocks.push(`${activeChildren} active child`);

      if (blocks.length > 0) {
        return NextResponse.json(
          { success: false, message: `Cannot delete "${parent.name}" — has ${blocks.join(", ")}. Deactivate instead.`, code: "HAS_TRANSACTIONS" },
          { status: 409 },
        );
      }

      await Student.updateMany({ parent: parent._id, school: auth.schoolId }, { isActive: false });
      await Parent.findOneAndDelete({ _id: id, school: auth.schoolId });
      return NextResponse.json({ success: true, message: `"${parent.name}" deleted permanently.` });
    }

    return NextResponse.json({ success: false, message: "Invalid role." }, { status: 400 });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to delete user." },
      { status: 500 },
    );
  }
}
