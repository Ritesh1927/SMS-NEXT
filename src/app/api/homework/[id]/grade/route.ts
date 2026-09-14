import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Homework } from "@/models/Homework";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { studentId, marks, feedback } = await req.json();
    if (!studentId) {
      return NextResponse.json({ success: false, message: "studentId is required." }, { status: 400 });
    }

    await connectDB();
    const hw = await Homework.findOne({ _id: id, school: auth.schoolId });
    if (!hw) return NextResponse.json({ success: false, message: "Homework not found." }, { status: 404 });

    const sub = hw.submissions.find((s) => String(s.student) === studentId);
    if (!sub) return NextResponse.json({ success: false, message: "Submission not found." }, { status: 404 });

    sub.marks = marks;
    sub.feedback = feedback || "";
    sub.status = "graded";
    await hw.save();

    return NextResponse.json({ success: true, message: "Graded." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to grade submission." },
      { status: 500 },
    );
  }
}
