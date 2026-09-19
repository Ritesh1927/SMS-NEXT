import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { FeeStructure, type IFeeStructure } from "@/models/FeeStructure";
import { FeePayment, type IFeePayment } from "@/models/FeePayment";
import { Concession, type IConcession } from "@/models/Concession";
import { Student } from "@/models/Student";
import { Admin } from "@/models/Admin";
import { Parent } from "@/models/Parent";
import {
  calcProjectedLateFee,
  concessionAppliesToMonth,
  generateSessionMonths,
  filterMonthsByAdmission,
} from "@/lib/feeEngine";

// GET /api/fees/student-status/[studentId] — per-fee-head, per-month status
// for the current academic session. Powers the month-grid collection UI for
// both admin (SimpleFeeCollect) and parent self-pay.
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

    const student = await Student.findOne({ _id: studentId, school: auth.schoolId });
    if (!student) return NextResponse.json({ success: false, message: "Student not found." }, { status: 404 });

    const structures = await FeeStructure.find({
      school: auth.schoolId,
      class: student.class,
      isActive: true,
    }).lean<IFeeStructure[]>();

    const payments = await FeePayment.find({ school: auth.schoolId, student: studentId }).lean<IFeePayment[]>();

    const paidMap = new Map<string, IFeePayment>();
    for (const p of payments) {
      if (p.status === "paid" && p.feeStructure) {
        const key = `${String(p.feeStructure)}|${p.month || "one-time"}`;
        paidMap.set(key, p);
      }
    }

    const concessions = await Concession.find({ school: auth.schoolId, student: studentId }).lean<IConcession[]>();

    const school = await Admin.findById(auth.schoolId).select("settings");
    const lateFeeConfig = school?.settings?.lateFee || {};

    const now = new Date();
    const allMonths = generateSessionMonths(school?.settings?.sessionStartMonth || "April", now.getFullYear());
    const months = filterMonthsByAdmission(allMonths, student.admissionDate);

    type MonthStatus = {
      month: string;
      paid: boolean;
      amount: number;
      paidAmount: number;
      lateFee: number;
      concession: number;
      paymentId: unknown;
      receiptNo: string | null;
      paidDate: Date | null;
      paymentMode: string | null;
    };

    const buildStatus = (fs: IFeeStructure, month: string, concessionAmount: number): MonthStatus => {
      const key = `${String(fs._id)}|${month}`;
      const paid = paidMap.get(key) || null;
      const projectedLateFee = paid ? 0 : calcProjectedLateFee(lateFeeConfig, fs.amount, fs.dueDate);
      return {
        month,
        paid: !!paid,
        amount: paid ? paid.amount : fs.amount + projectedLateFee,
        paidAmount: paid ? paid.paidAmount : 0,
        lateFee: paid ? paid.lateFee : projectedLateFee,
        concession: paid ? paid.concession || 0 : concessionAmount,
        paymentId: paid ? paid._id : null,
        receiptNo: paid ? paid.receiptNo : null,
        paidDate: paid ? paid.paidDate : null,
        paymentMode: paid ? paid.paymentMode : null,
      };
    };

    const feeHeads = structures.map((fs) => {
      const allConcessions = concessions.filter(
        (c) => !c.feeStructure || String(c.feeStructure) === String(fs._id),
      );

      let monthStatus: MonthStatus[];
      if (fs.frequency === "one-time") {
        const applicable = allConcessions.find((c) => concessionAppliesToMonth(c, "one-time"));
        const concessionAmount = applicable
          ? applicable.isPct
            ? Math.round((fs.amount * applicable.value) / 100)
            : Math.min(applicable.value, fs.amount)
          : 0;
        monthStatus = [buildStatus(fs, "one-time", concessionAmount)];
      } else if (fs.frequency === "yearly") {
        const dueMonth = fs.dueDate
          ? `${new Date(fs.dueDate).getFullYear()}-${String(new Date(fs.dueDate).getMonth() + 1).padStart(2, "0")}`
          : months[0] || `${now.getFullYear()}-04`;
        const applicable = allConcessions.find((c) => concessionAppliesToMonth(c, dueMonth));
        const concessionAmount = applicable
          ? applicable.isPct
            ? Math.round((fs.amount * applicable.value) / 100)
            : Math.min(applicable.value, fs.amount)
          : 0;
        monthStatus = [buildStatus(fs, dueMonth, concessionAmount)];
      } else {
        let oneTimeConcessionUsed = false;
        monthStatus = months.map((month) => {
          const applicable = allConcessions.find((c) => {
            if (!concessionAppliesToMonth(c, month)) return false;
            if (c.duration === "one-time") {
              if (oneTimeConcessionUsed) return false;
              oneTimeConcessionUsed = true;
            }
            return true;
          });
          const concessionAmount = applicable
            ? applicable.isPct
              ? Math.round((fs.amount * applicable.value) / 100)
              : Math.min(applicable.value, fs.amount)
            : 0;
          return buildStatus(fs, month, concessionAmount);
        });
      }

      const displayConcession = allConcessions.find(
        (c) => c.duration !== "one-time" || !(c.appliedMonths && c.appliedMonths.length > 0),
      );

      return {
        _id: fs._id,
        title: fs.title,
        amount: fs.amount,
        frequency: fs.frequency,
        dueDate: fs.dueDate,
        concession: displayConcession
          ? {
              type: displayConcession.type,
              value: displayConcession.value,
              isPct: displayConcession.isPct,
              duration: displayConcession.duration,
            }
          : null,
        months: monthStatus,
      };
    });

    return NextResponse.json({
      success: true,
      data: {
        student: { _id: student._id, name: student.name, class: student.class, section: student.section },
        feeHeads,
        lateFeeConfig,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load fee status." },
      { status: 500 },
    );
  }
}
