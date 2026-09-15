import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Result } from "@/models/Result";
import "@/models/Student";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    await connectDB();

    const results = await Result.find({ exam: id, school: auth.schoolId })
      .populate("student", "name studentId rollNumber class section")
      .sort({ marksObtained: -1 });

    const passed = results.filter((r) => r.isPassed).length;
    const avgPercentage =
      results.length > 0 ? Math.round(results.reduce((s, r) => s + r.percentage, 0) / results.length) : 0;

    return NextResponse.json({
      success: true,
      data: { results, summary: { total: results.length, passed, failed: results.length - passed, avgPercentage } },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load results." },
      { status: 500 },
    );
  }
}
