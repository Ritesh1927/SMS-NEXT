import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Student } from "@/models/Student";
import { getTeacherAccessibleClasses } from "@/lib/teacherClasses";
import { withAttendancePercent } from "@/lib/studentAttendance";
import "@/models/Parent";

// GET /api/teachers/my-students — read-only student list scoped to classes
// this teacher can access (class teacher or assignedClasses), mirroring
// SMS-BACKEND's teacher-scoped student list used by the Students page when
// a teacher (rather than schooladmin) views it. SMS-BACKEND grants this
// unconditionally to any teacher who is a class teacher / has assigned
// classes — canViewAllStudents in SMS-BACKEND instead gates the separate
// admin-style /admin/students (full school-wide list) route, which has no
// teacher-facing equivalent here, so it doesn't apply to this endpoint.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "teacher") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();

    const accessible = await getTeacherAccessibleClasses(auth.id, auth.schoolId);
    if (accessible.length === 0) {
      return NextResponse.json({ success: true, count: 0, data: [] });
    }

    const students = await Student.find({
      school: auth.schoolId,
      isActive: true,
      $or: accessible.map((c) => ({ class: c.name, section: c.section })),
    })
      .select("-password")
      .populate("parent", "name motherName motherPhone email phone")
      .sort({ class: 1, rollNumber: 1 })
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
