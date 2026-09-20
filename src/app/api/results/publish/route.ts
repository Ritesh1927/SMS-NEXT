import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Result } from "@/models/Result";
import { Teacher } from "@/models/Teacher";
import { Exam } from "@/models/Exam";
import { Student } from "@/models/Student";
import { isSubjectTeacherOf, isClassTeacherOf } from "@/lib/teacherClasses";

export async function PATCH(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();

    const { resultIds, publish } = await req.json();
    if (!Array.isArray(resultIds) || resultIds.length === 0) {
      return NextResponse.json({ success: false, message: "resultIds[] is required." }, { status: 400 });
    }

    const publishedResults = await Result.find({ _id: { $in: resultIds }, school: auth.schoolId })
      .select("exam")
      .populate<{ exam: { _id: unknown; class: string; section: string; subject: string; scheduledExamId: unknown } }>(
        "exam",
        "class section subject scheduledExamId",
      );
    const uniqueExams = new Map<string, { class: string; section: string; subject: string; scheduledExamId: unknown }>();
    for (const r of publishedResults) {
      if (r.exam) uniqueExams.set(String(r.exam._id), r.exam);
    }

    if (auth.role === "teacher") {
      const distinctSubjects = new Set(
        [...uniqueExams.values()].map((e) => `${e.class}::${e.section}::${e.subject.toLowerCase()}`),
      );

      if (distinctSubjects.size > 1) {
        // Spans every subject of an exam at once -- reserved for the class
        // teacher (or admin) regardless of canEnterMarks/subject-teacher
        // status, so one subject teacher can't publish everyone else's
        // still-in-progress marks along with their own.
        const distinctClasses = new Set([...uniqueExams.values()].map((e) => e.class));
        for (const className of distinctClasses) {
          if (!(await isClassTeacherOf(auth.id, auth.schoolId, className))) {
            return NextResponse.json(
              { success: false, message: "Only the class teacher or an admin can publish or unpublish results across every subject of an exam." },
              { status: 403 },
            );
          }
        }
      } else {
        // A single subject -- the same canEnterMarks-or-subject-teacher
        // check POST /api/exams/[id]/marks uses.
        const teacher = await Teacher.findById(auth.id).select("permissions");
        if (!teacher?.permissions?.canEnterMarks) {
          for (const e of uniqueExams.values()) {
            const allowed = await isSubjectTeacherOf(auth.id, auth.schoolId, e.class, e.section, e.subject);
            if (!allowed) {
              return NextResponse.json(
                { success: false, message: "You don't have permission to publish results for this subject/class." },
                { status: 403 },
              );
            }
          }
        }
      }
    }

    // Bulk publish ("Publish All" / "Publish All Subjects") requires every
    // active student to have a result -- marks or marked absent -- for every
    // subject-exam involved, so nothing goes out half-finished. A single-row
    // publish (one student) and any unpublish are exempt. Resolved against
    // the true roster and full subject set (via scheduledExamId when this
    // is a multi-subject exam), not just whatever resultIds happened to be
    // passed in, so a subject nobody has started yet still blocks it.
    if (publish && resultIds.length > 1 && uniqueExams.size > 0) {
      const scheduledExamId = [...uniqueExams.values()].find((e) => e.scheduledExamId)?.scheduledExamId;
      const examsToCheck = scheduledExamId
        ? await Exam.find({ scheduledExamId }).select("_id class section")
        : await Exam.find({ _id: { $in: [...uniqueExams.keys()] } }).select("_id class section");

      const rosterCache = new Map<string, string[]>();
      let missing = 0;
      for (const exam of examsToCheck) {
        const rosterKey = `${exam.class}::${exam.section}`;
        let studentIds = rosterCache.get(rosterKey);
        if (!studentIds) {
          const students = await Student.find({ school: auth.schoolId, class: exam.class, section: exam.section, isActive: true }).select("_id");
          studentIds = students.map((s) => String(s._id));
          rosterCache.set(rosterKey, studentIds);
        }
        if (studentIds.length === 0) continue;
        const existingCount = await Result.countDocuments({ exam: exam._id, student: { $in: studentIds } });
        missing += Math.max(0, studentIds.length - existingCount);
      }

      if (missing > 0) {
        return NextResponse.json(
          {
            success: false,
            message: `Cannot publish yet — ${missing} student result${missing > 1 ? "s are" : " is"} still missing across ${examsToCheck.length > 1 ? "the exam's subjects" : "this test"}. Mark absent students as Absent rather than leaving them blank.`,
          },
          { status: 400 },
        );
      }
    }

    const update = publish
      ? { $set: { isPublished: true, publishedAt: new Date() } }
      : { $set: { isPublished: false }, $unset: { publishedAt: "" } };

    await Result.updateMany({ _id: { $in: resultIds }, school: auth.schoolId }, update);
    return NextResponse.json({ success: true, message: publish ? "Results published." : "Results unpublished." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to update results." },
      { status: 500 },
    );
  }
}
