import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Class } from "@/models/Class";
import "@/models/Subject";

function requireSchoolAdmin(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") return null;
  return auth;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireSchoolAdmin(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    const { id } = await params;
    const { name, section, classTeacher, room } = await req.json();

    await connectDB();
    const cls = await Class.findOneAndUpdate(
      { _id: id, school: auth.schoolId },
      { name, section, classTeacher: classTeacher || null, room },
      { returnDocument: "after" },
    )
      .populate("classTeacher", "name teacherId")
      .populate("assignedSubjects", "name code");
    if (!cls) return NextResponse.json({ success: false, message: "Class not found." }, { status: 404 });

    return NextResponse.json({ success: true, message: "Class updated.", data: cls });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to update class." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireSchoolAdmin(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    const { id } = await params;
    await connectDB();
    const cls = await Class.findOneAndDelete({ _id: id, school: auth.schoolId });
    if (!cls) return NextResponse.json({ success: false, message: "Class not found." }, { status: 404 });

    return NextResponse.json({ success: true, message: "Class deleted." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to delete class." },
      { status: 500 },
    );
  }
}
