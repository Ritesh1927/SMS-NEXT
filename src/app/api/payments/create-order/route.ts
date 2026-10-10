import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { getRazorpayInstance } from "@/lib/razorpay";
import { FeePayment } from "@/models/FeePayment";
import { Parent } from "@/models/Parent";

// POST /api/payments/create-order — parent-only online payment flow (the
// "feePaymentId" path from SMS-BACKEND's createOrder; the FeeInvoice/
// multi-month paths aren't ported since there's no FeeInvoice model here).
// The order amount is ALWAYS computed server-side as the sum of the
// outstanding balance of every listed pending record — a client-supplied
// "amount" is ignored so a tampered request can't underpay and still have
// /payments/verify mark the records fully paid. The record ids are stored
// in the order notes; /payments/verify requires the verified record to be
// part of that batch.
export async function POST(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "parent") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const body = (await req.json()) as { feePaymentIds?: unknown; feePaymentId?: unknown };
    const requested = Array.isArray(body.feePaymentIds)
      ? body.feePaymentIds
      : body.feePaymentId
        ? [body.feePaymentId]
        : [];
    // Only well-formed ObjectIds reach the query; anything else is dropped.
    const requestedIds = [...new Set(requested.map(String))].filter((id) => /^[0-9a-fA-F]{24}$/.test(id));
    if (requestedIds.length === 0) {
      return NextResponse.json({ success: false, message: "feePaymentIds (or feePaymentId) is required." }, { status: 400 });
    }

    await connectDB();

    const feePays = await FeePayment.find({ _id: { $in: requestedIds }, school: auth.schoolId });
    if (feePays.length === 0) {
      return NextResponse.json({ success: false, message: "Fee payment record not found." }, { status: 404 });
    }

    // A parent may only pay for their own linked children.
    const parentDoc = await Parent.findById(auth.id);
    const childIds = (parentDoc?.students || []).map((id) => String(id));

    let payAmount = 0;
    const payableIds: string[] = [];
    for (const feePay of feePays) {
      if (!childIds.includes(String(feePay.student))) {
        return NextResponse.json({ success: false, message: "Access denied." }, { status: 403 });
      }
      if (feePay.status === "paid") continue;
      const outstanding = feePay.amount - feePay.paidAmount;
      if (outstanding <= 0) continue;
      payAmount += outstanding;
      payableIds.push(String(feePay._id));
    }
    if (payableIds.length === 0) {
      return NextResponse.json({ success: false, message: "Already paid." }, { status: 400 });
    }
    if (payAmount <= 0) {
      return NextResponse.json({ success: false, message: "Invalid amount." }, { status: 400 });
    }

    const razorpay = getRazorpayInstance();
    if (!razorpay) return NextResponse.json({ success: false, message: "Razorpay not configured." }, { status: 500 });

    const order = await razorpay.orders.create({
      amount: Math.round(payAmount * 100),
      currency: "INR",
      receipt: `fp_${payableIds[0]}_${Date.now()}`,
      notes: { feePaymentIds: payableIds.join(","), schoolId: String(auth.schoolId) },
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
