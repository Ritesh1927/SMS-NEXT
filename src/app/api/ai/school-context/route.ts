import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Student } from "@/models/Student";
import { Teacher } from "@/models/Teacher";
import { AttendanceRecord } from "@/models/AttendanceRecord";
import { FeePayment } from "@/models/FeePayment";
import { Result } from "@/models/Result";

interface ClassBucket {
  className: string;
  rawClass: string;
  section: string;
  studentNames: string[];
  presentDays: number;
  totalAttendanceDays: number;
  pendingFees: number;
  pendingFeeNames: Set<string>;
  markSum: number;
  markCount: number;
}

// GET /api/ai/school-context — builds the same rich, live-data snapshot
// SMS-BACKEND's getSchoolContext does, used to ground the admin "School
// Insights" chat so it can answer with real names/amounts instead of
// generic advice. Adapted to sms-next's schema shapes: AttendanceRecord is
// one document per student per day here (vs. the original's per-day doc
// with an embedded records[] array), which actually simplifies this pass.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const schoolId = auth.schoolId;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [students, teachers, monthAttendance, fees, results] = await Promise.all([
      Student.find({ school: schoolId, isActive: true }).select("_id name class section studentId rollNumber"),
      Teacher.find({ school: schoolId, isActive: true, staffType: "teaching" }).select("name designation subjects"),
      AttendanceRecord.find({ school: schoolId, date: { $gte: monthStart } }).select("studentId status"),
      FeePayment.find({ school: schoolId }).populate("student", "name class section").select("student amount paidAmount status title"),
      Result.find({ school: schoolId, isPublished: true }).populate("student", "name class section").select("student percentage"),
    ]);

    const studentMeta: Record<string, { key: string; name: string; class: string; section: string }> = {};
    students.forEach((s) => {
      const cls = s.class || "Unknown";
      const key = `${cls}${s.section ? "-" + s.section : ""}`;
      studentMeta[String(s._id)] = { key, name: s.name, class: cls, section: s.section || "" };
    });

    const classMap: Record<string, ClassBucket> = {};
    students.forEach((s) => {
      const cls = s.class || "Unknown";
      const key = `${cls}${s.section ? "-" + s.section : ""}`;
      if (!classMap[key]) {
        classMap[key] = {
          className: key,
          rawClass: cls,
          section: s.section || "",
          studentNames: [],
          presentDays: 0,
          totalAttendanceDays: 0,
          pendingFees: 0,
          pendingFeeNames: new Set(),
          markSum: 0,
          markCount: 0,
        };
      }
      classMap[key].studentNames.push(s.name);
    });

    const studentAttendMap: Record<string, { present: number; total: number; name: string; class: string }> = {};
    monthAttendance.forEach((a) => {
      const sid = String(a.studentId);
      const meta = studentMeta[sid];
      if (!meta || !classMap[meta.key]) return;
      classMap[meta.key].totalAttendanceDays++;
      if (a.status === "present") classMap[meta.key].presentDays++;
      if (!studentAttendMap[sid]) studentAttendMap[sid] = { present: 0, total: 0, name: meta.name, class: meta.class };
      studentAttendMap[sid].total++;
      if (a.status === "present") studentAttendMap[sid].present++;
    });

    const pendingByStudent: Record<string, { name: string; class: string; section: string; amount: number; items: string[] }> = {};
    fees.forEach((f) => {
      const student = f.student as unknown as { _id: string; name: string; class?: string; section?: string } | null;
      if (!student) return;
      const cls = student.class || "Unknown";
      const sec = student.section || "";
      const key = `${cls}${sec ? "-" + sec : ""}`;

      if (f.status !== "paid") {
        const amt = Math.max(0, (f.amount || 0) - (f.paidAmount || 0));
        if (classMap[key]) {
          classMap[key].pendingFees += amt;
          classMap[key].pendingFeeNames.add(student.name);
        }
        const sid = String(student._id);
        if (!pendingByStudent[sid]) pendingByStudent[sid] = { name: student.name, class: cls, section: sec, amount: 0, items: [] };
        pendingByStudent[sid].amount += amt;
        if (f.title) pendingByStudent[sid].items.push(`${f.title}: ₹${amt}`);
      }
    });

    results.forEach((r) => {
      const student = r.student as unknown as { _id: string; name: string; class?: string; section?: string } | null;
      if (!student) return;
      const cls = student.class || "Unknown";
      const sec = student.section || "";
      const key = `${cls}${sec ? "-" + sec : ""}`;
      if (classMap[key]) {
        classMap[key].markSum += r.percentage;
        classMap[key].markCount++;
      }
    });

    const classSummary = Object.values(classMap).map((c) => ({
      class: c.className,
      students: c.studentNames.length,
      studentNames: c.studentNames,
      attendancePct: c.totalAttendanceDays > 0 ? Math.round((c.presentDays / c.totalAttendanceDays) * 100) : null,
      pendingFees: Math.round(c.pendingFees),
      pendingFeeCount: c.pendingFeeNames.size,
      pendingFeeStudentNames: [...c.pendingFeeNames],
      avgMarks: c.markCount > 0 ? Math.round(c.markSum / c.markCount) : null,
    }));

    const pendingStudents = Object.values(pendingByStudent)
      .sort((a, b) => b.amount - a.amount)
      .map((p) => ({ ...p, amount: Math.round(p.amount) }));

    const lowAttendance = Object.values(studentAttendMap)
      .filter((s) => s.total > 0 && Math.round((s.present / s.total) * 100) < 75)
      .map((s) => ({ name: s.name, class: s.class, pct: Math.round((s.present / s.total) * 100) }))
      .sort((a, b) => a.pct - b.pct);

    const totalPending = pendingStudents.reduce((s, p) => s + p.amount, 0);
    const totalCollected = fees.filter((f) => f.status === "paid").reduce((s, f) => s + (f.paidAmount || 0), 0);

    return NextResponse.json({
      success: true,
      data: {
        totalStudents: students.length,
        totalTeachers: teachers.length,
        totalClasses: Object.keys(classMap).length,
        totalPending: Math.round(totalPending),
        totalCollected: Math.round(totalCollected),
        currentMonth: now.toLocaleString("en", { month: "long", year: "numeric" }),
        allStudents: students.map((s) => ({
          name: s.name,
          class: s.class || "Unknown",
          section: s.section || "",
          studentId: s.studentId || "",
          rollNumber: s.rollNumber || "",
        })),
        allTeachers: teachers.map((t) => ({
          name: t.name,
          designation: t.designation || "Teacher",
          subjects: t.subjects || [],
        })),
        classSummary,
        pendingFeeStudents: pendingStudents,
        lowAttendanceStudents: lowAttendance,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to build school context." },
      { status: 500 },
    );
  }
}
