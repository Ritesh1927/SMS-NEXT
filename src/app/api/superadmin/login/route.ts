import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { SuperAdmin } from "@/models/SuperAdmin";
import { generateOTP } from "@/lib/helpers";
import { sendOTPMail } from "@/lib/mail";
import { checkAuthRateLimit } from "@/lib/rateLimit";

// Step 1 of SuperAdmin login: verify email + password, then email a one-time
// code. The actual session token is only issued after that OTP is verified
// (see /api/superadmin/verify-otp) — mirrors SMS-BACKEND's two-step flow.
export async function POST(req: Request) {
  const limited = await checkAuthRateLimit(req);
  if (limited) return limited;

  try {
    const { email, password } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ success: false, message: "Email and password are required." }, { status: 400 });
    }

    await connectDB();
    const sa = await SuperAdmin.findOne({ email });
    if (!sa) {
      return NextResponse.json({ success: false, message: "Super admin not found." }, { status: 404 });
    }
    if (!(await sa.comparePassword(password))) {
      return NextResponse.json({ success: false, message: "Incorrect password." }, { status: 401 });
    }
    if (!sa.isActive) {
      return NextResponse.json({ success: false, message: "Account deactivated." }, { status: 403 });
    }

    const otp = generateOTP();
    sa.otp = otp;
    sa.otpExpire = new Date(Date.now() + 5 * 60 * 1000);
    await sa.save();

    try {
      await sendOTPMail(sa.email, otp);
    } catch (mailErr) {
      // Never leak raw mail-provider errors (SMTP credentials, server
      // banners, etc.) to the client.
      console.error("Super admin OTP mail failed:", mailErr instanceof Error ? mailErr.message : mailErr);
      return NextResponse.json(
        { success: false, message: "Failed to send the OTP email. Please try again in a moment." },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, message: "OTP sent to your email.", email: sa.email });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Login failed." },
      { status: 500 },
    );
  }
}
