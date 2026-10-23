import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser, getNonTeachingStaffSections } from "@/lib/auth-server";
import { Exam } from "@/models/Exam";
import { Result } from "@/models/Result";
import { Student } from "@/models/Student";
import { getCurrentAcademicYear } from "@/lib/academicYear";

// GET /api/exams/[id]/roster — every student with a stake in this exam,
// plus their existing result, if any. Powers the marks-entry/results screen.
// For the exam's own (current) year this is every active student currently
// in its class+section, same as always. For a past year it's whoever
// actually has a Result recorded against this exam instead -- the live
// Student.class/section no longer reflects where they sat it once a year
// has ended and they've likely been promoted elsewhere, so re-querying by
// class/section would wrongly show an empty (or someone else's) roster.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    await connectDB();

    const staffSections = await getNonTeachingStaffSections(auth);
    if (staffSections && !staffSections.exams?.open) {
      return NextResponse.json({ success: false, message: "You don't have permission to do this." }, { status: 403 });
    }

    const exam = await Exam.findOne({ _id: id, school: auth.schoolId });
    if (!exam) return NextResponse.json({ success: false, message: "Exam not found." }, { status: 404 });

    const existingResults = await Result.find({ exam: id });
    const resultMap = new Map(existingResults.map((r) => [String(r.student), r]));

    const currentYear = await getCurrentAcademicYear(auth.schoolId);
    const isPastYear = !!exam.academicYear && exam.academicYear !== currentYear;

    const studentQuery: Record<string, unknown> = isPastYear
      ? { _id: { $in: existingResults.map((r) => r.student) }, school: auth.schoolId }
      : { school: auth.schoolId, class: exam.class, isActive: true };
    if (!isPastYear && exam.section) studentQuery.section = exam.section;
    // rollNumber is a plain "1", "2", "3"... string, so sorting by it
    // lexicographically would put "10" before "2" — sort by name instead,
    // which is equivalent now that roll number always tracks name order.
    const students = await Student.find(studentQuery).select("name studentId rollNumber").collation({ locale: "en" }).sort({ name: 1 });

    const data = students.map((s) => {
      const result = resultMap.get(String(s._id));
      return {
        student: { _id: s._id, name: s.name, studentId: s.studentId, rollNumber: s.rollNumber },
        marksObtained: result?.marksObtained ?? null,
        remarks: result?.remarks ?? "",
        isAbsent: result?.isAbsent ?? false,
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
