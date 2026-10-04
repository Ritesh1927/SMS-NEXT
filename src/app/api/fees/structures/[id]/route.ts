import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireFeeManager } from "@/lib/auth-server";
import { FeeStructure, findDuplicateFeeStructures } from "@/models/FeeStructure";
import { FeePayment } from "@/models/FeePayment";

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

    // Renaming a head must not collide with another active head in the same
    // class (class itself isn't updatable — see ALLOWED_FIELDS). Class is
    // read from the existing doc so the check can't be bypassed via body.
    if (updates.title !== undefined) {
      updates.title = String(updates.title).trim();
      const current = await FeeStructure.findOne({ _id: id, school: auth.schoolId });
      if (!current) return NextResponse.json({ success: false, message: "Fee structure not found." }, { status: 404 });
      const dups = await findDuplicateFeeStructures(auth.schoolId, current.class, [String(updates.title)], id);
      if (dups.length > 0) {
        return NextResponse.json(
          { success: false, message: `A "${dups[0].title}" fee head already exists for Class ${current.class}. Edit or delete it instead.` },
          { status: 409 },
        );
      }
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

    // Cascade the structure's unsold scaffolding: pending/overdue rows with
    // zero money collected would otherwise linger in Finance/Outstanding/
    // Student fee views as dues for a head that no longer exists. Rows with
    // any collected amount are real history and are never touched.
    await FeePayment.deleteMany({ school: auth.schoolId, feeStructure: fee._id, paidAmount: 0 });

    return NextResponse.json({ success: true, message: "Fee structure deleted." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to delete fee structure." },
      { status: 500 },
    );
  }
}
