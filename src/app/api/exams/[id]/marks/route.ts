import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Exam } from "@/models/Exam";
import { Result } from "@/models/Result";
import { Student } from "@/models/Student";
import { Teacher } from "@/models/Teacher";
import { isSubjectTeacherOf } from "@/lib/teacherClasses";

// POST /api/exams/[id]/marks — bulk-save marks for an exam (upsert per
// student), mirroring SMS-BACKEND's enterMarks: marks the exam completed
// and awards bonus points/badges for strong scores.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    await connectDB();

    const exam = await Exam.findOne({ _id: id, school: auth.schoolId });
    if (!exam) return NextResponse.json({ success: false, message: "Exam not found." }, { status: 404 });

    if (auth.role === "teacher") {
      const teacher = await Teacher.findById(auth.id).select("permissions");
      const isSubjectTeacher = await isSubjectTeacherOf(auth.id, auth.schoolId, exam.class, exam.section, exam.subject);
      if (!teacher?.permissions?.canEnterMarks && !isSubjectTeacher) {
        return NextResponse.json(
          { success: false, message: "You don't have permission to enter marks for this subject/class." },
          { status: 403 },
        );
      }
    }

    const { results } = await req.json();
    if (!Array.isArray(results) || results.length === 0) {
      return NextResponse.json({ success: false, message: "results[] is required." }, { status: 400 });
    }

    let saved = 0;
    let outOfRange = 0;
    for (const r of results as { studentId: string; marksObtained: number | string | null; remarks?: string }[]) {
      if (r.marksObtained === "" || r.marksObtained === null || r.marksObtained === undefined) continue;
      const marksObtained = Number(r.marksObtained);
      if (Number.isNaN(marksObtained)) continue;
      if (marksObtained < 0 || marksObtained > exam.totalMarks) {
        outOfRange++;
        continue;
      }

      const existing = await Result.findOne({ exam: id, student: r.studentId });
      let result;
      if (existing) {
        existing.marksObtained = marksObtained;
        existing.totalMarks = exam.totalMarks;
        existing.remarks = r.remarks || "";
        existing.enteredBy = new mongoose.Types.ObjectId(auth.id);
        await existing.save();
        result = existing;
      } else {
        result = await Result.create({
          school: auth.schoolId,
          exam: id,
          student: r.studentId,
          marksObtained,
          totalMarks: exam.totalMarks,
          remarks: r.remarks || "",
          enteredBy: auth.id,
        });
        if (result.percentage >= 90) {
          await Student.findByIdAndUpdate(r.studentId, { $inc: { points: 20 }, $addToSet: { badges: "Top Scorer" } });
        } else if (result.percentage >= 75) {
          await Student.findByIdAndUpdate(r.studentId, { $inc: { points: 10 } });
        }
      }
      saved++;
    }

    exam.status = "completed";
    await exam.save();

    const message = outOfRange > 0
      ? `Marks entered. ${outOfRange} entr${outOfRange > 1 ? "ies" : "y"} skipped — must be between 0 and ${exam.totalMarks}.`
      : "Marks entered.";
    return NextResponse.json({ success: true, message, count: saved });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to save marks." },
      { status: 500 },
    );
  }
}
