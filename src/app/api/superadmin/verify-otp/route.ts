import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { SuperAdmin } from "@/models/SuperAdmin";
import { generateToken } from "@/lib/helpers";

// Step 2 of SuperAdmin login: verify the emailed OTP and issue the real
// session token.
export async function POST(req: Request) {
  try {
    const { email, otp } = await req.json();
    if (!email || !otp) {
      return NextResponse.json({ success: false, message: "Email and OTP are required." }, { status: 400 });
    }

    await connectDB();
    const sa = await SuperAdmin.findOne({ email });
    if (!sa) {
      return NextResponse.json({ success: false, message: "Super admin not found." }, { status: 404 });
    }
    if (sa.otp !== otp || !sa.otpExpire || sa.otpExpire < new Date()) {
      return NextResponse.json({ success: false, message: "Invalid or expired OTP." }, { status: 400 });
    }

    sa.otp = null;
    sa.otpExpire = null;
    await sa.save();

    const token = generateToken(sa.id, "superadmin", sa.id);
    return NextResponse.json({
      success: true,
      message: "Login successful",
      token,
      user: { id: sa.id, name: sa.name, email: sa.email, role: "superadmin" },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Verification failed." },
      { status: 500 },
    );
  }
}
