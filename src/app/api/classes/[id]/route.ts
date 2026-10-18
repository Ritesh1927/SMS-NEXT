import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireStaffSectionAccess } from "@/lib/auth-server";
import { Class } from "@/models/Class";
import "@/models/Subject";
import "@/models/Teacher";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  const gate = await requireStaffSectionAccess(req, "classes", "edit");
  if ("error" in gate) return gate.error;
  const { auth } = gate;

  try {
    const { id } = await params;
    const { name, section, classTeacher, room } = await req.json();

    if (room && room.trim()) {
      const dupRoom = await Class.findOne({ school: auth.schoolId, room: room.trim(), _id: { $ne: id } });
      if (dupRoom) {
        return NextResponse.json({ success: false, message: `Room "${room.trim()}" is already assigned to Class ${dupRoom.name}-${dupRoom.section}.` }, { status: 400 });
      }
    }

    if (classTeacher) {
      const dupTeacher = await Class.findOne({ school: auth.schoolId, classTeacher, _id: { $ne: id } });
      if (dupTeacher) {
        return NextResponse.json({ success: false, message: "This teacher is already assigned as class teacher to another class." }, { status: 400 });
      }
    }

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
  await connectDB();
  const gate = await requireStaffSectionAccess(req, "classes", "delete");
  if ("error" in gate) return gate.error;
  const { auth } = gate;

  try {
    const { id } = await params;
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
