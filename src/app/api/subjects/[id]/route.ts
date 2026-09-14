import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Subject } from "@/models/Subject";
import { Class } from "@/models/Class";

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
    const { name, code, description } = await req.json();

    await connectDB();

    if (code) {
      const exists = await Subject.findOne({ school: auth.schoolId, code: String(code).trim().toUpperCase(), _id: { $ne: id } });
      if (exists) {
        return NextResponse.json({ success: false, message: "Subject code already exists." }, { status: 400 });
      }
    }

    const update: Record<string, unknown> = {};
    if (name !== undefined) update.name = String(name).trim();
    if (code !== undefined) update.code = String(code).trim().toUpperCase();
    if (description !== undefined) update.description = String(description).trim();

    const subject = await Subject.findOneAndUpdate({ _id: id, school: auth.schoolId }, update, { returnDocument: "after" });
    if (!subject) return NextResponse.json({ success: false, message: "Subject not found." }, { status: 404 });

    return NextResponse.json({ success: true, message: "Subject updated.", data: subject });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to update subject." },
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

    const subject = await Subject.findOneAndDelete({ _id: id, school: auth.schoolId });
    if (!subject) return NextResponse.json({ success: false, message: "Subject not found." }, { status: 404 });

    await Class.updateMany({ school: auth.schoolId }, { $pull: { assignedSubjects: subject._id } });

    return NextResponse.json({ success: true, message: "Subject deleted." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to delete subject." },
      { status: 500 },
    );
  }
}
