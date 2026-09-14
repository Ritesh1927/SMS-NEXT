import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Class } from "@/models/Class";

export async function POST(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { classId, subjectIds } = await req.json();
    if (!classId || !Array.isArray(subjectIds) || subjectIds.length === 0) {
      return NextResponse.json({ success: false, message: "classId and subjectIds[] are required." }, { status: 400 });
    }

    await connectDB();
    const cls = await Class.findOne({ _id: classId, school: auth.schoolId });
    if (!cls) return NextResponse.json({ success: false, message: "Class not found." }, { status: 404 });

    await Class.findByIdAndUpdate(classId, { $addToSet: { assignedSubjects: { $each: subjectIds } } });

    return NextResponse.json({ success: true, message: "Subjects assigned to class." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to assign subjects." },
      { status: 500 },
    );
  }
}
