import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth-server";
import { School } from "@/models/School";
import { Admin } from "@/models/Admin";
import { generatePassword, hashPassword } from "@/lib/helpers";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireSuperAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    await connectDB();
    const school = await School.findById(id);
    if (!school) return NextResponse.json({ success: false, message: "School not found." }, { status: 404 });
    if (!school.adminUserId) {
      return NextResponse.json({ success: false, message: "No admin linked to this school." }, { status: 404 });
    }

    const rawPassword = generatePassword();
    const hashed = await hashPassword(rawPassword);
    await Admin.findByIdAndUpdate(school.adminUserId, { password: hashed });
    await School.findByIdAndUpdate(school._id, { adminPassword: hashed });

    return NextResponse.json({ success: true, message: "Admin password reset.", newPassword: rawPassword });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to reset password." },
      { status: 500 },
    );
  }
}
