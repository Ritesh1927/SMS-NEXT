import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { SchoolPeriod } from "@/models/SchoolPeriod";
import { recomputePeriodNumbers, findOverlappingPeriod } from "@/lib/periods";

// GET /api/periods?standard=<name> — a standard's own period list, falling
// back to the school-wide default (standard: null) if that standard hasn't
// been customized yet. Omitting ?standard returns the default list directly
// (unchanged behavior for any caller not yet standard-aware).
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || !["schooladmin", "teacher", "parent"].includes(auth.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const standard = searchParams.get("standard");

    if (standard) {
      const scoped = await SchoolPeriod.find({ school: auth.schoolId, standard }).sort({ startTime: 1 });
      if (scoped.length > 0) return NextResponse.json({ success: true, data: scoped });
    }

    const defaults = await SchoolPeriod.find({ school: auth.schoolId, standard: null }).sort({ startTime: 1 });
    return NextResponse.json({ success: true, data: defaults });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load periods." },
      { status: 500 },
    );
  }
}

// POST /api/periods — period *structure* (count/duration/break/start time)
// is admin-only. A class teacher can edit their own class's day-wise
// subject/teacher assignments (see /api/timetable), but not this.
export async function POST(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { label, startTime, endTime, isBreak, standard } = await req.json();
    const isBreakBool = !!isBreak;
    // A non-break period's label is always auto-derived from its
    // chronological position (see recomputePeriodNumbers) -- "Period" stays
    // fixed, never a free-form name. Only a break/lunch gets a real label.
    if (!startTime || !endTime || (isBreakBool && !label)) {
      return NextResponse.json({ success: false, message: "Start time and end time are required." }, { status: 400 });
    }
    if (startTime >= endTime) {
      return NextResponse.json({ success: false, message: "End time must be after start time." }, { status: 400 });
    }

    const normalizedStandard: string | null = standard || null;

    const conflict = await findOverlappingPeriod(auth.schoolId, normalizedStandard, startTime, endTime);
    if (conflict) {
      return NextResponse.json(
        { success: false, message: `Overlaps with "${conflict.label}" (${conflict.startTime}–${conflict.endTime}).` },
        { status: 400 },
      );
    }

    const last = await SchoolPeriod.findOne({ school: auth.schoolId, standard: normalizedStandard }).sort({ order: -1 });
    const order = last ? last.order + 1 : 1;

    const period = await SchoolPeriod.create({
      school: auth.schoolId,
      label: isBreakBool ? String(label).trim() : "Period",
      startTime,
      endTime,
      isBreak: isBreakBool,
      order,
      standard: normalizedStandard,
    });

    await recomputePeriodNumbers(auth.schoolId, normalizedStandard);
    const updated = await SchoolPeriod.findById(period._id);
    return NextResponse.json({ success: true, data: updated }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to add period." },
      { status: 500 },
    );
  }
}
