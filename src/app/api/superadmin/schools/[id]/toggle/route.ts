import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth-server";
import { School } from "@/models/School";
import { Admin } from "@/models/Admin";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireSuperAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    await connectDB();
    const school = await School.findById(id);
    if (!school) return NextResponse.json({ success: false, message: "School not found." }, { status: 404 });

    school.isActive = !school.isActive;
    await school.save();

    if (school.adminUserId) {
      await Admin.findByIdAndUpdate(school.adminUserId, { isActive: school.isActive });
    }

    return NextResponse.json({
      success: true,
      message: `School ${school.isActive ? "activated" : "deactivated"}.`,
      isActive: school.isActive,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to toggle school." },
      { status: 500 },
    );
  }
}
