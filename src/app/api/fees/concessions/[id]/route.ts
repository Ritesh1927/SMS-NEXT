import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Concession } from "@/models/Concession";
import "@/models/Student";
import "@/models/FeeStructure";

function requireSchoolAdmin(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") return null;
  return auth;
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireSchoolAdmin(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    const { id } = await params;
    const { type, value, isPct, description, feeStructure, duration, validUntil } = await req.json();

    const update: Record<string, unknown> = {};
    if (type !== undefined) update.type = type;
    if (value !== undefined) update.value = value;
    if (isPct !== undefined) update.isPct = isPct;
    if (description !== undefined) update.description = description;
    if (feeStructure !== undefined) update.feeStructure = feeStructure || null;
    if (duration !== undefined) update.duration = duration;
    if (validUntil !== undefined) update.validUntil = duration === "until-date" ? validUntil : null;

    await connectDB();
    const con = await Concession.findOneAndUpdate({ _id: id, school: auth.schoolId }, update, { new: true })
      .populate("student", "name studentId class section rollNumber")
      .populate("feeStructure", "title class amount");
    if (!con) return NextResponse.json({ success: false, message: "Concession not found." }, { status: 404 });

    return NextResponse.json({ success: true, message: "Concession updated.", data: con });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to update concession." },
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
    const con = await Concession.findOneAndDelete({ _id: id, school: auth.schoolId });
    if (!con) return NextResponse.json({ success: false, message: "Concession not found." }, { status: 404 });

    return NextResponse.json({ success: true, message: "Concession deleted." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to delete concession." },
      { status: 500 },
    );
  }
}
