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
import { TimetableEntry, type Weekday } from "@/models/TimetableEntry";
import { Notice } from "@/models/Notice";
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

    // ---- Today's Schedule — this teacher's timetable for today ----
    const weekdayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const todayWeekday = weekdayNames[new Date().getDay()];
    const toMinutes = (t: string) => {
      const m = /^(\d{1,2}):(\d{2})/.exec(t || "");
      return m ? Number(m[1]) * 60 + Number(m[2]) : null;
    };
    type PopulatedEntry = {
      periodNumber: number; subject: string; startTime: string; endTime: string;
      classId: { name: string; section: string } | null;
    };
    const todayEntries =
      todayWeekday === "Sunday"
        ? []
        : await TimetableEntry.find({ school: teacher.school, teacherId: teacher._id, day: todayWeekday as Weekday })
            .sort({ periodNumber: 1 })
            .populate("classId", "name section")
            .lean<PopulatedEntry[]>();
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const todaySchedule = todayEntries.map((e) => {
      const start = toMinutes(e.startTime);
      const end = toMinutes(e.endTime);
      const status: "done" | "ongoing" | "upcoming" =
        start != null && end != null ? (nowMin > end ? "done" : nowMin >= start ? "ongoing" : "upcoming") : "upcoming";
      return {
        periodNumber: e.periodNumber,
        startTime: e.startTime,
        endTime: e.endTime,
        subject: e.subject,
        classLabel: e.classId ? formatClassName(e.classId.name, e.classId.section) : "",
        status,
      };
    });

    // ---- Class Summary — today's attendance for every class this teacher
    // has (assigned classes first, plus class-teacher-only ones), so a
    // subject teacher still gets rows for the classes they teach.
    const summaryClassMap = new Map<string, { className: string; section: string }>();
    for (const c of assigned) summaryClassMap.set(String(c._id), { className: c.name, section: c.section });
    for (const c of ownedClasses) {
      const id = String(c._id);
      if (!summaryClassMap.has(id)) summaryClassMap.set(id, { className: c.name, section: c.section });
    }
    const summaryRecords =
      summaryClassMap.size > 0
        ? await AttendanceRecord.find({
            school: teacher.school,
            classId: { $in: [...summaryClassMap.keys()] },
            date: { $gte: todayStart, $lte: todayEnd },
          }).select("classId status")
        : [];
    const summaryAgg = new Map<string, { present: number; absent: number; marked: number }>();
    for (const r of summaryRecords) {
      const key = String(r.classId);
      const cur = summaryAgg.get(key) || { present: 0, absent: 0, marked: 0 };
      cur.marked += 1;
      if (r.status === "absent") cur.absent += 1;
      else cur.present += 1;
      summaryAgg.set(key, cur);
    }
    const classSummary = (
      await Promise.all(
        [...summaryClassMap].map(async ([classId, info]) => {
          const q: Record<string, unknown> = { school: teacher.school, isActive: true, class: info.className };
          if (info.section) q.section = info.section;
          const total = await Student.countDocuments(q);
          const agg = summaryAgg.get(classId);
          const marked = agg?.marked || 0;
          return {
            classId,
            label: formatClassName(info.className, info.section),
            total,
            present: agg?.present || 0,
            absent: agg?.absent || 0,
            pct: marked > 0 ? Math.round(((agg?.present || 0) / marked) * 100) : null,
          };
        }),
      )
    ).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true, sensitivity: "base" }));

    // ---- Recent Activities — the teacher's own actions + school notices,
    // same 2-day recency cutoff the admin dashboard uses so stale items
    // never fill the card.
    const activityCutoff = new Date();
    activityCutoff.setDate(activityCutoff.getDate() - 2);
    const [recentMarks, recentHomework, recentNotices] = await Promise.all([
      AttendanceRecord.find({ school: teacher.school, "markedBy.id": teacher._id, createdAt: { $gte: activityCutoff } })
        .sort({ createdAt: -1 })
        .limit(4)
        .populate("classId", "name section")
        .lean<{ classId: { name: string; section: string } | null; createdAt: Date }[]>(),
      Homework.find({ school: teacher.school, assignedBy: teacher._id, assignedByModel: "Teacher", isActive: true, createdAt: { $gte: activityCutoff } })
        .sort({ createdAt: -1 })
        .limit(4)
        .select("title class section createdAt")
        .lean<{ title: string; class: string; section: string; createdAt: Date }[]>(),
      Notice.find({ school: teacher.school, createdAt: { $gte: activityCutoff } })
        .sort({ createdAt: -1 })
        .limit(3)
        .select("title createdAt")
        .lean<{ title: string; createdAt: Date }[]>(),
    ]);
    const recentActivity = [
      ...recentMarks.map((m) => ({
        type: "attendance" as const,
        text: `You marked attendance for ${m.classId ? formatClassName(m.classId.name, m.classId.section) : "your class"}`,
        time: m.createdAt,
      })),
      ...recentHomework.map((h) => ({
        type: "homework" as const,
        text: `You assigned "${h.title}" · ${formatClassName(h.class, h.section || undefined)}`,
        time: h.createdAt,
      })),
      ...recentNotices.map((n) => ({ type: "notice" as const, text: `Notice posted: ${n.title}`, time: n.createdAt })),
    ]
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 6);

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
        todaySchedule,
        classSummary,
        recentActivity,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load dashboard." },
      { status: 500 },
    );
  }
}
