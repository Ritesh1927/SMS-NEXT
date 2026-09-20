import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Exam } from "@/models/Exam";
import { Result } from "@/models/Result";
import { Student } from "@/models/Student";

// GET /api/exams/[id]/roster — every active student in the exam's class
// (+section) plus their existing result for this exam, if any. Powers the
// marks-entry screen.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    await connectDB();

    const exam = await Exam.findOne({ _id: id, school: auth.schoolId });
    if (!exam) return NextResponse.json({ success: false, message: "Exam not found." }, { status: 404 });

    const studentQuery: Record<string, unknown> = { school: auth.schoolId, class: exam.class, isActive: true };
    if (exam.section) studentQuery.section = exam.section;
    const students = await Student.find(studentQuery).select("name studentId rollNumber").sort({ rollNumber: 1, name: 1 });

    const existingResults = await Result.find({ exam: id });
    const resultMap = new Map(existingResults.map((r) => [String(r.student), r]));

    const data = students.map((s) => {
      const result = resultMap.get(String(s._id));
      return {
        student: { _id: s._id, name: s.name, studentId: s.studentId, rollNumber: s.rollNumber },
        marksObtained: result?.marksObtained ?? null,
        remarks: result?.remarks ?? "",
      };
    });

    return NextResponse.json({
      success: true,
      data,
      exam: { title: exam.title, totalMarks: exam.totalMarks, subject: exam.subject, class: exam.class, section: exam.section },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load roster." },
      { status: 500 },
    );
  }
}
