import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { ScheduledExam } from "@/models/ScheduledExam";
import { Exam } from "@/models/Exam";
import { Result } from "@/models/Result";
import "@/models/Admin";
import "@/models/Teacher";
import { teacherHasAccessToClass } from "@/lib/teacherClasses";
import { calcDurationMinutes } from "@/lib/examTime";
import { Class } from "@/models/Class";

// Teachers can freely edit/delete a term up to 2 hours before it starts;
// past that they must go through the ExamChangeRequest workflow. Matches
// SMS-BACKEND's edit-window check on scheduledexam.controller.
function editWindowOpen(startDate: Date) {
  const twoHoursBefore = new Date(startDate.getTime() - 2 * 60 * 60 * 1000);
  return new Date() <= twoHoursBefore;
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    await connectDB();

    const term = await ScheduledExam.findOne({ _id: id, school: auth.schoolId }).populate("createdBy", "name teacherId");
    if (!term) return NextResponse.json({ success: false, message: "Exam term not found." }, { status: 404 });

    const subjects = await Exam.find({ scheduledExamId: term._id }).sort({ date: 1 });
    return NextResponse.json({ success: true, data: { ...term.toObject(), subjects } });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load exam term." },
      { status: 500 },
    );
  }
}

interface SubjectInput {
  subject: string;
  date: string;
  totalMarks: number;
  startTime: string;
  endTime: string;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    await connectDB();

    const existing = await ScheduledExam.findOne({ _id: id, school: auth.schoolId });
    if (!existing) return NextResponse.json({ success: false, message: "Exam term not found." }, { status: 404 });

    const { title, class: cls, examType, startDate, endDate, description, status, subjects } = await req.json();

    if (auth.role === "teacher") {
      const allowed = await teacherHasAccessToClass(auth.id, auth.schoolId, existing.class);
      if (!allowed) return NextResponse.json({ success: false, message: "Access denied." }, { status: 403 });
      if (cls && !(await teacherHasAccessToClass(auth.id, auth.schoolId, cls))) {
        return NextResponse.json({ success: false, message: "You can only assign exams to your classes." }, { status: 403 });
      }
      if (!editWindowOpen(existing.startDate)) {
        return NextResponse.json(
          { success: false, message: "Cannot edit exam within 2 hours of start time. Please submit a change request instead." },
          { status: 403 },
        );
      }
    }

    const updates: Record<string, unknown> = {};
    if (title !== undefined) updates.title = title;
    if (cls !== undefined) updates.class = cls;
    if (examType !== undefined) updates.examType = examType;
    if (startDate !== undefined) updates.startDate = startDate;
    if (endDate !== undefined) updates.endDate = endDate;
    if (description !== undefined) updates.description = description;
    if (status !== undefined) updates.status = status;

    const term = await ScheduledExam.findOneAndUpdate({ _id: id, school: auth.schoolId }, updates, {
      returnDocument: "after",
    }).populate("createdBy", "name teacherId");
    if (!term) return NextResponse.json({ success: false, message: "Exam term not found." }, { status: 404 });

    let subjectExams = await Exam.find({ scheduledExamId: term._id }).sort({ date: 1 });

    if (Array.isArray(subjects)) {
      // Simplest safe sync: drop subject-exams with no results yet and
      // rebuild from the submitted list; keep any that already have marks
      // entered so grading work is never silently destroyed.
      const existingSubjects = await Exam.find({ scheduledExamId: term._id });
      const withResults = new Set(
        (await Result.find({ exam: { $in: existingSubjects.map((e) => e._id) } }).select("exam")).map((r) => String(r.exam)),
      );
      const toDelete = existingSubjects.filter((e) => !withResults.has(String(e._id)));
      if (toDelete.length > 0) {
        await Exam.deleteMany({ _id: { $in: toDelete.map((e) => e._id) } });
      }

      const examTypeMap: Record<string, string> = { midterm: "mid-term", final: "final", unit: "unit-test", annual: "final" };
      const mappedType = examTypeMap[term.examType] || "unit-test";

      // The term spans every section of its standard, not just term.section
      // (which is always "" for a standard-wide term) -- resolve the real
      // section list from the standard's classes, same as creation does.
      const sectionDocs = await Class.find({ school: auth.schoolId, name: term.class }).select("section");
      const sections = sectionDocs.length > 0 ? sectionDocs.map((c) => c.section) : [term.section];

      await Exam.insertMany(
        sections.flatMap((section) =>
          (subjects as SubjectInput[]).map((s) => ({
            school: auth.schoolId,
            title: `${term.title} — ${s.subject}`,
            class: term.class,
            section,
            subject: s.subject,
            date: s.date,
            startTime: s.startTime || "",
            endTime: s.endTime || "",
            totalMarks: s.totalMarks,
            passingMarks: Math.round(s.totalMarks * 0.33),
            duration: s.startTime && s.endTime ? calcDurationMinutes(s.startTime, s.endTime) : null,
            examType: mappedType,
            createdBy: auth.id,
            createdByModel: auth.role === "schooladmin" ? "Admin" : "Teacher",
            status: "upcoming",
            scheduledExamId: term._id,
          })),
        ),
      );
      subjectExams = await Exam.find({ scheduledExamId: term._id }).sort({ date: 1 });
    }

    return NextResponse.json({ success: true, message: "Exam term updated.", data: { ...term.toObject(), subjects: subjectExams } });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to update exam term." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    await connectDB();

    const existing = await ScheduledExam.findOne({ _id: id, school: auth.schoolId });
    if (!existing) return NextResponse.json({ success: false, message: "Exam term not found." }, { status: 404 });

    if (auth.role === "teacher") {
      const allowed = await teacherHasAccessToClass(auth.id, auth.schoolId, existing.class);
      if (!allowed) return NextResponse.json({ success: false, message: "Access denied." }, { status: 403 });
      if (!editWindowOpen(existing.startDate)) {
        return NextResponse.json(
          { success: false, message: "Cannot delete exam within 2 hours of start time. Please submit a change request instead." },
          { status: 403 },
        );
      }
    }

    const subjectExams = await Exam.find({ scheduledExamId: id }).select("_id");
    const subjectIds = subjectExams.map((e) => e._id);
    const resultCount = await Result.countDocuments({ exam: { $in: subjectIds } });
    if (resultCount > 0) {
      return NextResponse.json(
        { success: false, message: `Cannot delete "${existing.title}" — ${resultCount} result(s) already entered.` },
        { status: 409 },
      );
    }

    await Exam.deleteMany({ _id: { $in: subjectIds } });
    await ScheduledExam.findOneAndDelete({ _id: id, school: auth.schoolId });
    return NextResponse.json({ success: true, message: "Exam term deleted." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to delete exam term." },
      { status: 500 },
    );
  }
}
