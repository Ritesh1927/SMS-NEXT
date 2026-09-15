import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Admin } from "@/models/Admin";
import { Teacher } from "@/models/Teacher";
import { Parent } from "@/models/Parent";
import { Student } from "@/models/Student";
import { hashPassword } from "@/lib/helpers";

// POST /api/auth/change-password — a logged-in user changing their own
// password from Settings, given their current password. superadmin has no
// self-service change here (it manages schools, not this per-school auth
// system).
export async function POST(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || !["schooladmin", "teacher", "parent", "student"].includes(auth.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { oldPassword, newPassword } = await req.json();
    if (!oldPassword || !newPassword) {
      return NextResponse.json({ success: false, message: "Current and new password are required." }, { status: 400 });
    }
    if (String(newPassword).length < 6) {
      return NextResponse.json({ success: false, message: "New password must be at least 6 characters." }, { status: 400 });
    }

    await connectDB();
    const user =
      auth.role === "schooladmin" ? await Admin.findById(auth.id) :
      auth.role === "teacher" ? await Teacher.findById(auth.id) :
      auth.role === "parent" ? await Parent.findById(auth.id) :
      await Student.findById(auth.id);
    if (!user) {
      return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
    }

    const matches = await user.comparePassword(oldPassword);
    if (!matches) {
      return NextResponse.json({ success: false, message: "Current password is incorrect." }, { status: 400 });
    }

    user.password = await hashPassword(newPassword);
    await user.save();

    return NextResponse.json({ success: true, message: "Password changed successfully." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to change password." },
      { status: 500 },
    );
  }
}
