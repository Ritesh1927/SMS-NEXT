import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Result } from "@/models/Result";
import { AttendanceRecord } from "@/models/AttendanceRecord";
import { Student } from "@/models/Student";
import { Parent } from "@/models/Parent";
// Side-effect import so populate("exam", "subject") can resolve the Exam ref.
import "@/models/Exam";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function calcGrade(pct: number): string {
  if (pct >= 90) return "A+";
  if (pct >= 80) return "A";
  if (pct >= 70) return "B+";
  if (pct >= 60) return "B";
  if (pct >= 50) return "C";
  return "F";
}

function pctToGpa(pct: number): string {
  return (pct / 10).toFixed(2);
}

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return s[(v - 20) % 10] || s[v] || s[0];
}

// GET /api/progress/student/[studentId] — a parent's view of one child's
// progress. SMS-BACKEND's getStudentProgress assumes the caller IS the
// student (req.user._id), so this substitutes the same parent+ownership
// pattern used elsewhere. One real improvement over the original: its
// subjectData.classAvg is hardcoded to 0 with a comment admitting "requires
// fetching all students — left as 0". That data (Result + the child's
// classmates) is already being queried here anyway, so this computes the
// real per-subject class average instead of porting the stub.
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

    const results = await Result.find({ student: studentId }).populate("exam", "subject").sort({ createdAt: -1 });

    // Classmates' results, for real per-subject class averages.
    let classResults: { student: unknown; subject: string; percentage: number }[] = [];
    if (student.class) {
      const classmateQuery: Record<string, unknown> = { school: auth.schoolId, class: student.class, isActive: true, _id: { $ne: studentId } };
      if (student.section) classmateQuery.section = student.section;
      const classmates = await Student.find(classmateQuery).select("_id");
      const classmateIds = classmates.map((c) => c._id);
      const classmateResults = await Result.find({ student: { $in: classmateIds } }).populate("exam", "subject");
      classResults = classmateResults.map((r) => ({
        student: r.student,
        subject: (r.exam as unknown as { subject?: string } | null)?.subject || "General",
        percentage: r.percentage,
      }));
    }

    const subjMap: Record<string, number[]> = {};
    results.forEach((r) => {
      const subject = (r.exam as unknown as { subject?: string } | null)?.subject || "General";
      if (!subjMap[subject]) subjMap[subject] = [];
      subjMap[subject].push(r.percentage);
    });

    const classAvgMap: Record<string, number[]> = {};
    classResults.forEach((r) => {
      if (!classAvgMap[r.subject]) classAvgMap[r.subject] = [];
      classAvgMap[r.subject].push(r.percentage);
    });

    const subjectData = Object.entries(subjMap).map(([subject, scores]) => {
      const score = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
      const classScores = classAvgMap[subject] || [];
      const classAvg = classScores.length > 0 ? Math.round(classScores.reduce((a, b) => a + b, 0) / classScores.length) : 0;
      return { subject, score, classAvg, grade: calcGrade(score) };
    });

    const avgScore = results.length > 0 ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length) : 0;
    const overallGPA = pctToGpa(avgScore);

    const remarks = results
      .filter((r) => r.remarks && r.remarks.trim())
      .slice(0, 6)
      .map((r) => {
        const timestamps = r as unknown as { updatedAt?: Date; createdAt?: Date };
        return {
          date: (timestamps.updatedAt || timestamps.createdAt)?.toISOString().slice(0, 10) || "",
          teacher: "Teacher",
          subject: (r.exam as unknown as { subject?: string } | null)?.subject || "General",
          remark: r.remarks,
          positive: r.isPassed,
        };
      });

    const year = new Date().getFullYear();
    const attRecords = await AttendanceRecord.find({
      studentId,
      date: { $gte: new Date(year, 0, 1), $lte: new Date(year, 11, 31, 23, 59, 59) },
    });

    const monthly: Record<number, { present: number; total: number }> = {};
    attRecords.forEach((r) => {
      const m = new Date(r.date).getMonth();
      if (!monthly[m]) monthly[m] = { present: 0, total: 0 };
      monthly[m].total++;
      if (r.status === "present" || r.status === "late") monthly[m].present++;
    });

    const performanceTrend = Object.entries(monthly)
      .sort(([a], [b]) => Number(a) - Number(b))
      .map(([m, v]) => ({ month: MONTHS[Number(m)], score: v.total > 0 ? Math.round((v.present / v.total) * 100) : 0 }));

    let rank = "—";
    if (results.length > 0 && student.class) {
      const classmateQuery: Record<string, unknown> = { school: auth.schoolId, class: student.class, isActive: true, _id: { $ne: studentId } };
      if (student.section) classmateQuery.section = student.section;
      const classmates = await Student.find(classmateQuery).select("_id");
      const cmIds = classmates.map((c) => c._id);
      const cmResults = await Result.aggregate([
        { $match: { student: { $in: cmIds } } },
        { $group: { _id: "$student", avg: { $avg: "$percentage" } } },
      ]);
      const higherCount = cmResults.filter((c) => c.avg > avgScore).length;
      rank = `${higherCount + 1}${ordinal(higherCount + 1)}`;
    }

    return NextResponse.json({
      success: true,
      data: {
        overallGPA,
        rank,
        subjectCount: subjectData.length,
        avgScore: `${avgScore}%`,
        performanceTrend,
        subjectData,
        remarks,
        hasResults: results.length > 0,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load progress." },
      { status: 500 },
    );
  }
}
