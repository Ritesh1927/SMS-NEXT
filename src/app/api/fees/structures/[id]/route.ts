import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireFeeManager } from "@/lib/auth-server";
import { FeeStructure } from "@/models/FeeStructure";

const ALLOWED_FIELDS = ["title", "amount", "dueDate", "frequency", "description", "academicYear", "isActive"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  const result = await requireFeeManager(req);
  if ("error" in result) return result.error;
  const { auth } = result;

  try {
    const { id } = await params;
    const body = await req.json();
    const updates: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    const fee = await FeeStructure.findOneAndUpdate({ _id: id, school: auth.schoolId }, updates, {
      returnDocument: "after",
      runValidators: true,
    });
    if (!fee) return NextResponse.json({ success: false, message: "Fee structure not found." }, { status: 404 });

    return NextResponse.json({ success: true, message: "Fee structure updated.", data: fee });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to update fee structure." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  const result = await requireFeeManager(req);
  if ("error" in result) return result.error;
  const { auth } = result;

  try {
    const { id } = await params;
    const fee = await FeeStructure.findOneAndDelete({ _id: id, school: auth.schoolId });
    if (!fee) return NextResponse.json({ success: false, message: "Fee structure not found." }, { status: 404 });

    return NextResponse.json({ success: true, message: "Fee structure deleted." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to delete fee structure." },
      { status: 500 },
    );
  }
}
