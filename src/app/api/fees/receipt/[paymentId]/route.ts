import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { FeePayment } from "@/models/FeePayment";
import { Admin } from "@/models/Admin";
import { Parent } from "@/models/Parent";
import "@/models/FeeStructure";

export async function GET(req: Request, { params }: { params: Promise<{ paymentId: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || !["schooladmin", "teacher", "parent"].includes(auth.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { paymentId } = await params;
    await connectDB();

    const payment = await FeePayment.findById(paymentId)
      .populate("student", "name studentId class section rollNumber")
      .populate("feeStructure", "title amount frequency");
    if (!payment) return NextResponse.json({ success: false, message: "Payment not found." }, { status: 404 });

    if (String(payment.school) !== String(auth.schoolId)) {
      return NextResponse.json({ success: false, message: "Access denied." }, { status: 403 });
    }
    if (auth.role === "parent") {
      const parentDoc = await Parent.findById(auth.id);
      const childIds = (parentDoc?.students || []).map((id) => String(id));
      const studentId = (payment.student as unknown as { _id: unknown } | null)?._id;
      if (!studentId || !childIds.includes(String(studentId))) {
        return NextResponse.json({ success: false, message: "Access denied." }, { status: 403 });
      }
    }

    const school = await Admin.findById(auth.schoolId).select(
      "schoolName schoolAddress schoolPhone schoolEmail logo themeColor secondaryColor",
    );

    return NextResponse.json({
      success: true,
      data: {
        receiptNo: payment.receiptNo,
        paymentDate: payment.paidDate,
        paymentMode: payment.paymentMode,
        amount: payment.amount,
        lateFee: payment.lateFee,
        paidAmount: payment.paidAmount,
        concession: payment.concession,
        month: payment.month,
        title: payment.title,
        student: payment.student,
        school,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load receipt." },
      { status: 500 },
    );
  }
}
