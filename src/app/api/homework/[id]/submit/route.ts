import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Homework } from "@/models/Homework";
import { Student } from "@/models/Student";
import { Parent } from "@/models/Parent";

// POST /api/homework/[id]/submit — parent-only (no student self-login here;
// see the investigation before the Attendance feature). Mirrors
// SMS-BACKEND's own parent branch of submitHomework, which was already
// written for a school that only issues parent accounts — a parent submits
// on behalf of one of their own children, named explicitly by studentId.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "parent") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { studentId, note } = await req.json();
    if (!studentId) {
      return NextResponse.json({ success: false, message: "studentId is required." }, { status: 400 });
    }

    await connectDB();

    const parent = await Parent.findById(auth.id).select("students");
    const owns = parent?.students?.some((s) => String(s) === studentId);
    if (!owns) {
      return NextResponse.json({ success: false, message: "This student is not linked to your account." }, { status: 403 });
    }

    const hw = await Homework.findOne({ _id: id, school: auth.schoolId });
    if (!hw) return NextResponse.json({ success: false, message: "Homework not found." }, { status: 404 });

    const alreadySubmitted = hw.submissions.find((s) => String(s.student) === studentId);
    if (alreadySubmitted) {
      return NextResponse.json({ success: false, message: "Already submitted." }, { status: 400 });
    }

    const isLate = new Date() > new Date(hw.dueDate);
    hw.submissions.push({
      student: studentId,
      submittedAt: new Date(),
      note: note || "",
      status: isLate ? "late" : "submitted",
      marks: null,
      feedback: "",
    });
    await hw.save();
    await Student.findByIdAndUpdate(studentId, { $inc: { points: isLate ? 1 : 3 } });

    return NextResponse.json({ success: true, message: isLate ? "Submitted (late)." : "Homework submitted!" });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to submit homework." },
      { status: 500 },
    );
  }
}
