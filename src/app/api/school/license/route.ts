import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { School } from "@/models/School";

// Only schools registered through the Super Admin flow have a School
// document (self-signup schools don't) — absent is a normal, silent case,
// not an error, since most schools have no license to track.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const school = await School.findOne({ adminUserId: auth.id }).select("license");
    if (!school) return NextResponse.json({ success: true, data: null });

    const { endDate, extraUsers, includedUsers, status, planName } = school.license;
    const daysLeft = endDate ? Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24)) : null;

    return NextResponse.json({
      success: true,
      data: { endDate, daysLeft, status, planName, usersTotal: (includedUsers || 0) + (extraUsers || 0) },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load license." },
      { status: 500 },
    );
  }
}
