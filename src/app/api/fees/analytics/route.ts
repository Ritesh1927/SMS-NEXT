import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { FeePayment } from "@/models/FeePayment";
import { isMonthUpcoming } from "@/lib/feeEngine";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

type LeanPayment = {
  status: string;
  amount: number;
  paidAmount: number;
  lateFee?: number;
  paidDate?: Date | null;
  dueDate?: Date | null;
  month?: string | null;
  feeStructure?: { dueDate?: Date | string | null } | null;
  student?: { class?: string } | null;
};

// A not-yet-due month's row still carries whatever status it had at
// creation (see student-status's isMonthUpcoming) -- exclude it from
// "pending" here the same way, so this summary/chart agrees with the
// Pending Fee Records list instead of double-counting money not yet owed.
function isUpcomingRow(p: LeanPayment): boolean {
  return p.status !== "paid" && !!p.month && !!p.feeStructure && isMonthUpcoming(p.feeStructure.dueDate, p.month);
}

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
    const year = new Date().getFullYear();

    const allPayments = await FeePayment.find({ school: auth.schoolId })
      .select("status amount paidAmount lateFee paidDate dueDate month feeStructure student")
      .populate("feeStructure", "dueDate")
      .populate("student", "class")
      .lean<LeanPayment[]>();

    const collectedByMonth = new Map<number, number>();
    const pendingByMonth = new Map<number, number>();
    const classWiseMap = new Map<string, number>();

    for (const p of allPayments) {
      if (p.status === "paid") {
        if (p.paidDate && new Date(p.paidDate).getFullYear() === year) {
          const m = new Date(p.paidDate).getMonth() + 1;
          collectedByMonth.set(m, (collectedByMonth.get(m) || 0) + p.paidAmount);
        }
        const cls = p.student?.class;
        if (cls) classWiseMap.set(cls, (classWiseMap.get(cls) || 0) + p.paidAmount);
      } else if (!isUpcomingRow(p) && p.dueDate && new Date(p.dueDate).getFullYear() === year) {
        const m = new Date(p.dueDate).getMonth() + 1;
        pendingByMonth.set(m, (pendingByMonth.get(m) || 0) + (p.amount - p.paidAmount));
      }
    }

    const data = MONTHS.map((month, i) => ({
      month,
      collected: Math.round(collectedByMonth.get(i + 1) || 0),
      pending: Math.round(pendingByMonth.get(i + 1) || 0),
    }));

    const totalCollected = allPayments.filter((p) => p.status === "paid").reduce((s, p) => s + p.paidAmount, 0);
    const totalPending = allPayments
      .filter((p) => p.status !== "paid" && !isUpcomingRow(p))
      .reduce((s, p) => s + (p.amount - p.paidAmount), 0);
    const totalLateFees = allPayments.filter((p) => p.status === "paid").reduce((s, p) => s + (p.lateFee || 0), 0);
    const classWise = [...classWiseMap.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([cls, collected]) => ({ class: cls, collected: Math.round(collected) }));

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
