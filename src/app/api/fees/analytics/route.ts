import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { FeePayment } from "@/models/FeePayment";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// GET /api/fees/analytics — admin-only, for the Fees page's Dashboard tab:
// collected vs. pending totalled per calendar month this year, plus an
// overall summary including late fees collected.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const schoolId = new mongoose.Types.ObjectId(auth.schoolId);
    const year = new Date().getFullYear();
    const yearStart = new Date(year, 0, 1);
    const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);

    const [monthlyCollected, monthlyPending, allPayments, classWiseRaw] = await Promise.all([
      FeePayment.aggregate([
        { $match: { school: schoolId, status: "paid", paidDate: { $gte: yearStart, $lte: yearEnd } } },
        { $group: { _id: { $month: "$paidDate" }, total: { $sum: "$paidAmount" } } },
      ]),
      FeePayment.aggregate([
        { $match: { school: schoolId, status: { $ne: "paid" }, dueDate: { $gte: yearStart, $lte: yearEnd } } },
        { $group: { _id: { $month: "$dueDate" }, total: { $sum: { $subtract: ["$amount", "$paidAmount"] } } } },
      ]),
      FeePayment.find({ school: schoolId }).select("status amount paidAmount lateFee"),
      FeePayment.aggregate([
        { $match: { school: schoolId, status: "paid" } },
        { $lookup: { from: "students", localField: "student", foreignField: "_id", as: "s" } },
        { $unwind: "$s" },
        { $group: { _id: "$s.class", collected: { $sum: "$paidAmount" } } },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const collectedByMonth = new Map(monthlyCollected.map((m) => [m._id, m.total]));
    const pendingByMonth = new Map(monthlyPending.map((m) => [m._id, m.total]));

    const data = MONTHS.map((month, i) => ({
      month,
      collected: Math.round(collectedByMonth.get(i + 1) || 0),
      pending: Math.round(pendingByMonth.get(i + 1) || 0),
    }));

    const totalCollected = allPayments.filter((p) => p.status === "paid").reduce((s, p) => s + p.paidAmount, 0);
    const totalPending = allPayments.filter((p) => p.status !== "paid").reduce((s, p) => s + (p.amount - p.paidAmount), 0);
    const totalLateFees = allPayments.filter((p) => p.status === "paid").reduce((s, p) => s + (p.lateFee || 0), 0);
    const classWise = classWiseRaw.map((c) => ({ class: String(c._id), collected: Math.round(c.collected) }));

    return NextResponse.json({
      success: true,
      data,
      classWise,
      summary: {
        totalCollected: Math.round(totalCollected),
        totalPending: Math.round(totalPending),
        totalLateFees: Math.round(totalLateFees),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load fee analytics." },
      { status: 500 },
    );
  }
}
