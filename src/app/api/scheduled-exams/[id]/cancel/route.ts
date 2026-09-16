import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { ScheduledExam } from "@/models/ScheduledExam";
import { Exam } from "@/models/Exam";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { reason } = await req.json();
    if (!reason || !String(reason).trim()) {
      return NextResponse.json({ success: false, message: "Cancellation reason is required." }, { status: 400 });
    }

    await connectDB();
    const term = await ScheduledExam.findOne({ _id: id, school: auth.schoolId });
    if (!term) return NextResponse.json({ success: false, message: "Exam term not found." }, { status: 404 });
    if (term.status === "cancelled") {
      return NextResponse.json({ success: false, message: "Exam term is already cancelled." }, { status: 400 });
    }

    term.status = "cancelled";
    term.description = (term.description ? term.description + "\n\n" : "") + `[Cancelled] ${reason}`;
    await term.save();
    await Exam.updateMany({ scheduledExamId: term._id }, { status: "cancelled" });

    const populated = await ScheduledExam.findById(term._id).populate("createdBy", "name teacherId");
    return NextResponse.json({ success: true, message: "Exam term cancelled.", data: populated });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to cancel exam term." },
      { status: 500 },
    );
  }
}
