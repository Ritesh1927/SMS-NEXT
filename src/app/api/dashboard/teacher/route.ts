import { NextResponse } from "next/server";
import type { Types } from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Teacher } from "@/models/Teacher";
import { Student } from "@/models/Student";
import { Class } from "@/models/Class";
import { AttendanceRecord } from "@/models/AttendanceRecord";
import { Homework } from "@/models/Homework";
import { Result } from "@/models/Result";
import { formatClassName, startOfToday } from "@/lib/helpers";

// Legacy fallback for teachers whose classes were entered as free text
// before assignedClasses (real Class refs) existed — "<class>-<section>",
// e.g. "5-A". Split on the last hyphen so a class name that itself
// contains one (unlikely here, but cheap to guard) isn't mis-parsed.
function parseClassLabel(label: string): { className: string; section: string } {
  const idx = label.lastIndexOf("-");
  if (idx === -1) return { className: label.trim(), section: "" };
  return { className: label.slice(0, idx).trim(), section: label.slice(idx + 1).trim() };
}

export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "teacher") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const teacher = await Teacher.findById(auth.id).select("-password").populate("assignedClasses", "name section");
    if (!teacher) {
      return NextResponse.json({ success: false, message: "Teacher not found." }, { status: 404 });
    }

    // Prefer assignedClasses (real Class refs, set whenever the admin picks
    // from the class list) — exact and typo-proof. Only fall back to
    // parsing the free-text classes[] labels for teachers assigned before
    // that existed.
    type PopulatedClass = { _id: unknown; name: string; section: string };
    const assigned = teacher.assignedClasses as unknown as PopulatedClass[];

    const classBreakdown =
      assigned.length > 0
        ? await Promise.all(
            assigned.map(async (c) => {
              const count = await Student.countDocuments({
                school: teacher.school, isActive: true, class: c.name, section: c.section,
              });
              return { classId: String(c._id), label: formatClassName(c.name, c.section), studentCount: count };
            }),
          )
        : await Promise.all(
            (teacher.classes || []).map(async (label) => {
              const { className, section } = parseClassLabel(label);
              const query: Record<string, unknown> = { school: teacher.school, isActive: true, class: className };
              if (section) query.section = section;
              const count = await Student.countDocuments(query);
              return { label: formatClassName(className, section || undefined), studentCount: count };
            }),
          );

    const totalStudents = classBreakdown.reduce((sum, c) => sum + c.studentCount, 0);

    // Attendance/fees/performance widgets only cover classes this teacher is
    // the *class teacher* of -- a subject teacher with no class-teacher
    // assignment sees the empty state here instead of stats pulled in from
    // classes they merely teach a subject in.
    const ownedClasses: { _id: Types.ObjectId; name: string; section: string }[] = await Class.find({
      classTeacher: teacher._id,
      school: teacher.school,
    }).select("name section").lean();
    const classIds = ownedClasses.map((c) => c._id);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayRecords =
      classIds.length > 0
        ? await AttendanceRecord.find({ school: teacher.school, classId: { $in: classIds }, date: { $gte: todayStart, $lte: todayEnd } }).select("status")
        : [];
    const todayPresent = todayRecords.filter((r) => r.status === "present" || r.status === "late").length;
    const todayAttendancePct = todayRecords.length > 0 ? Math.round((todayPresent / todayRecords.length) * 100) : null;

    const pendingHomework = await Homework.countDocuments({
      school: teacher.school,
      assignedBy: teacher._id,
      assignedByModel: "Teacher",
      isActive: true,
      dueDate: { $gte: startOfToday() },
    });

    // Weekly attendance trend — this calendar month's weeks, oldest first.
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    monthStart.setHours(0, 0, 0, 0);
    const monthName = now.toLocaleString("en-US", { month: "short" });

    const weeklyTrend: { week: string; label: string; rate: number }[] = [];
    const wCursor = new Date(monthStart);
    for (let weekIdx = 1; weekIdx <= 6; weekIdx++) {
      const wStart = new Date(wCursor);
      if (wStart > now) break;
      const wEnd = new Date(wCursor);
      wEnd.setDate(wEnd.getDate() + 6);
      wEnd.setHours(23, 59, 59, 999);

      const atts = classIds.length > 0 ? await AttendanceRecord.find({ school: teacher.school, classId: { $in: classIds }, date: { $gte: wStart, $lte: wEnd } }).select("status") : [];
      const wPresent = atts.filter((r) => r.status === "present" || r.status === "late").length;

      const startDay = wStart.getDate();
      const endDay = Math.min(wEnd.getDate(), new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate());
      weeklyTrend.push({
        week: `W${weekIdx}`,
        label: `${monthName} ${startDay}-${endDay}`,
        rate: atts.length > 0 ? Math.round((wPresent / atts.length) * 100) : 0,
      });
      wCursor.setDate(wCursor.getDate() + 7);
    }

    // Class performance — average published Result % per owned class.
    const classPerformance = await Promise.all(
      ownedClasses.map(async (cls) => {
        const label = formatClassName(cls.name, cls.section);
        const studentIds = (await Student.find({ school: teacher.school, isActive: true, class: cls.name, section: cls.section }).select("_id")).map((s) => s._id);
        if (studentIds.length === 0) return { name: label, avg: 0 };
        const results = await Result.find({ school: teacher.school, student: { $in: studentIds } }).select("percentage");
        const avg = results.length > 0 ? Math.round(results.reduce((s, r) => s + (r.percentage || 0), 0) / results.length) : 0;
        return { name: label, avg };
      }),
    );

    return NextResponse.json({
      success: true,
      data: {
        teacher: {
          name: teacher.name,
          teacherId: teacher.teacherId,
          designation: teacher.designation,
          subjects: teacher.subjects,
          staffType: teacher.staffType,
        },
        stats: { classCount: classBreakdown.length, totalStudents, todayAttendancePct, pendingHomework },
        classBreakdown,
        weeklyTrendMonth: `${monthName} ${now.getFullYear()}`,
        weeklyTrend,
        classPerformance,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load dashboard." },
      { status: 500 },
    );
  }
}
