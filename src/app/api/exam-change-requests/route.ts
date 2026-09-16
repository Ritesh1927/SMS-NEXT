import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { ExamChangeRequest } from "@/models/ExamChangeRequest";
import { Exam } from "@/models/Exam";
import { ScheduledExam } from "@/models/ScheduledExam";
import "@/models/Teacher";
import "@/models/Admin";

// GET /api/exam-change-requests — admin-only inbox of all change requests.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");

    const query: Record<string, unknown> = { school: auth.schoolId };
    if (status) query.status = status;

    const requests = await ExamChangeRequest.find(query)
      .populate("requestedBy", "name email teacherId")
      .populate("reviewedBy", "name")
      .sort({ createdAt: -1 });

    return NextResponse.json({ success: true, data: requests });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load change requests." },
      { status: 500 },
    );
  }
}

// POST /api/exam-change-requests — teacher submits a request to edit a
// locked exam/exam-term. sourceType "exam" covers both a standalone exam
// and one subject-slot of a term (both are just Exam documents here).
export async function POST(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { sourceType, sourceId, reason, requestedChanges } = await req.json();
    if (!sourceType || !sourceId || !reason || !requestedChanges) {
      return NextResponse.json(
        { success: false, message: "sourceType, sourceId, reason, and requestedChanges are required." },
        { status: 400 },
      );
    }
    if (!["exam", "scheduledExam"].includes(sourceType)) {
      return NextResponse.json({ success: false, message: "sourceType must be 'exam' or 'scheduledExam'." }, { status: 400 });
    }

    await connectDB();

    let currentData: Record<string, unknown>;
    if (sourceType === "exam") {
      const exam = await Exam.findOne({ _id: sourceId, school: auth.schoolId });
      if (!exam) return NextResponse.json({ success: false, message: "Exam not found." }, { status: 404 });
      currentData = { title: exam.title, date: exam.date, totalMarks: exam.totalMarks, duration: exam.duration };
    } else {
      const term = await ScheduledExam.findOne({ _id: sourceId, school: auth.schoolId });
      if (!term) return NextResponse.json({ success: false, message: "Exam term not found." }, { status: 404 });
      currentData = { title: term.title, startDate: term.startDate, endDate: term.endDate, examType: term.examType };
    }

    const existingPending = await ExamChangeRequest.findOne({
      school: auth.schoolId,
      sourceType,
      ...(sourceType === "exam" ? { examId: sourceId } : { scheduledExamId: sourceId }),
      status: "pending",
    });
    if (existingPending) {
      return NextResponse.json({ success: false, message: "A pending change request already exists for this item." }, { status: 400 });
    }

    const request = await ExamChangeRequest.create({
      school: auth.schoolId,
      sourceType,
      ...(sourceType === "exam" ? { examId: sourceId } : { scheduledExamId: sourceId }),
      requestedBy: auth.id,
      reason,
      currentData,
      requestedChanges,
    });

    return NextResponse.json(
      { success: true, message: "Change request submitted. Waiting for admin approval.", data: request },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to submit change request." },
      { status: 500 },
    );
  }
}
