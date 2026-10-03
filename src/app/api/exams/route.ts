import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Exam } from "@/models/Exam";
import { Teacher } from "@/models/Teacher";
import { isSubjectTeacherOf } from "@/lib/teacherClasses";
import { calcDurationMinutes } from "@/lib/examTime";
import { postExamScheduleNotice } from "@/lib/examNotice";
import "@/models/Admin";

export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || !["schooladmin", "teacher", "parent"].includes(auth.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const cls = searchParams.get("class");
    const subject = searchParams.get("subject");
    const status = searchParams.get("status");

    const query: Record<string, unknown> = { school: auth.schoolId };
    if (cls) query.class = cls;
    if (subject) query.subject = subject;
    if (status) query.status = status;

    const exams = await Exam.find(query).populate("createdBy", "name teacherId").sort({ date: 1 });
    return NextResponse.json({ success: true, data: exams });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load exams." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();

    const { title, class: cls, section, subject, subjects, date, startTime, endTime, totalMarks, passingMarks, examType, instructions } =
      await req.json();
    // A "Test" can now be created for several subjects at once, each on its
    // own date and time window -- every subject still becomes its own Exam
    // doc (own roster/marks/results), same as ScheduledExam's per-subject
    // slots, just without the term wrapper. `subjects` here is
    // {name, date, startTime, endTime}[]; a plain string[] (each using the
    // shared top-level date/startTime/endTime) and the single `subject`
    // string are both kept working for older callers and PATCH-style
    // single-subject edits.
    type SubjectSlot = { name: string; date: string; startTime?: string; endTime?: string };
    const subjectList: SubjectSlot[] = Array.isArray(subjects) && subjects.length
      ? subjects.map((s: string | SubjectSlot) => (typeof s === "string" ? { name: s, date, startTime, endTime } : s))
      : subject
        ? [{ name: subject, date, startTime, endTime }]
        : [];
    if (!title || !cls || subjectList.length === 0 || subjectList.some((s) => !s.name || !s.date) || totalMarks === undefined || passingMarks === undefined) {
      return NextResponse.json(
        { success: false, message: "Title, class, at least one subject with a date, totalMarks and passingMarks are required." },
        { status: 400 },
      );
    }

    if (auth.role === "teacher") {
      const teacher = await Teacher.findById(auth.id).select("permissions");
      if (!teacher?.permissions?.canCreateExam) {
        // No blanket grant -- fall back to per-subject Timetable access, the
        // same auto-grant isSubjectTeacherOf already gives for marks entry
        // (see /api/exams/[id]/marks). Every subject in this request must
        // pass, not just one, since a single Test submission can cover
        // several subjects at once. Scoped to standalone Tests only -- a
        // multi-subject Exam term (/api/scheduled-exams) still requires the
        // blanket grant, unchanged.
        const uniqueSubjects = [...new Set(subjectList.map((s) => s.name))];
        const checks = await Promise.all(
          uniqueSubjects.map((name) => isSubjectTeacherOf(auth.id, auth.schoolId, cls, section || "", name)),
        );
        if (!checks.every(Boolean)) {
          return NextResponse.json(
            { success: false, message: "You can only create tests for a class and subject you teach." },
            { status: 403 },
          );
        }
      }
    }

    const created = await Promise.all(
      subjectList.map((slot) => {
        const hasTimes = !!slot.startTime && !!slot.endTime;
        return Exam.create({
          school: auth.schoolId,
          title,
          class: cls,
          section: section || "",
          subject: slot.name,
          date: slot.date,
          startTime: slot.startTime || "",
          endTime: slot.endTime || "",
          duration: hasTimes ? calcDurationMinutes(slot.startTime!, slot.endTime!) : null,
          totalMarks,
          passingMarks,
          examType: examType || "unit-test",
          instructions: instructions || "",
          createdBy: auth.id,
          createdByModel: auth.role === "schooladmin" ? "Admin" : "Teacher",
          status: "upcoming",
        });
      }),
    );

    if (subjectList.every((s) => s.startTime && s.endTime)) {
      await postExamScheduleNotice({
        schoolId: auth.schoolId,
        cls,
        examName: title,
        rows: subjectList.map((s) => ({ subject: s.name, date: s.date, startTime: s.startTime!, endTime: s.endTime! })),
        postedBy: auth.id,
        postedByModel: auth.role === "schooladmin" ? "Admin" : "Teacher",
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: created.length > 1 ? `${created.length} tests created.` : "Exam created.",
        data: created.length === 1 ? created[0] : created,
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to create exam." },
      { status: 500 },
    );
  }
}
