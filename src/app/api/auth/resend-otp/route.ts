import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Admin } from "@/models/Admin";
import { generateOTP } from "@/lib/helpers";
import { sendOTPMail } from "@/lib/mail";

export async function POST(req: Request) {
  try {
    const { email } = await req.json();
    if (!email) {
      return NextResponse.json({ success: false, message: "Email is required." }, { status: 400 });
    }

    await connectDB();
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return NextResponse.json({ success: false, message: "Admin not found." }, { status: 404 });
    }
    if (admin.isVerified) {
      return NextResponse.json({ success: false, message: "Already verified." }, { status: 400 });
    }

    const otp = generateOTP();
    admin.otp = otp;
    admin.otpExpire = new Date(Date.now() + 5 * 60 * 1000);
    await admin.save();
    await sendOTPMail(email, otp);

    return NextResponse.json({ success: true, message: "OTP resent." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Resend failed." },
      { status: 500 },
    );
  }
}
