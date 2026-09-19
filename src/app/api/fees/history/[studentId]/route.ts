import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { FeePayment, type IFeePayment } from "@/models/FeePayment";
import { Student } from "@/models/Student";
import { Parent } from "@/models/Parent";

interface HistoryGroup {
  paymentDate: Date | null;
  paymentMode: string;
  totalAmount: number;
  receiptNos: string[];
  items: {
    _id: unknown;
    title: string;
    month: string | null;
    amount: number;
    lateFee: number;
    concession: number;
    paidAmount: number;
    receiptNo: string | null;
  }[];
}

// GET /api/fees/history/[studentId] — paid FeePayments grouped by
// transaction (same day + payment mode = one transaction), for the
// "Payment History" tab shown to both admin and parent.
export async function GET(req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || !["schooladmin", "teacher", "parent"].includes(auth.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { studentId } = await params;
    await connectDB();

    if (auth.role === "parent") {
      const parentDoc = await Parent.findById(auth.id);
      const childIds = (parentDoc?.students || []).map((id) => String(id));
      if (!childIds.includes(studentId)) {
        return NextResponse.json({ success: false, message: "Access denied." }, { status: 403 });
      }
    }

    const student = await Student.findOne({ _id: studentId, school: auth.schoolId }).select(
      "name class section studentId rollNumber",
    );
    if (!student) return NextResponse.json({ success: false, message: "Student not found." }, { status: 404 });

    const payments = await FeePayment.find({ school: auth.schoolId, student: studentId, status: "paid" })
      .sort({ paidDate: -1 })
      .lean<IFeePayment[]>();

    const groups = new Map<string, HistoryGroup>();
    for (const p of payments) {
      const dateKey = p.paidDate ? new Date(p.paidDate).toISOString().slice(0, 10) : "unknown";
      const groupKey = `${dateKey}|${p.paymentMode}`;
      if (!groups.has(groupKey)) {
        groups.set(groupKey, { paymentDate: p.paidDate, paymentMode: p.paymentMode, items: [], totalAmount: 0, receiptNos: [] });
      }
      const g = groups.get(groupKey)!;
      g.items.push({
        _id: p._id,
        title: p.title,
        month: p.month,
        amount: p.amount,
        lateFee: p.lateFee || 0,
        concession: p.concession || 0,
        paidAmount: p.paidAmount || p.amount,
        receiptNo: p.receiptNo,
      });
      g.totalAmount += p.paidAmount || p.amount;
      if (p.receiptNo) g.receiptNos.push(p.receiptNo);
    }

    const history = Array.from(groups.values()).map((g) => ({
      paymentDate: g.paymentDate,
      paymentMode: g.paymentMode,
      totalAmount: g.totalAmount,
      receiptNo: g.receiptNos[0] || "",
      itemCount: g.items.length,
      items: g.items,
    }));

    return NextResponse.json({ success: true, data: { student, history } });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load payment history." },
      { status: 500 },
    );
  }
}
