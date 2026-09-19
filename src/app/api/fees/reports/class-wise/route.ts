import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { FeePayment } from "@/models/FeePayment";
import { FeeStructure, type IFeeStructure } from "@/models/FeeStructure";
import { Student } from "@/models/Student";

interface ClassRow {
  className: string;
  collected: number;
  pending: number;
  paid: number;
  pendingCount: number;
  totalCount: number;
}

// GET /api/fees/reports/class-wise — per-class collected/pending totals for
// the current month, based on FeePayment records (not invoices).
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();

    const students = await Student.find({ school: auth.schoolId, isActive: true })
      .select("name class section studentId")
      .lean<{ _id: unknown; name: string; class: string }[]>();
    const structures = await FeeStructure.find({ school: auth.schoolId, isActive: true }).lean<IFeeStructure[]>();
    const payments = await FeePayment.find({ school: auth.schoolId })
      .populate("student", "name class section studentId")
      .lean<{ student: { _id: unknown; class: string } | null; feeStructure: unknown; status: string; month: string | null; paidAmount: number }[]>();

    const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;
    const classMap = new Map<string, ClassRow>();

    for (const s of students) {
      const cls = s.class || "Unknown";
      if (!classMap.has(cls)) classMap.set(cls, { className: cls, collected: 0, pending: 0, paid: 0, pendingCount: 0, totalCount: 0 });
      const row = classMap.get(cls)!;
      row.totalCount++;

      const classStructs = structures.filter((st) => st.class === cls);
      let studentPaid = 0;
      let studentPending = 0;

      for (const fs of classStructs) {
        const targetMonth = fs.frequency === "one-time" ? "one-time" : currentMonth;
        const paid = payments.find(
          (p) =>
            String(p.student?._id) === String(s._id) &&
            String(p.feeStructure) === String(fs._id) &&
            p.status === "paid" &&
            p.month === targetMonth,
        );
        if (paid) studentPaid += paid.paidAmount;
        else studentPending += fs.amount;
      }

      row.collected += studentPaid;
      row.pending += studentPending;
      if (studentPaid > 0 && studentPending === 0) row.paid++;
      else if (studentPending > 0) row.pendingCount++;
    }

    return NextResponse.json({ success: true, data: Array.from(classMap.values()) });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load class-wise report." },
      { status: 500 },
    );
  }
}
