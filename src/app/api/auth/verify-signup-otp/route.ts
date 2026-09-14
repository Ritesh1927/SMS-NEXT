import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Admin } from "@/models/Admin";
import { generateToken } from "@/lib/helpers";
import { checkAuthRateLimit } from "@/lib/rateLimit";

export async function POST(req: Request) {
  const limited = await checkAuthRateLimit(req);
  if (limited) return limited;

  try {
    const { email, otp } = await req.json();
    if (!email || !otp) {
      return NextResponse.json({ success: false, message: "Email and OTP are required." }, { status: 400 });
    }

    await connectDB();
    const admin = await Admin.findOne({ email });
    if (!admin) {
      return NextResponse.json({ success: false, message: "Admin not found." }, { status: 404 });
    }
    if (admin.isVerified) {
      return NextResponse.json({ success: false, message: "Already verified." }, { status: 400 });
    }
    if (admin.otp !== otp || !admin.otpExpire || admin.otpExpire < new Date()) {
      return NextResponse.json({ success: false, message: "Invalid or expired OTP." }, { status: 400 });
    }

    admin.isVerified = true;
    admin.otp = null;
    admin.otpExpire = null;
    await admin.save();

    const token = generateToken(admin.id, "schooladmin", admin.id);
    return NextResponse.json({
      success: true,
      message: "School registered successfully!",
      token,
      user: {
        id: admin.id,
        name: admin.name,
        email: admin.email,
        role: "schooladmin",
        schoolName: admin.schoolName,
        schoolCode: admin.schoolCode,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Verification failed." },
      { status: 500 },
    );
  }
}
