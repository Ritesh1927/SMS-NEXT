import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Result } from "@/models/Result";
import { Teacher } from "@/models/Teacher";
import { isSubjectTeacherOf } from "@/lib/teacherClasses";

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

    if (auth.role === "teacher") {
      const teacher = await Teacher.findById(auth.id).select("permissions");
      if (!teacher?.permissions?.canEnterMarks) {
        // No blanket grant -- every exam these results belong to must be one
        // this teacher is the subject teacher for (matches the same check
        // POST /api/exams/[id]/marks uses).
        const results = await Result.find({ _id: { $in: resultIds }, school: auth.schoolId })
          .select("exam")
          .populate<{ exam: { _id: unknown; class: string; section: string; subject: string } }>("exam", "class section subject");
        const uniqueExams = new Map<string, { class: string; section: string; subject: string }>();
        for (const r of results) {
          if (r.exam) uniqueExams.set(String(r.exam._id), r.exam);
        }
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
