import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { TimetableEntry } from "@/models/TimetableEntry";
import "@/models/Class";
import "@/models/Teacher";

// GET /api/timetable/all — every entry for the school, admin-only. Used by
// the admin UI to figure out which teachers are already busy during a given
// day+period before assigning them elsewhere.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const entries = await TimetableEntry.find({ school: auth.schoolId })
      .populate("teacherId", "name")
      .populate("classId", "name section")
      .sort({ day: 1, periodNumber: 1 });
    return NextResponse.json({ success: true, data: entries });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load timetable." },
      { status: 500 },
    );
  }
}
