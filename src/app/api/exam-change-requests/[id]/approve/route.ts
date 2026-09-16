import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { ExamChangeRequest } from "@/models/ExamChangeRequest";
import { Exam } from "@/models/Exam";
import { ScheduledExam } from "@/models/ScheduledExam";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { adminReply } = await req.json();

    await connectDB();
    const request = await ExamChangeRequest.findOne({ _id: id, school: auth.schoolId });
    if (!request) return NextResponse.json({ success: false, message: "Change request not found." }, { status: 404 });
    if (request.status !== "pending") {
      return NextResponse.json({ success: false, message: "Request is already " + request.status }, { status: 400 });
    }

    if (request.sourceType === "exam") {
      await Exam.findByIdAndUpdate(request.examId, request.requestedChanges);
    } else {
      await ScheduledExam.findByIdAndUpdate(request.scheduledExamId, request.requestedChanges);
    }

    const updated = await ExamChangeRequest.findByIdAndUpdate(
      id,
      { status: "approved", adminReply: adminReply || "", reviewedBy: auth.id, reviewedAt: new Date() },
      { returnDocument: "after" },
    );

    return NextResponse.json({ success: true, message: "Change request approved and applied.", data: updated });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to approve change request." },
      { status: 500 },
    );
  }
}
