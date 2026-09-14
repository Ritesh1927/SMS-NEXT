import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Admin } from "@/models/Admin";
import { Teacher } from "@/models/Teacher";
import { Parent } from "@/models/Parent";
import { Student } from "@/models/Student";
import { hashPassword } from "@/lib/helpers";
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
    const { email, otp, newPassword, role } = await req.json();
    if (!email || !otp || !newPassword) {
      return NextResponse.json(
        { success: false, message: "Email, OTP and new password are required." },
        { status: 400 },
      );
    }

    await connectDB();
    const user = await findUserByRole(email, role);
    if (!user) {
      return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
    }
    if (user.resetOTP !== otp || !user.resetOTPExpire || new Date(user.resetOTPExpire) < new Date()) {
      return NextResponse.json({ success: false, message: "Invalid or expired OTP." }, { status: 400 });
    }

    user.password = await hashPassword(newPassword);
    user.resetOTP = null;
    user.resetOTPExpire = null;
    await user.save();

    return NextResponse.json({ success: true, message: "Password reset successful. Please login." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Reset failed." },
      { status: 500 },
    );
  }
}
