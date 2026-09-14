import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Exam } from "@/models/Exam";
import { Result } from "@/models/Result";

function requireAdminOrTeacher(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) return null;
  return auth;
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAdminOrTeacher(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    const { id } = await params;
    await connectDB();

    const exam = await Exam.findOne({ _id: id, school: auth.schoolId });
    if (!exam) return NextResponse.json({ success: false, message: "Exam not found." }, { status: 404 });

    const resultCount = await Result.countDocuments({ exam: id });
    if (resultCount > 0) {
      return NextResponse.json(
        { success: false, message: `Cannot delete "${exam.title}" — ${resultCount} result(s) already entered.` },
        { status: 409 },
      );
    }

    await Exam.findOneAndDelete({ _id: id, school: auth.schoolId });
    return NextResponse.json({ success: true, message: "Exam deleted." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to delete exam." },
      { status: 500 },
    );
  }
}
