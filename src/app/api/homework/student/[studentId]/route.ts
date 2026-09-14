import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Homework } from "@/models/Homework";
import { Student } from "@/models/Student";
import { Parent } from "@/models/Parent";

// GET /api/homework/student/[studentId] — a parent's view of one child's
// homework. Not present as its own endpoint in SMS-BACKEND (its
// getHomework only branches on student/teacher/admin, no parent case, and
// getPendingHomework assumes req.user is the student) — this fills that gap
// the same way other parent-facing views here do: fetch by the child's
// class, gated by an ownership check.
export async function GET(req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "parent") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { studentId } = await params;
    await connectDB();

    const parentDoc = await Parent.findById(auth.id).select("students");
    const owns = parentDoc?.students?.some((s) => String(s) === studentId);
    if (!owns) {
      return NextResponse.json({ success: false, message: "Access denied." }, { status: 403 });
    }

    const student = await Student.findById(studentId).select("class section");
    if (!student) return NextResponse.json({ success: false, message: "Student not found." }, { status: 404 });

    const query: Record<string, unknown> = { school: auth.schoolId, isActive: true, class: student.class };
    if (student.section) query.section = student.section;

    const hw = await Homework.find(query).populate("assignedBy", "name teacherId").sort({ dueDate: 1 });

    const data = hw.map((h) => {
      const submission = h.submissions.find((s) => String(s.student) === studentId) || null;
      return {
        _id: h._id,
        title: h.title,
        description: h.description,
        subject: h.subject,
        dueDate: h.dueDate,
        maxMarks: h.maxMarks,
        assignedBy: h.assignedBy,
        submission,
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load homework." },
      { status: 500 },
    );
  }
}
