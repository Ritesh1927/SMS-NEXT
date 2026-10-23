import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Admin } from "@/models/Admin";

function requireSchoolAdmin(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") return null;
  return auth;
}

export async function GET(req: Request) {
  const auth = requireSchoolAdmin(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    await connectDB();
    const admin = await Admin.findById(auth.id).select("-password -otp -resetOTP");
    if (!admin) return NextResponse.json({ success: false, message: "School not found." }, { status: 404 });

    return NextResponse.json({ success: true, data: admin });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load profile." },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request) {
  const auth = requireSchoolAdmin(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    const body = await req.json();
    const { schoolName, schoolAddress, schoolPhone, schoolEmail, website, logo, name, phone, settings, themeColor, secondaryColor } =
      body;

    await connectDB();

    const update: Record<string, unknown> = {
      schoolName, schoolAddress, schoolPhone, schoolEmail, website, logo, name, phone, themeColor, secondaryColor,
    };

    if (settings) {
      const current = await Admin.findById(auth.id).select("settings").lean();
      // academicYear/pastAcademicYears/yearSwitch are never accepted here,
      // even if the client echoes them back from a stale GET -- they're
      // only ever written by the dedicated POST /api/school/year-switch,
      // same reasoning as allowAttendanceEdit having its own endpoint. A
      // blind merge here could silently revert a switch that happened in
      // another tab/session after this page's last load.
      // eslint-disable-next-line @typescript-eslint/no-unused-vars -- deliberately discarding these 3 keys, keeping the rest.
      const { academicYear: _ay, pastAcademicYears: _pay, yearSwitch: _ys, ...safeSettings } = settings;
      update.settings = {
        ...(current?.settings || {}),
        ...safeSettings,
        notifications: { ...(current?.settings?.notifications || {}), ...(settings.notifications || {}) },
        security: { ...(current?.settings?.security || {}), ...(settings.security || {}) },
        lateFee: { ...(current?.settings?.lateFee || {}), ...(settings.lateFee || {}) },
        holidays: { ...(current?.settings?.holidays || {}), ...(settings.holidays || {}) },
      };
    }

    const admin = await Admin.findByIdAndUpdate(auth.id, update, { returnDocument: "after", runValidators: true }).select(
      "-password -otp -resetOTP",
    );
    if (!admin) return NextResponse.json({ success: false, message: "School not found." }, { status: 404 });

    return NextResponse.json({ success: true, message: "Profile updated.", data: admin });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to update profile." },
      { status: 500 },
    );
  }
}
