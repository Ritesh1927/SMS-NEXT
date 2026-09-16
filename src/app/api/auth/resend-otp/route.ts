import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Admin } from "@/models/Admin";
import { generateOTP } from "@/lib/helpers";
import { sendOTPMail } from "@/lib/mail";
import { checkAuthRateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  const limited = await checkAuthRateLimit(req);
  if (limited) return limited;

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

    try {
      await sendOTPMail(email, otp);
    } catch (mailErr) {
      // Never leak raw mail-provider errors (SMTP credentials, server
      // banners, etc.) to the client.
      console.error("OTP mail failed:", mailErr instanceof Error ? mailErr.message : mailErr);
      return NextResponse.json(
        { success: false, message: "Failed to send the OTP email. Please try again in a moment." },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, message: "OTP resent." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Resend failed." },
      { status: 500 },
    );
  }
}
