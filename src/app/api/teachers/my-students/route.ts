import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Teacher } from "@/models/Teacher";
import { Student } from "@/models/Student";
import { getTeacherAccessibleClasses } from "@/lib/teacherClasses";
import "@/models/Parent";

// GET /api/teachers/my-students — read-only student list scoped to classes
// this teacher can access (class teacher or assignedClasses), mirroring
// SMS-BACKEND's teacher-scoped student list used by the Students page when
// a teacher (rather than schooladmin) views it. SMS-BACKEND gates this
// behind the canViewAllStudents permission flag (default false) — matched
// here rather than silently granting every teacher visibility.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "teacher") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const teacher = await Teacher.findById(auth.id).select("permissions");
    if (!teacher?.permissions?.canViewAllStudents) {
      return NextResponse.json(
        { success: false, message: "You don't have permission to view students. Ask your school admin to grant it." },
        { status: 403 },
      );
    }

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
      .sort({ class: 1, rollNumber: 1 });

    return NextResponse.json({ success: true, count: students.length, data: students });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load students." },
      { status: 500 },
    );
  }
}
