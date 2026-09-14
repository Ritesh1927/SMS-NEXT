import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { getRazorpayInstance } from "@/lib/razorpay";
import { FeePayment } from "@/models/FeePayment";
import { Parent } from "@/models/Parent";

// POST /api/payments/create-order — parent-only online payment flow (the
// "feePaymentId" path from SMS-BACKEND's createOrder; the FeeInvoice/
// multi-month paths aren't ported since there's no FeeInvoice model here).
export async function POST(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "parent") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { feePaymentId, amount } = await req.json();
    if (!feePaymentId) {
      return NextResponse.json({ success: false, message: "feePaymentId is required." }, { status: 400 });
    }

    await connectDB();

    const feePay = await FeePayment.findOne({ _id: feePaymentId, school: auth.schoolId });
    if (!feePay) return NextResponse.json({ success: false, message: "Fee payment record not found." }, { status: 404 });
    if (feePay.status === "paid") {
      return NextResponse.json({ success: false, message: "Already paid." }, { status: 400 });
    }

    // A parent may only pay for their own linked children.
    const parentDoc = await Parent.findById(auth.id);
    const childIds = (parentDoc?.students || []).map((id) => String(id));
    if (!childIds.includes(String(feePay.student))) {
      return NextResponse.json({ success: false, message: "Access denied." }, { status: 403 });
    }

    const payAmount = parseFloat(amount) || feePay.amount - feePay.paidAmount;
    if (payAmount <= 0) {
      return NextResponse.json({ success: false, message: "Invalid amount." }, { status: 400 });
    }

    const razorpay = getRazorpayInstance();
    if (!razorpay) return NextResponse.json({ success: false, message: "Razorpay not configured." }, { status: 500 });

    const order = await razorpay.orders.create({
      amount: Math.round(payAmount * 100),
      currency: "INR",
      receipt: `fp_${feePay._id}_${Date.now()}`,
      notes: { feePaymentId: String(feePay._id), schoolId: String(auth.schoolId) },
    });

    return NextResponse.json({
      success: true,
      data: { orderId: order.id, amount: payAmount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to create order." },
      { status: 500 },
    );
  }
}
