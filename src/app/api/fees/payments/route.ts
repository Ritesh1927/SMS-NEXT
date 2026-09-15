import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUser, requireFeeManager } from "@/lib/auth-server";
import { FeePayment } from "@/models/FeePayment";
import { FeeStructure } from "@/models/FeeStructure";
import { Student } from "@/models/Student";
import "@/models/Teacher";

function populate(q: ReturnType<typeof FeePayment.find>) {
  return q
    .populate("student", "name studentId class section rollNumber")
    .populate("feeStructure", "title class amount frequency")
    .populate("collectedBy", "name teacherId");
}

export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const cls = searchParams.get("class");
    const studentId = searchParams.get("studentId");

    const query: Record<string, unknown> = { school: auth.schoolId };
    if (status) query.status = status;
    if (studentId) query.student = studentId;

    const fees = await populate(FeePayment.find(query).sort({ createdAt: -1 }));
    type PopulatedStudent = { class?: string };
    const filtered = cls
      ? fees.filter((f) => (f.student as unknown as PopulatedStudent)?.class === cls)
      : fees;

    const totalCollected = filtered.filter((f) => f.status === "paid").reduce((s, f) => s + f.paidAmount, 0);
    const totalPending = filtered
      .filter((f) => f.status !== "paid")
      .reduce((s, f) => s + (f.amount - f.paidAmount), 0);

    return NextResponse.json({ success: true, data: filtered, summary: { totalCollected, totalPending } });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load fee payments." },
      { status: 500 },
    );
  }
}

// POST — record an ad-hoc fee (not necessarily tied to a structure), e.g. a
// one-off charge, mirroring SMS-BACKEND's collectFee.
export async function POST(req: Request) {
  await connectDB();
  const result = await requireFeeManager(req);
  if ("error" in result) return result.error;
  const { auth } = result;

  try {
    const { student, title, amount, paidAmount, dueDate, paymentMode, remarks, feeStructure } = await req.json();
    if (!student || !title || !amount) {
      return NextResponse.json({ success: false, message: "student, title and amount are required." }, { status: 400 });
    }

    const paid = parseFloat(paidAmount) || 0;
    const total = parseFloat(amount);
    const status = paid >= total ? "paid" : paid > 0 ? "partial" : "pending";

    let month: string | null = null;
    if (feeStructure) {
      const fs = await FeeStructure.findById(feeStructure).select("frequency").lean();
      if (fs) month = fs.frequency === "one-time" ? "one-time" : new Date().toISOString().slice(0, 7);
    }

    const payDoc = new FeePayment({
      school: auth.schoolId,
      student: new mongoose.Types.ObjectId(String(student)),
      title,
      amount: total,
      paidAmount: paid,
      dueDate: dueDate || new Date(),
      status,
      paymentMode: paymentMode || "cash",
      remarks: remarks || "",
      feeStructure: feeStructure || null,
      month,
      paidDate: status === "paid" ? new Date() : null,
      collectedBy: auth.role === "teacher" ? auth.id : null,
    });
    await payDoc.save();

    if (status === "paid") await Student.findByIdAndUpdate(student, { $inc: { points: 5 } });

    const populated = await populate(FeePayment.find({ _id: payDoc._id }));
    return NextResponse.json({ success: true, message: "Fee recorded.", data: populated[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to record fee." },
      { status: 500 },
    );
  }
}
