import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Result } from "@/models/Result";
import { Parent } from "@/models/Parent";
import "@/models/Exam";
import "@/models/ScheduledExam";

// GET /api/results/student/[studentId] — a student's results + average.
// SMS-BACKEND's getStudentResults lets ANY parent pass any studentId with
// no ownership check (role-restricted, not data-restricted) — the same gap
// fixed for attendance earlier. Restricting parents to their own linked
// children here too.
export async function GET(req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || !["schooladmin", "teacher", "parent"].includes(auth.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { studentId } = await params;
    await connectDB();

    const query: Record<string, unknown> = { student: studentId, school: auth.schoolId };
    if (auth.role === "parent") {
      const parentDoc = await Parent.findById(auth.id);
      const childIds = (parentDoc?.students || []).map((id) => String(id));
      if (!childIds.includes(studentId)) {
        return NextResponse.json({ success: false, message: "Access denied." }, { status: 403 });
      }
      // Parents only ever see published results -- a "Save" is a draft the
      // subject teacher is still working on, not yet meant to be visible.
      query.isPublished = true;
    }

    const results = await Result.find(query)
      .populate({
        path: "exam",
        select: "title subject date examType totalMarks scheduledExamId",
        populate: { path: "scheduledExamId", select: "title" },
      })
      .sort({ createdAt: -1 });

    // Absent subjects don't count against the average -- they're excluded
    // from academic performance, not a zero.
    const attempted = results.filter((r) => !r.isAbsent);
    const avg = attempted.length > 0 ? Math.round(attempted.reduce((s, r) => s + r.percentage, 0) / attempted.length) : 0;

    // Groups every subject's Result under the multi-subject exam it belongs
    // to (a "term" — see ScheduledExam) so a parent sees one row per exam
    // instead of one row per subject; a standalone single-subject test is
    // just a group of one. Sorted newest-first by each group's latest result.
    type PopulatedExam = { _id: unknown; title: string; subject: string; date: Date; examType: string; totalMarks: number; scheduledExamId: { _id: unknown; title: string } | null };
    const groups = new Map<string, { groupId: string; title: string; date: Date; isTerm: boolean; rows: typeof results }>();
    for (const r of results) {
      const exam = r.exam as unknown as PopulatedExam | null;
      if (!exam) continue;
      const term = exam.scheduledExamId;
      const groupId = term ? String(term._id) : String(exam._id);
      const existing = groups.get(groupId);
      if (existing) {
        existing.rows.push(r);
        if (exam.date < existing.date) existing.date = exam.date;
      } else {
        groups.set(groupId, {
          groupId,
          title: term ? term.title : exam.title,
          date: exam.date,
          isTerm: !!term,
          rows: [r],
        });
      }
    }
    const groupList = [...groups.values()].sort((a, b) => b.date.getTime() - a.date.getTime());

    return NextResponse.json({ success: true, data: { results, groups: groupList, averagePercentage: avg } });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load results." },
      { status: 500 },
    );
  }
}
