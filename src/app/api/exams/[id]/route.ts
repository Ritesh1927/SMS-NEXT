import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Exam } from "@/models/Exam";
import { Result } from "@/models/Result";
import { teacherHasAccessToClass } from "@/lib/teacherClasses";
import { calcDurationMinutes } from "@/lib/examTime";

function requireAdminOrTeacher(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) return null;
  return auth;
}

// Teachers can freely edit/delete an exam up to 2 hours before it starts;
// past that they must go through the ExamChangeRequest workflow. A
// scheduledExamId-linked exam (a term's subject slot) is edited via the
// term instead, so this only applies to standalone exams.
function editWindowOpen(date: Date) {
  const twoHoursBefore = new Date(date.getTime() - 2 * 60 * 60 * 1000);
  return new Date() <= twoHoursBefore;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAdminOrTeacher(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    const { id } = await params;
    await connectDB();

    const existing = await Exam.findOne({ _id: id, school: auth.schoolId });
    if (!existing) return NextResponse.json({ success: false, message: "Exam not found." }, { status: 404 });
    if (existing.scheduledExamId) {
      return NextResponse.json(
        { success: false, message: "This exam is part of a multi-subject exam term — edit it from there." },
        { status: 400 },
      );
    }

    const body = await req.json();

    if (auth.role === "teacher") {
      const allowed = await teacherHasAccessToClass(auth.id, auth.schoolId, existing.class);
      if (!allowed) return NextResponse.json({ success: false, message: "Access denied." }, { status: 403 });
      if (body.class && !(await teacherHasAccessToClass(auth.id, auth.schoolId, body.class))) {
        return NextResponse.json({ success: false, message: "You can only assign exams to your classes." }, { status: 403 });
      }
      if (!editWindowOpen(existing.date)) {
        return NextResponse.json(
          { success: false, message: "Cannot edit exam within 2 hours of start time. Please submit a change request instead." },
          { status: 403 },
        );
      }
    }

    const allowedFields = [
      "title", "class", "section", "subject", "date", "startTime", "endTime",
      "totalMarks", "passingMarks", "duration", "examType", "instructions", "status",
    ] as const;
    const updates: Record<string, unknown> = {};
    for (const key of allowedFields) {
      if (body[key] !== undefined) updates[key] = body[key];
    }
    // Duration always derives from the times, never entered directly.
    if (body.startTime && body.endTime) updates.duration = calcDurationMinutes(body.startTime, body.endTime);

    const exam = await Exam.findOneAndUpdate({ _id: id, school: auth.schoolId }, updates, { returnDocument: "after" });
    return NextResponse.json({ success: true, message: "Exam updated.", data: exam });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to update exam." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAdminOrTeacher(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    const { id } = await params;
    await connectDB();

    const exam = await Exam.findOne({ _id: id, school: auth.schoolId });
    if (!exam) return NextResponse.json({ success: false, message: "Exam not found." }, { status: 404 });

    if (auth.role === "teacher" && !exam.scheduledExamId) {
      const allowed = await teacherHasAccessToClass(auth.id, auth.schoolId, exam.class);
      if (!allowed) return NextResponse.json({ success: false, message: "Access denied." }, { status: 403 });
      if (!editWindowOpen(exam.date)) {
        return NextResponse.json(
          { success: false, message: "Cannot delete exam within 2 hours of start time. Please submit a change request instead." },
          { status: 403 },
        );
      }
    }

    const resultCount = await Result.countDocuments({ exam: id });
    if (resultCount > 0) {
      return NextResponse.json(
        { success: false, message: `Cannot delete "${exam.title}" — ${resultCount} result(s) already entered.` },
        { status: 409 },
      );
    }

    await Exam.findOneAndDelete({ _id: id, school: auth.schoolId });
    return NextResponse.json({ success: true, message: "Exam deleted." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to delete exam." },
      { status: 500 },
    );
  }
}
