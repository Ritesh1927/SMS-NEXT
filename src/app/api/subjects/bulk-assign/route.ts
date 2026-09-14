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
    const { classIds, subjectIds } = await req.json();
    if (!Array.isArray(classIds) || classIds.length === 0 || !Array.isArray(subjectIds) || subjectIds.length === 0) {
      return NextResponse.json({ success: false, message: "classIds[] and subjectIds[] are required." }, { status: 400 });
    }

    await connectDB();
    await Class.updateMany({ _id: { $in: classIds }, school: auth.schoolId }, { $addToSet: { assignedSubjects: { $each: subjectIds } } });

    return NextResponse.json({ success: true, message: `${subjectIds.length} subject(s) assigned to ${classIds.length} class(es).` });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Bulk assignment failed." },
      { status: 500 },
    );
  }
}
