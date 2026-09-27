import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUser, requireFeeManager } from "@/lib/auth-server";
import { FeePayment } from "@/models/FeePayment";
import { FeeStructure, type IFeeStructure } from "@/models/FeeStructure";
import { Student } from "@/models/Student";
import { isMonthUpcoming, dueDateForMonth } from "@/lib/feeEngine";
import "@/models/Teacher";

function populate(q: ReturnType<typeof FeePayment.find>) {
  return q
    .populate("student", "name studentId class section rollNumber")
    .populate("feeStructure", "title class amount frequency dueDate")
    .populate("collectedBy", "name teacherId");
}

// A per-month FeePayment row (created by pay-multi, e.g. when an admin
// selects several months at once for an online payment that only some of
// them were ever confirmed for) carries whatever status it had at creation
// time -- nothing revisits it as time passes. So a row for a month that
// hasn't started yet can still read "pending" indefinitely. Reclassify
// against the month it's actually for (not the raw stored status) so it
// only ever counts as "pending" once that month has arrived; before that
// it's "upcoming", regardless of what's stored in the database.
function isUpcomingRow(f: { status: string; month?: string | null; feeStructure?: unknown }): boolean {
  if (f.status === "paid" || !f.month) return false;
  const structure = f.feeStructure as (IFeeStructure & { dueDate?: Date | string | null }) | null;
  if (!structure) return false;
  return isMonthUpcoming(structure.dueDate, f.month);
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
    if (status === "upcoming") query.status = { $ne: "paid" };
    else if (status) query.status = status;
    if (studentId) query.student = studentId;

    let fees = await populate(FeePayment.find(query).sort({ createdAt: -1 }));
    if (status === "upcoming") fees = fees.filter((f) => isUpcomingRow(f));
    else if (status === "pending" || status === "overdue") fees = fees.filter((f) => !isUpcomingRow(f));

    type PopulatedStudent = { class?: string };
    const filtered = cls
      ? fees.filter((f) => (f.student as unknown as PopulatedStudent)?.class === cls)
      : fees;

    const totalCollected = filtered.filter((f) => f.status === "paid").reduce((s, f) => s + f.paidAmount, 0);
    const totalPending = filtered
      .filter((f) => f.status !== "paid")
      .reduce((s, f) => s + (f.amount - f.paidAmount), 0);

    // The stored dueDate on an unpaid per-month row can be stale (it's a
    // one-time snapshot copied at creation, and pay-multi used to copy the
    // structure's raw date verbatim for every month before that was fixed)
    // -- show the recomputed one for the month it's actually for instead.
    const data = filtered.map((f) => {
      const structure = f.feeStructure as unknown as (IFeeStructure & { dueDate?: Date | string | null }) | null;
      if (f.status === "paid" || !f.month || !structure) return f;
      const correctedDueDate = dueDateForMonth(structure.dueDate, f.month);
      if (!correctedDueDate) return f;
      return { ...f.toObject(), dueDate: correctedDueDate };
    });

    return NextResponse.json({ success: true, data, summary: { totalCollected, totalPending } });
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
