import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { ExamChangeRequest } from "@/models/ExamChangeRequest";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { adminReply } = await req.json();
    if (!adminReply || !String(adminReply).trim()) {
      return NextResponse.json({ success: false, message: "Admin reply/reason is required for rejection." }, { status: 400 });
    }

    await connectDB();
    const request = await ExamChangeRequest.findOne({ _id: id, school: auth.schoolId });
    if (!request) return NextResponse.json({ success: false, message: "Change request not found." }, { status: 404 });
    if (request.status !== "pending") {
      return NextResponse.json({ success: false, message: "Request is already " + request.status }, { status: 400 });
    }

    const updated = await ExamChangeRequest.findByIdAndUpdate(
      id,
      { status: "rejected", adminReply, reviewedBy: auth.id, reviewedAt: new Date() },
      { returnDocument: "after" },
    );

    return NextResponse.json({ success: true, message: "Change request rejected.", data: updated });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to reject change request." },
      { status: 500 },
    );
  }
}
