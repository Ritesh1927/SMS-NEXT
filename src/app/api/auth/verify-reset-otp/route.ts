import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Admin } from "@/models/Admin";
import { Teacher } from "@/models/Teacher";
import { Parent } from "@/models/Parent";
import { Student } from "@/models/Student";

async function findUserByEmail(email: string) {
  return (
    (await Admin.findOne({ email })) ||
    (await Teacher.findOne({ email })) ||
    (await Parent.findOne({ email })) ||
    (await Student.findOne({ email }))
  );
}

export async function POST(req: Request) {
  try {
    const { email, otp } = await req.json();
    if (!email || !otp) {
      return NextResponse.json({ success: false, message: "Email and OTP are required." }, { status: 400 });
    }

    await connectDB();
    const user = await findUserByEmail(email);
    if (!user) {
      return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
    }
    if (user.resetOTP !== otp || !user.resetOTPExpire || new Date(user.resetOTPExpire) < new Date()) {
      return NextResponse.json({ success: false, message: "Invalid or expired OTP." }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: "OTP verified." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Verification failed." },
      { status: 500 },
    );
  }
}
