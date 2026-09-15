import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { School } from "@/models/School";
import { Plan } from "@/models/Plan";

// Only schools registered through the Super Admin flow have a School
// document (self-signup schools don't) — absent is a normal, silent case,
// not an error, since most schools have no license to track.
//
// Accessible to schooladmin, teacher and parent — all three need it
// (schooladmin for the expiry banner, all three for plan-based feature
// gating in the sidebar). auth.schoolId (not auth.id) is what identifies
// the tenant for every role.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || !["schooladmin", "teacher", "parent"].includes(auth.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const school = await School.findOne({ adminUserId: auth.schoolId }).select("license");
    if (!school) return NextResponse.json({ success: true, data: null });

    const { endDate, extraUsers, includedUsers, status, planName, planId } = school.license;
    const daysLeft = endDate ? Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

    const plan = planId ? await Plan.findById(planId).select("features") : null;

    return NextResponse.json({
      success: true,
      data: {
        endDate,
        daysLeft,
        status,
        planName,
        usersTotal: (includedUsers || 0) + (extraUsers || 0),
        features: plan?.features || [],
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load license." },
      { status: 500 },
    );
  }
}
