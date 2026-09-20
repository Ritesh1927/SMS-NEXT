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
    if (!school.adminUserId) {
      return NextResponse.json({ success: false, message: "This school has no linked admin account." }, { status: 400 });
    }

    const admin = await Admin.findById(school.adminUserId);
    if (!admin) return NextResponse.json({ success: false, message: "Linked admin account not found." }, { status: 404 });

    admin.settings.allowAttendanceEdit = !admin.settings.allowAttendanceEdit;
    await admin.save();

    return NextResponse.json({
      success: true,
      message: `Attendance editing ${admin.settings.allowAttendanceEdit ? "enabled" : "disabled"} for ${school.name}.`,
      allowAttendanceEdit: admin.settings.allowAttendanceEdit,
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to toggle attendance edit." },
      { status: 500 },
    );
  }
}
