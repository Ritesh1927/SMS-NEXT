import { NextResponse } from "next/server";
import crypto from "crypto";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { FeePayment } from "@/models/FeePayment";
import { Parent } from "@/models/Parent";

// POST /api/payments/verify — HMAC-verifies the Razorpay checkout response
// the same way SMS-BACKEND's verifyPayment does, then marks the FeePayment
// paid. Re-checks parent ownership (not just signature validity) so one
// parent can't mark a different family's fee paid by replaying a feePaymentId
// they don't own — SMS-BACKEND's verifyPayment doesn't re-check this itself.
export async function POST(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "parent") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, feePaymentId } = await req.json();
    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature || !feePaymentId) {
      return NextResponse.json({ success: false, message: "Missing payment details." }, { status: 400 });
    }

    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) return NextResponse.json({ success: false, message: "Razorpay not configured." }, { status: 500 });

    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");
    if (expectedSig !== razorpay_signature) {
      return NextResponse.json({ success: false, message: "Payment verification failed." }, { status: 400 });
    }

    await connectDB();

    const feePay = await FeePayment.findOne({ _id: feePaymentId, school: auth.schoolId });
    if (!feePay) return NextResponse.json({ success: false, message: "Fee payment record not found." }, { status: 404 });

    const parentDoc = await Parent.findById(auth.id);
    const childIds = (parentDoc?.students || []).map((id) => String(id));
    if (!childIds.includes(String(feePay.student))) {
      return NextResponse.json({ success: false, message: "Access denied." }, { status: 403 });
    }

    feePay.paidAmount = feePay.amount;
    feePay.status = "paid";
    feePay.paymentMode = "online";
    feePay.paidDate = new Date();
    feePay.remarks = `Razorpay: ${razorpay_payment_id}`;
    await feePay.save();

    return NextResponse.json({ success: true, message: "Payment verified.", data: feePay, transactionId: razorpay_payment_id });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to verify payment." },
      { status: 500 },
    );
  }
}
