import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Admin } from "@/models/Admin";
import { generateOTP, hashPassword } from "@/lib/helpers";
import { sendOTPMail } from "@/lib/mail";
import { checkAuthRateLimit } from "@/lib/rateLimit";

// School signup: the school's Admin account doubles as the school record
// itself (mirrors SMS-BACKEND, which keeps school profile fields directly on
// Admin). An unverified record from a previous attempt is reused instead of
// blocked, so a failed OTP send doesn't permanently trap that email address.
export async function POST(req: Request) {
  const limited = await checkAuthRateLimit(req);
  if (limited) return limited;

  try {
    const { schoolName, schoolAddress, schoolPhone, name, email, password, phone } = await req.json();
    if (!schoolName || !name || !email || !password) {
      return NextResponse.json(
        { success: false, message: "School name, admin name, email, password required." },
        { status: 400 },
      );
    }

    await connectDB();
    const existing = await Admin.findOne({ email });
    if (existing && existing.isVerified) {
      return NextResponse.json({ success: false, message: "Email already registered." }, { status: 400 });
    }

    const otp = generateOTP();
    const otpExpire = new Date(Date.now() + 5 * 60 * 1000);
    const hashedPassword = await hashPassword(password);

    if (existing) {
      existing.set({
        schoolName,
        schoolAddress: schoolAddress || "",
        schoolPhone: schoolPhone || "",
        name,
        phone: phone || "",
        password: hashedPassword,
        otp,
        otpExpire,
      });
      await existing.save();
    } else {
      await Admin.create({
        schoolName,
        schoolAddress: schoolAddress || "",
        schoolPhone: schoolPhone || "",
        name,
        email,
        phone: phone || "",
        password: hashedPassword,
        otp,
        otpExpire,
        isVerified: false,
      });
    }

    try {
      await sendOTPMail(email, otp);
    } catch (mailErr) {
      // Never leak raw mail-provider errors (SMTP credentials, server
      // banners, etc.) to the client. The Admin record above is already
      // saved as unverified, so a retry (signup or resend-otp) can reuse it.
      console.error("Signup OTP mail failed:", mailErr instanceof Error ? mailErr.message : mailErr);
      return NextResponse.json(
        { success: false, message: "Failed to send the OTP email. Please try again in a moment." },
        { status: 502 },
      );
    }

    return NextResponse.json(
      { success: true, message: "OTP sent to email. Verify to complete signup.", email },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Signup failed." },
      { status: 500 },
    );
  }
}
