import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Admin } from "@/models/Admin";

// GET /api/school/holidays — the school's weekly-off days + one-off holiday
// dates. Accessible to schooladmin, teacher and parent alike (same auth
// shape as /api/school/license) since teachers need it to know why marking
// attendance on a given day is blocked, and every role's attendance calendar
// needs it to color holiday dates.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || !["schooladmin", "teacher", "parent"].includes(auth.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const admin = await Admin.findById(auth.schoolId).select("settings.holidays");
    if (!admin) return NextResponse.json({ success: false, message: "School not found." }, { status: 404 });

    const holidays = admin.settings?.holidays || { weeklyOffDays: [0], dates: [] };
    return NextResponse.json({ success: true, data: holidays });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load holidays." },
      { status: 500 },
    );
  }
}
