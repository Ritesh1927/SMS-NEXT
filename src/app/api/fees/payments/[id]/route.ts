import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireFeeManager } from "@/lib/auth-server";
import { FeePayment } from "@/models/FeePayment";
import { Student } from "@/models/Student";

async function genReceipt() {
  const count = await FeePayment.countDocuments();
  return "RCP-" + Date.now() + "-" + String(count + Math.floor(Math.random() * 99) + 1).padStart(4, "0");
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  const result = await requireFeeManager(req);
  if ("error" in result) return result.error;
  const { auth } = result;

  try {
    const { id } = await params;
    const { status, paidAmount, paymentMode, remarks } = await req.json();

    const update: Record<string, unknown> = {
      status,
      paymentMode,
      paidDate: status === "paid" ? new Date() : null,
    };
    if (paidAmount !== undefined) update.paidAmount = paidAmount;
    if (remarks !== undefined) update.remarks = remarks;
    if (status === "paid") update.receiptNo = await genReceipt();

    const fee = await FeePayment.findOneAndUpdate({ _id: id, school: auth.schoolId }, update, {
      returnDocument: "after",
    });
    if (!fee) return NextResponse.json({ success: false, message: "Fee record not found." }, { status: 404 });

    if (status === "paid") await Student.findByIdAndUpdate(fee.student, { $inc: { points: 5 } });

    const populated = await FeePayment.findById(fee._id)
      .populate("student", "name studentId class section rollNumber")
      .populate("feeStructure", "title class amount frequency")
      .populate("collectedBy", "name teacherId");

    return NextResponse.json({ success: true, message: "Fee updated.", data: populated });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to update fee." },
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
    const fee = await FeePayment.findOneAndDelete({ _id: id, school: auth.schoolId });
    if (!fee) return NextResponse.json({ success: false, message: "Fee record not found." }, { status: 404 });

    return NextResponse.json({ success: true, message: "Payment record deleted." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to delete payment." },
      { status: 500 },
    );
  }
}
