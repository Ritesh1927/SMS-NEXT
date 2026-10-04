import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Class } from "@/models/Class";
import { Student } from "@/models/Student";
import { AttendanceRecord } from "@/models/AttendanceRecord";
import { getTeacherAccessibleClasses } from "@/lib/teacherClasses";

// GET /api/attendance/register?classId=&month=&year= — one class's whole-month
// attendance register for the Reports > Attendance pivot table: the active
// roster plus a studentId -> day -> status map. One query per collection
// instead of the N per-day /attendance/class/[id] calls a month would need —
// the unique index on (school, studentId, date) already guarantees one row
// per student per day.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const classId = searchParams.get("classId");
    const month = parseInt(searchParams.get("month") || "", 10);
    const year = parseInt(searchParams.get("year") || "", 10);

    if (!classId || !month || !year || month < 1 || month > 12) {
      return NextResponse.json({ success: false, message: "classId, month and year are required." }, { status: 400 });
    }

    const cls = await Class.findOne({ _id: classId, school: auth.schoolId }).lean();
    if (!cls) return NextResponse.json({ success: false, message: "Class not found." }, { status: 404 });

    // Teachers only see their own classes in the picker (/api/classes scopes
    // the list to classTeacher + assignedClasses), so mirror that here rather
    // than the classTeacher-only check /attendance/class uses — a subject
    // teacher picking their assigned class shouldn't get a 403.
    if (auth.role === "teacher") {
      const accessible = await getTeacherAccessibleClasses(auth.id, auth.schoolId);
      const allowed = accessible.some((c) => c.name === cls.name && (c.section || "") === (cls.section || ""));
      if (!allowed) {
        return NextResponse.json({ success: false, message: "You do not have access to this class." }, { status: 403 });
      }
    }

    // Same local-time month window as /attendance/monthly so both views agree.
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const [students, records] = await Promise.all([
      Student.find({ school: auth.schoolId, class: cls.name, section: cls.section, isActive: true })
        .select("name rollNumber")
        .collation({ locale: "en" })
        .sort({ name: 1 })
        .lean(),
      AttendanceRecord.find({ school: auth.schoolId, classId: cls._id, date: { $gte: start, $lte: end } })
        .select("studentId date status")
        .lean(),
    ]);

    const byStudent: Record<string, Record<number, string>> = {};
    for (const r of records) {
      const sid = String(r.studentId);
      const day = new Date(r.date).getDate();
      (byStudent[sid] ||= {})[day] = r.status;
    }

    return NextResponse.json({
      success: true,
      data: {
        className: `Class ${cls.name} - ${cls.section}`,
        daysInMonth: end.getDate(),
        students: students.map((s) => ({ _id: String(s._id), name: s.name, rollNumber: s.rollNumber || "" })),
        records: byStudent,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load attendance register." },
      { status: 500 },
    );
  }
}
