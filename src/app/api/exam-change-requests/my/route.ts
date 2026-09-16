import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { ExamChangeRequest } from "@/models/ExamChangeRequest";

// GET /api/exam-change-requests/my — a teacher's own submitted requests.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const requests = await ExamChangeRequest.find({ school: auth.schoolId, requestedBy: auth.id }).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: requests });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load your change requests." },
      { status: 500 },
    );
  }
}
