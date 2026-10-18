import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireStaffSectionAccess } from "@/lib/auth-server";
import { Subject } from "@/models/Subject";
import { Class } from "@/models/Class";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  const gate = await requireStaffSectionAccess(req, "subjectClass", "edit");
  if ("error" in gate) return gate.error;
  const { auth } = gate;

  try {
    const { id } = await params;
    const { name, code, description } = await req.json();

    if (code) {
      const exists = await Subject.findOne({ school: auth.schoolId, code: String(code).trim().toUpperCase(), _id: { $ne: id } });
      if (exists) {
        return NextResponse.json({ success: false, message: "Subject code already exists." }, { status: 400 });
      }
    }

    if (name !== undefined) {
      const trimmedName = String(name).trim();
      if (!trimmedName) {
        return NextResponse.json({ success: false, message: "Subject name is required." }, { status: 400 });
      }
      // Case-insensitive, same check as create -- prevents renaming into a
      // collision with another subject that already has this name.
      const duplicate = await Subject.findOne({
        school: auth.schoolId,
        name: { $regex: `^${trimmedName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
        _id: { $ne: id },
      });
      if (duplicate) {
        return NextResponse.json({ success: false, message: `Subject "${trimmedName}" already exists.` }, { status: 400 });
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
  await connectDB();
  const gate = await requireStaffSectionAccess(req, "subjectClass", "delete");
  if ("error" in gate) return gate.error;
  const { auth } = gate;

  try {
    const { id } = await params;

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
