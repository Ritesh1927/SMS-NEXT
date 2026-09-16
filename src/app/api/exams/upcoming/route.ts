import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Exam, type IExam } from "@/models/Exam";
import { ScheduledExam } from "@/models/ScheduledExam";
import { Student } from "@/models/Student";
import { Parent } from "@/models/Parent";

// GET /api/exams/upcoming — a flat, countdown-ready list of upcoming exams
// for the parent-facing Exams page. Standalone exams and multi-subject exam
// terms are both just Exam documents here (a term's subjects share one
// scheduledExamId), so this needs no separate Test/ScheduledExam
// normalization the way SMS-BACKEND does — grouping by scheduledExamId
// produces the same "source: exam | scheduledExam" shape directly.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || !["schooladmin", "teacher", "parent"].includes(auth.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const classParam = searchParams.get("class");

    let cls: string | null = classParam;
    let section: string | null = null;

    if (auth.role === "parent") {
      if (!studentId) return NextResponse.json({ success: false, message: "studentId is required." }, { status: 400 });
      const parentDoc = await Parent.findById(auth.id);
      const childIds = (parentDoc?.students || []).map((id) => String(id));
      if (!childIds.includes(studentId)) {
        return NextResponse.json({ success: false, message: "Access denied." }, { status: 403 });
      }
      const student = await Student.findById(studentId).select("class section");
      if (!student) return NextResponse.json({ success: false, message: "Student not found." }, { status: 404 });
      cls = student.class;
      section = student.section || null;
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const query: Record<string, unknown> = { school: auth.schoolId, date: { $gte: todayStart }, status: "upcoming" };
    if (cls) query.class = cls;
    if (section) query.section = section;

    const exams = await Exam.find(query).sort({ date: 1 });

    const standalone = exams.filter((e) => !e.scheduledExamId);
    const grouped = new Map<string, IExam[]>();
    for (const e of exams) {
      if (!e.scheduledExamId) continue;
      const key = String(e.scheduledExamId);
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(e);
    }

    const terms = grouped.size > 0 ? await ScheduledExam.find({ _id: { $in: [...grouped.keys()] } }) : [];

    const standaloneItems = standalone.map((e) => ({
      _id: e._id,
      title: e.title,
      subject: e.subject,
      date: e.date,
      endDate: null,
      examType: e.examType,
      class: e.class,
      section: e.section,
      status: e.status,
      totalMarks: e.totalMarks,
      passingMarks: e.passingMarks,
      duration: e.duration,
      description: e.instructions || "",
      source: "exam" as const,
      subjects: [] as unknown[],
    }));

    const termItems = terms.map((term) => {
      const subjectExams = (grouped.get(String(term._id)) || []).sort((a, b) => a.date.getTime() - b.date.getTime());
      return {
        _id: term._id,
        title: term.title,
        subject: "",
        date: term.startDate,
        endDate: term.endDate,
        examType: term.examType,
        class: term.class,
        section: term.section,
        status: term.status,
        totalMarks: null,
        passingMarks: null,
        duration: null,
        description: term.description || "",
        source: "scheduledExam" as const,
        subjects: subjectExams.map((e) => ({
          _id: e._id,
          subject: e.subject,
          date: e.date,
          totalMarks: e.totalMarks,
          passingMarks: e.passingMarks,
          duration: e.duration,
        })),
      };
    });

    const normalized = [...standaloneItems, ...termItems]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .slice(0, 30);

    return NextResponse.json({ success: true, data: normalized });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load upcoming exams." },
      { status: 500 },
    );
  }
}
