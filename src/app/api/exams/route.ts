import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Exam } from "@/models/Exam";
import { Teacher } from "@/models/Teacher";
import "@/models/Admin";

export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || !["schooladmin", "teacher", "parent"].includes(auth.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const cls = searchParams.get("class");
    const subject = searchParams.get("subject");
    const status = searchParams.get("status");

    const query: Record<string, unknown> = { school: auth.schoolId };
    if (cls) query.class = cls;
    if (subject) query.subject = subject;
    if (status) query.status = status;

    const exams = await Exam.find(query).populate("createdBy", "name teacherId").sort({ date: 1 });
    return NextResponse.json({ success: true, data: exams });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load exams." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();

    if (auth.role === "teacher") {
      const teacher = await Teacher.findById(auth.id).select("permissions");
      if (!teacher?.permissions?.canCreateExam) {
        return NextResponse.json({ success: false, message: "You don't have permission to create exams." }, { status: 403 });
      }
    }

    const { title, class: cls, section, subject, subjects, date, startTime, endTime, totalMarks, passingMarks, examType, instructions } =
      await req.json();
    // A "Test" can now be created for several subjects at once -- each
    // subject still becomes its own Exam doc (own roster/marks/results),
    // same as ScheduledExam's per-subject slots, just without the term
    // wrapper. `subject` (singular) stays supported for editing a single
    // existing exam, which never changes how many subjects it covers.
    const subjectList: string[] = Array.isArray(subjects) && subjects.length ? subjects : subject ? [subject] : [];
    if (!title || !cls || subjectList.length === 0 || !date || totalMarks === undefined || passingMarks === undefined) {
      return NextResponse.json(
        { success: false, message: "Title, class, at least one subject, date, totalMarks and passingMarks are required." },
        { status: 400 },
      );
    }

    const created = await Promise.all(
      subjectList.map((subj) =>
        Exam.create({
          school: auth.schoolId,
          title,
          class: cls,
          section: section || "",
          subject: subj,
          date,
          startTime: startTime || "",
          endTime: endTime || "",
          totalMarks,
          passingMarks,
          examType: examType || "unit-test",
          instructions: instructions || "",
          createdBy: auth.id,
          createdByModel: auth.role === "schooladmin" ? "Admin" : "Teacher",
          status: "upcoming",
        }),
      ),
    );

    return NextResponse.json(
      {
        success: true,
        message: created.length > 1 ? `${created.length} tests created.` : "Exam created.",
        data: created.length === 1 ? created[0] : created,
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to create exam." },
      { status: 500 },
    );
  }
}
