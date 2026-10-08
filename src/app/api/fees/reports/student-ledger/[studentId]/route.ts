import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { FeePayment, type IFeePayment } from "@/models/FeePayment";
import { FeeStructure, type IFeeStructure } from "@/models/FeeStructure";
import { Concession, type IConcession } from "@/models/Concession";
import { Student } from "@/models/Student";
import { Admin } from "@/models/Admin";
import {
  generateSessionMonths,
  filterMonthsByAdmission,
  resolveFeeMonths,
  calcProjectedLateFee,
  concessionAppliesToMonth,
  concessionAmount,
} from "@/lib/feeEngine";

interface MonthRow {
  month: string;
  amount: number;
  lateFee: number;
  concession: number;
  total: number;
  paidAmount: number;
  balance: number;
  status: "paid" | "pending" | "upcoming";
  receiptNo: string | null;
  paidDate: Date | null;
  paymentMode: string | null;
}

// GET /api/fees/reports/student-ledger/[studentId] — per-fee-head month
// tables plus a grand summary, for the "Student Ledger" sub-tab.
export async function GET(req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { studentId } = await params;
    await connectDB();

    const student = await Student.findOne({ _id: studentId, school: auth.schoolId });
    if (!student) return NextResponse.json({ success: false, message: "Student not found." }, { status: 404 });

    const structures = await FeeStructure.find({ school: auth.schoolId, class: student.class, isActive: true }).lean<IFeeStructure[]>();
    const payments = await FeePayment.find({ school: auth.schoolId, student: studentId }).lean<IFeePayment[]>();
    const concessions = await Concession.find({ school: auth.schoolId, student: studentId }).lean<IConcession[]>();
    const school = await Admin.findById(auth.schoolId).select("settings");
    const lateFeeConfig = school?.settings?.lateFee || {};

    const now = new Date();
    const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const sessionMonths = generateSessionMonths(school?.settings?.sessionStartMonth || "April", now.getFullYear());
    const applicableMonths = filterMonthsByAdmission(sessionMonths, student.admissionDate);

    const findPaid = (fsId: unknown, month: string) =>
      payments.find((p) => String(p.feeStructure) === String(fsId) && p.status === "paid" && p.month === month) || null;

    const data = structures.map((fs) => {
      let months: MonthRow[];

      const rowLateFee = (monthKey: string) => {
        // Late fee applies to monthly fees only — paid rows still show the
        // late fee actually recorded at payment time.
        if (fs.frequency !== "monthly") return 0;
        let due: Date | string | null | undefined = fs.dueDate;
        if (monthKey !== "one-time") {
          const d = new Date(monthKey + "-01");
          if (fs.dueDate) d.setDate(new Date(fs.dueDate).getDate());
          due = d;
        }
        return calcProjectedLateFee(lateFeeConfig, fs.amount, due);
      };

      const headCons = concessions.filter((c) => !c.feeStructure || String(c.feeStructure) === String(fs._id));
      let oneTimeConUsed = false;
      const rowConcession = (monthKey: string, paid: IFeePayment | null) => {
        const applicable = headCons.find((c) => {
          if (!concessionAppliesToMonth(c, monthKey)) return false;
          if (c.duration === "one-time") {
            if (oneTimeConUsed) return false;
            oneTimeConUsed = true;
          }
          return true;
        });
        if (!applicable) return paid?.concession || 0;
        return paid ? paid.concession || 0 : concessionAmount(fs.amount, applicable);
      };

      if (fs.frequency === "one-time") {
        const paid = findPaid(fs._id, "one-time");
        const lateFee = paid ? paid.lateFee || 0 : rowLateFee("one-time");
        const concession = rowConcession("one-time", paid);
        const total = fs.amount + lateFee - concession;
        const paidAmt = paid?.paidAmount || 0;
        months = [{
          month: "one-time", amount: fs.amount, lateFee, concession,
          total, paidAmount: paidAmt, balance: total - paidAmt, status: paid ? "paid" : "pending",
          receiptNo: paid?.receiptNo || null, paidDate: paid?.paidDate || null, paymentMode: paid?.paymentMode || null,
        }];
      } else if (fs.frequency === "yearly") {
        const dueMonth = fs.dueDate
          ? `${new Date(fs.dueDate).getFullYear()}-${String(new Date(fs.dueDate).getMonth() + 1).padStart(2, "0")}`
          : applicableMonths[0] || `${now.getFullYear()}-04`;
        const paid = findPaid(fs._id, dueMonth);
        const lateFee = paid ? paid.lateFee || 0 : rowLateFee(dueMonth);
        const concession = rowConcession(dueMonth, paid);
        const total = fs.amount + lateFee - concession;
        const paidAmt = paid?.paidAmount || 0;
        const dueDate = new Date(dueMonth + "-01");
        const status: MonthRow["status"] = paid ? "paid" : dueDate < now ? "pending" : "upcoming";
        months = [{
          month: dueMonth, amount: fs.amount, lateFee, concession,
          total, paidAmount: paidAmt, balance: total - paidAmt, status,
          receiptNo: paid?.receiptNo || null, paidDate: paid?.paidDate || null, paymentMode: paid?.paymentMode || null,
        }];
      } else {
        const targetMonths = resolveFeeMonths(fs.frequency, applicableMonths, sessionMonths, fs.dueDate);
        months = targetMonths.map((monthKey) => {
          const paid = findPaid(fs._id, monthKey);
          const lateFee = paid ? paid.lateFee || 0 : rowLateFee(monthKey);
          const concession = rowConcession(monthKey, paid);
          const total = fs.amount + lateFee - concession;
          const paidAmt = paid?.paidAmount || 0;
          const status: MonthRow["status"] = paid ? "paid" : monthKey <= currentMonthKey ? "pending" : "upcoming";
          return {
            month: monthKey, amount: fs.amount, lateFee, concession,
            total, paidAmount: paidAmt, balance: total - paidAmt, status,
            receiptNo: paid?.receiptNo || null, paidDate: paid?.paidDate || null, paymentMode: paid?.paymentMode || null,
          };
        });
      }

      const summary = {
        totalAmount: months.reduce((s, r) => s + r.amount, 0),
        totalLateFee: months.reduce((s, r) => s + r.lateFee, 0),
        totalConcession: months.reduce((s, r) => s + r.concession, 0),
        totalPaid: months.reduce((s, r) => s + r.paidAmount, 0),
        totalBalance: months.reduce((s, r) => s + r.balance, 0),
      };

      return {
        feeStructure: { _id: fs._id, title: fs.title, amount: fs.amount, frequency: fs.frequency },
        months,
        summary,
      };
    });

    const grandSummary = {
      totalAmount: data.reduce((s, d) => s + d.summary.totalAmount, 0),
      totalLateFee: data.reduce((s, d) => s + d.summary.totalLateFee, 0),
      totalConcession: data.reduce((s, d) => s + d.summary.totalConcession, 0),
      totalPaid: data.reduce((s, d) => s + d.summary.totalPaid, 0),
      totalBalance: data.reduce((s, d) => s + d.summary.totalBalance, 0),
    };

    return NextResponse.json({ success: true, data, grandSummary });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load student ledger." },
      { status: 500 },
    );
  }
}
