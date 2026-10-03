import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Admin } from "@/models/Admin";

// GET /api/school/holidays — the school's weekly-off days, one-off holiday
// dates, and events. Accessible to schooladmin, teacher and parent alike
// (same auth shape as /api/school/license) since teachers need it to know
// why marking attendance on a given day is blocked, and every role's
// calendar needs it to color holiday/event dates. Events are included here
// (despite the route's name) purely so every consumer that needs holidays
// also gets events in the same request, rather than a second round trip --
// they're a separate top-level settings key, not nested under holidays,
// since unlike holidays they never block attendance.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || !["schooladmin", "teacher", "parent"].includes(auth.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const admin = await Admin.findById(auth.schoolId).select("settings.holidays settings.events");
    if (!admin) return NextResponse.json({ success: false, message: "School not found." }, { status: 404 });

    const holidays = admin.settings?.holidays || { weeklyOffDays: [0], dates: [] };
    const events = admin.settings?.events || [];
    return NextResponse.json({ success: true, data: { ...holidays, events } });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load holidays." },
      { status: 500 },
    );
  }
}
