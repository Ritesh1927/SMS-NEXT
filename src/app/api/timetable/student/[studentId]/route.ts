import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { TimetableEntry } from "@/models/TimetableEntry";
import { Student } from "@/models/Student";
import { Parent } from "@/models/Parent";
import { Class } from "@/models/Class";
import "@/models/Teacher";

// GET /api/timetable/student/[studentId] — a parent's view of one child's
// weekly schedule. SMS-BACKEND's getStudentTimetable assumes the caller IS
// the student; here a parent looks it up on behalf of their (ownership
// checked) child, the same substitution used by chat/homework.
export async function GET(req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "parent") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { studentId } = await params;
    await connectDB();

    const parentDoc = await Parent.findById(auth.id).select("students");
    const owns = parentDoc?.students?.some((s) => String(s) === studentId);
    if (!owns) {
      return NextResponse.json({ success: false, message: "Access denied." }, { status: 403 });
    }

    const student = await Student.findById(studentId).select("class section");
    if (!student) return NextResponse.json({ success: false, message: "Student not found." }, { status: 404 });

    const classQuery: Record<string, unknown> = { school: auth.schoolId, name: student.class };
    if (student.section) classQuery.section = student.section;
    const cls = await Class.findOne(classQuery);
    if (!cls) return NextResponse.json({ success: true, data: [] });

    const entries = await TimetableEntry.find({ school: auth.schoolId, classId: cls._id })
      .populate("teacherId", "name")
      .sort({ day: 1, periodNumber: 1 });

    return NextResponse.json({ success: true, data: entries });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load timetable." },
      { status: 500 },
    );
  }
}
