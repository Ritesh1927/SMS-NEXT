import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireStaffSectionAccess } from "@/lib/auth-server";
import { TimetableEntry } from "@/models/TimetableEntry";
import "@/models/Class";
import "@/models/Teacher";

// GET /api/timetable/all — every entry for the school, admin-only (or a
// non-teaching staffer with Timetable "view"). Used by the admin UI to
// figure out which teachers are already busy during a given day+period
// before assigning them elsewhere.
export async function GET(req: Request) {
  await connectDB();
  const gate = await requireStaffSectionAccess(req, "timetable", "view");
  if ("error" in gate) return gate.error;
  const { auth } = gate;

  try {
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
