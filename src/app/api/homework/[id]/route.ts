import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Homework } from "@/models/Homework";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    await connectDB();
    const hw = await Homework.findOne({ _id: id, school: auth.schoolId })
      .populate("assignedBy", "name teacherId")
      .populate("submissions.student", "name studentId class section");
    if (!hw) return NextResponse.json({ success: false, message: "Homework not found." }, { status: 404 });

    return NextResponse.json({ success: true, data: hw });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load homework." },
      { status: 500 },
    );
  }
}

const ALLOWED_FIELDS = ["title", "description", "subject", "class", "section", "dueDate", "maxMarks", "isActive"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const updates: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    await connectDB();

    const query: Record<string, unknown> = { _id: id, school: auth.schoolId };
    if (auth.role === "teacher") query.assignedBy = auth.id;

    const hw = await Homework.findOneAndUpdate(query, updates, { returnDocument: "after" }).populate(
      "assignedBy",
      "name teacherId",
    );
    if (!hw) return NextResponse.json({ success: false, message: "Homework not found or access denied." }, { status: 404 });

    return NextResponse.json({ success: true, message: "Homework updated.", data: hw });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to update homework." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    await connectDB();

    const query: Record<string, unknown> = { _id: id, school: auth.schoolId };
    if (auth.role === "teacher") query.assignedBy = auth.id;

    const hw = await Homework.findOneAndDelete(query);
    if (!hw) return NextResponse.json({ success: false, message: "Homework not found or access denied." }, { status: 404 });

    return NextResponse.json({ success: true, message: "Homework deleted." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to delete homework." },
      { status: 500 },
    );
  }
}
