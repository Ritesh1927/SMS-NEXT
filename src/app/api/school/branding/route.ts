import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Admin } from "@/models/Admin";

// GET /api/school/branding — the handful of public-ish fields (name,
// contact, logo, theme colors) fee receipts need. Unlike /school/profile
// this is available to teachers and parents too, since anyone who can
// generate a receipt (fee-collecting teacher, self-paying parent) needs it.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || !["schooladmin", "teacher", "parent"].includes(auth.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const admin = await Admin.findById(auth.schoolId).select(
      "schoolName schoolAddress schoolPhone schoolEmail logo themeColor secondaryColor settings.sessionStartMonth",
    );
    if (!admin) return NextResponse.json({ success: false, message: "School not found." }, { status: 404 });

    return NextResponse.json({ success: true, data: admin });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load school branding." },
      { status: 500 },
    );
  }
}
