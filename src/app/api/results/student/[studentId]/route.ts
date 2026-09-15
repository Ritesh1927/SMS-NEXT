import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Result } from "@/models/Result";
import { Parent } from "@/models/Parent";
import "@/models/Exam";

// GET /api/results/student/[studentId] — a student's results + average.
// SMS-BACKEND's getStudentResults lets ANY parent pass any studentId with
// no ownership check (role-restricted, not data-restricted) — the same gap
// fixed for attendance earlier. Restricting parents to their own linked
// children here too.
export async function GET(req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || !["schooladmin", "teacher", "parent"].includes(auth.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { studentId } = await params;
    await connectDB();

    if (auth.role === "parent") {
      const parentDoc = await Parent.findById(auth.id);
      const childIds = (parentDoc?.students || []).map((id) => String(id));
      if (!childIds.includes(studentId)) {
        return NextResponse.json({ success: false, message: "Access denied." }, { status: 403 });
      }
    }

    const results = await Result.find({ student: studentId, school: auth.schoolId })
      .populate("exam", "title subject date examType totalMarks")
      .sort({ createdAt: -1 });

    const avg = results.length > 0 ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length) : 0;
    return NextResponse.json({ success: true, data: { results, averagePercentage: avg } });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load results." },
      { status: 500 },
    );
  }
}
