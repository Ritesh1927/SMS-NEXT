import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Exam } from "@/models/Exam";

// Cancel a standalone exam (matches SMS-BACKEND's cancelTest) — sets status
// to cancelled with a reason instead of deleting it outright.
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
    const exam = await Exam.findOne({ _id: id, school: auth.schoolId });
    if (!exam) return NextResponse.json({ success: false, message: "Exam not found." }, { status: 404 });
    if (exam.status === "cancelled") {
      return NextResponse.json({ success: false, message: "Exam is already cancelled." }, { status: 400 });
    }

    exam.status = "cancelled";
    exam.instructions = (exam.instructions ? exam.instructions + "\n\n" : "") + `[Cancelled] ${reason}`;
    await exam.save();

    return NextResponse.json({ success: true, message: "Exam cancelled.", data: exam });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to cancel exam." },
      { status: 500 },
    );
  }
}
