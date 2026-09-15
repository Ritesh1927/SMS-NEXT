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

    const { title, class: cls, section, subject, date, startTime, endTime, totalMarks, passingMarks, examType, instructions } =
      await req.json();
    if (!title || !cls || !subject || !date || totalMarks === undefined || passingMarks === undefined) {
      return NextResponse.json(
        { success: false, message: "Title, class, subject, date, totalMarks and passingMarks are required." },
        { status: 400 },
      );
    }

    const exam = await Exam.create({
      school: auth.schoolId,
      title,
      class: cls,
      section: section || "",
      subject,
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
    });

    return NextResponse.json({ success: true, message: "Exam created.", data: exam }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to create exam." },
      { status: 500 },
    );
  }
}
