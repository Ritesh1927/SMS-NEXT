import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Admin } from "@/models/Admin";
import { Teacher } from "@/models/Teacher";
import { Parent } from "@/models/Parent";
import { Student } from "@/models/Student";
import { generateOTP } from "@/lib/helpers";
import { sendPasswordResetMail } from "@/lib/mail";
import { checkAuthRateLimit } from "@/lib/rateLimit";

async function findUserByRole(email: string, role?: string) {
  if (role === "schooladmin") return Admin.findOne({ email });
  if (role === "teacher") return Teacher.findOne({ email });
  if (role === "parent") return Parent.findOne({ email });
  if (role === "student") return Student.findOne({ email });
  return (
    (await Admin.findOne({ email })) ||
    (await Teacher.findOne({ email })) ||
    (await Parent.findOne({ email })) ||
    (await Student.findOne({ email }))
  );
}

export async function POST(req: Request) {
  const limited = await checkAuthRateLimit(req);
  if (limited) return limited;

  try {
    const { email, role } = await req.json();
    if (!email) {
      return NextResponse.json({ success: false, message: "Email is required." }, { status: 400 });
    }

    await connectDB();
    const user = await findUserByRole(email, role);
    if (!user) {
      return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
    }

    const otp = generateOTP();
    user.resetOTP = otp;
    user.resetOTPExpire = new Date(Date.now() + 5 * 60 * 1000);
    await user.save();

    try {
      await sendPasswordResetMail(email, otp);
    } catch (mailErr) {
      // Never leak raw mail-provider errors (SMTP credentials, server
      // banners, etc.) to the client.
      console.error("Password reset mail failed:", mailErr instanceof Error ? mailErr.message : mailErr);
      return NextResponse.json(
        { success: false, message: "Failed to send the reset email. Please try again in a moment." },
        { status: 502 },
      );
    }

    return NextResponse.json({ success: true, message: "Password reset OTP sent to email." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Request failed." },
      { status: 500 },
    );
  }
}
