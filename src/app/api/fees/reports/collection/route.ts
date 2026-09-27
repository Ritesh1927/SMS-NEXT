import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { FeePayment, type IFeePayment } from "@/models/FeePayment";
import { computeFeeDues } from "@/lib/feeDues";

// GET /api/fees/reports/collection — the Reports tab's "Collection Summary"
// sub-tab: today/week/month/year collected + payment counts, current
// pending total, and late-fee/concession totals collected this year.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - now.getDay());
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const yearStart = new Date(now.getFullYear(), 0, 1);

    const allPaid = await FeePayment.find({
      school: auth.schoolId,
      status: "paid",
      paidDate: { $gte: yearStart },
    }).lean<IFeePayment[]>();

    const todayPaid = allPaid.filter((i) => i.paidDate && new Date(i.paidDate) >= todayStart);
    const weekPaid = allPaid.filter((i) => i.paidDate && new Date(i.paidDate) >= weekStart);
    const monthPaid = allPaid.filter((i) => i.paidDate && new Date(i.paidDate) >= monthStart);

    const totalLateFees = allPaid.reduce((s, i) => s + (i.lateFee || 0), 0);
    const totalConcessions = allPaid.reduce((s, i) => s + (i.concession || 0), 0);

    const dues = await computeFeeDues(auth.schoolId);
    const pending = dues.reduce((s, d) => s + d.amount, 0);
    const overdue = dues
      .filter((d) => d.dueDate && new Date(d.dueDate) < now)
      .reduce((s, d) => s + d.amount, 0);

    return NextResponse.json({
      success: true,
      data: {
        today: { collected: todayPaid.reduce((s, i) => s + i.paidAmount, 0), payments: todayPaid.length },
        week: { collected: weekPaid.reduce((s, i) => s + i.paidAmount, 0), payments: weekPaid.length },
        month: { collected: monthPaid.reduce((s, i) => s + i.paidAmount, 0), payments: monthPaid.length },
        year: { collected: allPaid.reduce((s, i) => s + i.paidAmount, 0) },
        pending,
        overdue,
        lateFees: totalLateFees,
        concessions: totalConcessions,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load collection summary." },
      { status: 500 },
    );
  }
}
