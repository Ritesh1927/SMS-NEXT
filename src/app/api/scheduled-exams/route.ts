import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { ScheduledExam } from "@/models/ScheduledExam";
import { Exam } from "@/models/Exam";
import { Teacher } from "@/models/Teacher";
import { Class } from "@/models/Class";
import "@/models/Admin";
import { getTeacherAccessibleClasses, teacherHasAccessToClass } from "@/lib/teacherClasses";
import { calcDurationMinutes } from "@/lib/examTime";
import { postExamScheduleNotice } from "@/lib/examNotice";

const EXAM_TYPE_MAP: Record<string, string> = {
  midterm: "mid-term",
  final: "final",
  unit: "unit-test",
  annual: "final",
};

interface SubjectInput {
  subject: string;
  date: string;
  totalMarks: number;
  startTime: string;
  endTime: string;
}

// GET /api/scheduled-exams — multi-subject exam terms. Teachers only see
// terms for classes they can access (class teacher or assignedClasses),
// matching SMS-BACKEND's scheduledexam.controller scoping.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const cls = searchParams.get("class");

    const query: Record<string, unknown> = { school: auth.schoolId };
    if (auth.role === "teacher") {
      const accessible = await getTeacherAccessibleClasses(auth.id, auth.schoolId);
      if (accessible.length === 0) return NextResponse.json({ success: true, data: [] });
      query.$or = accessible.map((c) => ({ class: c.name, section: c.section }));
    } else if (cls) {
      query.class = cls;
    }

    const terms = await ScheduledExam.find(query).populate("createdBy", "name teacherId").sort({ startDate: 1 });
    return NextResponse.json({ success: true, data: terms });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load exam terms." },
      { status: 500 },
    );
  }
}

// POST /api/scheduled-exams — creates the term plus one Exam record per
// subject (each Exam.scheduledExamId points back to the term), so marks
// entry/results/publish reuse the existing single-exam routes unchanged.
export async function POST(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();

    if (auth.role === "teacher") {
      const teacher = await Teacher.findById(auth.id).select("permissions");
      if (!teacher?.permissions?.canCreateExam) {
        return NextResponse.json({ success: false, message: "You don't have permission to create exams." }, { status: 403 });
      }
    }

    const { title, class: cls, examType, startDate, endDate, description, subjects } = await req.json();
    if (!title || !cls || !examType || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, message: "title, class, examType, startDate and endDate are required." },
        { status: 400 },
      );
    }
    if (!Array.isArray(subjects) || subjects.length === 0) {
      return NextResponse.json(
        { success: false, message: "At least one subject with date, totalMarks and duration is required." },
        { status: 400 },
      );
    }

    if (auth.role === "teacher") {
      const allowed = await teacherHasAccessToClass(auth.id, auth.schoolId, cls);
      if (!allowed) {
        return NextResponse.json({ success: false, message: "You can only create exams for your classes." }, { status: 403 });
      }
    }

    // An exam is created for the whole standard, not one section -- every
    // section gets its own Exam doc per subject, all sharing this one term.
    const sectionDocs = await Class.find({ school: auth.schoolId, name: cls }).select("section");
    if (sectionDocs.length === 0) {
      return NextResponse.json({ success: false, message: `No classes found for standard ${cls}.` }, { status: 404 });
    }
    const sections = sectionDocs.map((c) => c.section);

    const term = await ScheduledExam.create({
      school: auth.schoolId,
      title,
      class: cls,
      section: "",
      examType,
      startDate,
      endDate,
      description: description || "",
      createdBy: auth.id,
      createdByModel: auth.role === "schooladmin" ? "Admin" : "Teacher",
    });

    const examType_ = EXAM_TYPE_MAP[examType] || "unit-test";
    const subjectExams = await Exam.insertMany(
      sections.flatMap((section) =>
        (subjects as SubjectInput[]).map((s) => ({
          school: auth.schoolId,
          title: `${title} — ${s.subject}`,
          class: cls,
          section,
          subject: s.subject,
          date: s.date,
          startTime: s.startTime || "",
          endTime: s.endTime || "",
          totalMarks: s.totalMarks,
          passingMarks: Math.round(s.totalMarks * 0.33),
          duration: s.startTime && s.endTime ? calcDurationMinutes(s.startTime, s.endTime) : null,
          examType: examType_,
          createdBy: auth.id,
          createdByModel: auth.role === "schooladmin" ? "Admin" : "Teacher",
          status: "upcoming",
          scheduledExamId: term._id,
        })),
      ),
    );

    if ((subjects as SubjectInput[]).every((s) => s.startTime && s.endTime)) {
      await postExamScheduleNotice({
        schoolId: auth.schoolId,
        cls,
        examName: title,
        rows: (subjects as SubjectInput[]).map((s) => ({ subject: s.subject, date: s.date, startTime: s.startTime, endTime: s.endTime })),
        postedBy: auth.id,
        postedByModel: auth.role === "schooladmin" ? "Admin" : "Teacher",
      });
    }

    const populated = await ScheduledExam.findById(term._id).populate("createdBy", "name teacherId");
    return NextResponse.json(
      { success: true, message: "Exam term created.", data: { ...populated!.toObject(), subjects: subjectExams } },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to create exam term." },
      { status: 500 },
    );
  }
}
