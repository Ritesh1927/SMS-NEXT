import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser, getTeacherExtraPowers } from "@/lib/auth-server";
import { Student } from "@/models/Student";
import { Class } from "@/models/Class";
import { getTeacherAccessibleClasses } from "@/lib/teacherClasses";
import { withAttendancePercent } from "@/lib/studentAttendance";
import { classifyStage } from "@/lib/classStage";
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
    const orClauses: { name: string; section: string }[] = [...accessible];

    // A Power Role's "studentsEdit" or "studentsCreate" (which also covers
    // delete) grant broadens this roster beyond ownership (class teacher /
    // assignedClasses) to every class in the role's chosen stage scope --
    // this is also what makes the Edit/Delete buttons appear for those
    // students on the Students page.
    const powers = await getTeacherExtraPowers(auth);
    if ((powers?.studentsEdit === true || powers?.studentsCreate === true) && powers.scope.length > 0) {
      const allClasses = await Class.find({ school: auth.schoolId }).select("name section").lean();
      for (const c of allClasses) {
        const stage = classifyStage(c.name);
        if (stage && powers.scope.includes(stage)) orClauses.push({ name: c.name, section: c.section });
      }
    }

    if (orClauses.length === 0) {
      return NextResponse.json({ success: true, count: 0, data: [] });
    }

    const students = await Student.find({
      school: auth.schoolId,
      isActive: true,
      $or: orClauses.map((c) => ({ class: c.name, section: c.section })),
    })
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
