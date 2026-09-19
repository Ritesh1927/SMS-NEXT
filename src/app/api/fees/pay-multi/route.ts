import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser, requireFeeManager } from "@/lib/auth-server";
import { FeeStructure } from "@/models/FeeStructure";
import { FeePayment, type PaymentMode } from "@/models/FeePayment";
import { Concession, type IConcession } from "@/models/Concession";
import { Student } from "@/models/Student";
import { Admin } from "@/models/Admin";
import { Parent } from "@/models/Parent";
import { calcProjectedLateFee, concessionAppliesToMonth } from "@/lib/feeEngine";

interface PayMultiItem {
  feeStructureId: string;
  months: string[];
}

// POST /api/fees/pay-multi
// Body: { studentId, items: [{ feeStructureId, months }], paymentMode, remarks }
// Creates one FeePayment per month per fee head, full amount only (no
// partial payments), applying late fee + concession. Used by both the admin
// collection UI (cash/cheque/dd, paid immediately) and the parent/student
// self-pay flow (online, created pending then confirmed by /payments/verify).
export async function POST(req: Request) {
  await connectDB();

  const auth = getAuthUser(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const body = await req.json();
  const { studentId, items, paymentMode, remarks } = body as {
    studentId: string;
    items: PayMultiItem[];
    paymentMode?: PaymentMode;
    remarks?: string;
  };

  if (!studentId || !items || !Array.isArray(items) || items.length === 0) {
    return NextResponse.json({ success: false, message: "studentId and items array required." }, { status: 400 });
  }

  // Admin/teacher use requireFeeManager (permission-gated); a parent may
  // only pay for their own linked child, always via "online".
  if (auth.role === "parent") {
    if (paymentMode !== "online") {
      return NextResponse.json({ success: false, message: "Parents may only pay online." }, { status: 403 });
    }
    const parentDoc = await Parent.findById(auth.id);
    const childIds = (parentDoc?.students || []).map((id) => String(id));
    if (!childIds.includes(studentId)) {
      return NextResponse.json({ success: false, message: "This student is not linked to your account." }, { status: 403 });
    }
  } else {
    const result = await requireFeeManager(req);
    if ("error" in result) return result.error;
  }

  try {
    const student = await Student.findOne({ _id: studentId, school: auth.schoolId });
    if (!student) return NextResponse.json({ success: false, message: "Student not found." }, { status: 404 });

    let earliestPayableMonth: string | null = null;
    if (student.admissionDate) {
      const admDate = new Date(student.admissionDate);
      earliestPayableMonth = `${admDate.getFullYear()}-${String(admDate.getMonth() + 1).padStart(2, "0")}`;
    }

    const school = await Admin.findById(auth.schoolId).select("settings");
    const lateFeeConfig = school?.settings?.lateFee || {};

    const concessions = await Concession.find({ school: auth.schoolId, student: studentId });

    const payments = [];
    let totalPaid = 0;
    let totalConcession = 0;
    let totalLateFee = 0;

    for (const item of items) {
      const { feeStructureId, months } = item;
      if (!feeStructureId || !months || !Array.isArray(months) || months.length === 0) continue;

      const fs = await FeeStructure.findOne({ _id: feeStructureId, school: auth.schoolId });
      if (!fs) continue;

      for (const month of months) {
        if (earliestPayableMonth && month !== "one-time" && month < earliestPayableMonth) continue;

        const existingPaid = await FeePayment.findOne({
          school: auth.schoolId,
          student: studentId,
          feeStructure: feeStructureId,
          month,
          status: "paid",
        });
        if (existingPaid) continue;

        let existingPending = null;
        if (paymentMode === "online") {
          existingPending = await FeePayment.findOne({
            school: auth.schoolId,
            student: studentId,
            feeStructure: feeStructureId,
            month,
            status: "pending",
          });
        }

        if (!existingPending) {
          await FeePayment.deleteMany({
            school: auth.schoolId,
            student: studentId,
            feeStructure: feeStructureId,
            month: { $in: [month, null] },
            status: { $ne: "paid" },
          });
        }

        const baseAmount = fs.amount;
        let lateFeeAmount = 0;
        if (fs.dueDate) lateFeeAmount = calcProjectedLateFee(lateFeeConfig, baseAmount, fs.dueDate);

        let concessionAmount = 0;
        const applicableConcession = concessions.find(
          (c) =>
            (!c.feeStructure || String(c.feeStructure) === String(feeStructureId)) &&
            concessionAppliesToMonth(c as unknown as IConcession, month),
        );
        if (applicableConcession) {
          concessionAmount = applicableConcession.isPct
            ? Math.round((baseAmount * applicableConcession.value) / 100)
            : Math.min(applicableConcession.value, baseAmount);

          if (applicableConcession.duration === "one-time") {
            await Concession.findByIdAndUpdate(applicableConcession._id, { $addToSet: { appliedMonths: month } });
          }
        }

        const totalAmount = baseAmount + lateFeeAmount - concessionAmount;
        const isOnlinePayment = paymentMode === "online";

        let payment;
        if (existingPending) {
          existingPending.amount = totalAmount;
          existingPending.lateFee = lateFeeAmount;
          existingPending.concession = concessionAmount;
          existingPending.paidAmount = 0;
          existingPending.status = "pending";
          await existingPending.save();
          payment = existingPending;
        } else {
          payment = await FeePayment.create({
            school: auth.schoolId,
            student: studentId,
            feeStructure: feeStructureId,
            title: fs.title,
            month,
            amount: totalAmount,
            lateFee: lateFeeAmount,
            paidAmount: isOnlinePayment ? 0 : totalAmount,
            concession: concessionAmount,
            dueDate: fs.dueDate,
            paidDate: isOnlinePayment ? null : new Date(),
            status: isOnlinePayment ? "pending" : "paid",
            paymentMode: paymentMode || "cash",
            remarks: remarks || "",
            collectedBy: auth.role === "teacher" ? auth.id : null,
          });
        }

        payments.push(payment);
        totalPaid += totalAmount;
        totalConcession += concessionAmount;
        totalLateFee += lateFeeAmount;

        await Student.findByIdAndUpdate(studentId, { $inc: { points: 5 } });
      }
    }

    return NextResponse.json({
      success: true,
      message: `${payments.length} payment(s) recorded.`,
      data: { payments, summary: { totalPaid, totalConcession, totalLateFee, count: payments.length } },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to record payment." },
      { status: 500 },
    );
  }
}
