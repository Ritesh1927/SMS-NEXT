import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { SchoolPeriod } from "@/models/SchoolPeriod";
import { recomputePeriodNumbers } from "@/lib/periods";
import { isClassTeacherOf } from "@/lib/teacherClasses";

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
      const scoped = await SchoolPeriod.find({ school: auth.schoolId, standard }).sort({ order: 1 });
      if (scoped.length > 0) return NextResponse.json({ success: true, data: scoped });
    }

    const defaults = await SchoolPeriod.find({ school: auth.schoolId, standard: null }).sort({ order: 1 });
    return NextResponse.json({ success: true, data: defaults });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load periods." },
      { status: 500 },
    );
  }
}

// POST /api/periods — a schooladmin can add to any standard or the default
// list; a teacher only to a standard they're the class teacher of (same
// auto-grant isClassTeacherOf already gives elsewhere, e.g. homework) --
// never the default list, which is school-wide.
export async function POST(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { label, startTime, endTime, isBreak, standard } = await req.json();
    if (!label || !startTime || !endTime) {
      return NextResponse.json({ success: false, message: "label, startTime and endTime are required." }, { status: 400 });
    }

    const normalizedStandard: string | null = standard || null;
    if (auth.role === "teacher") {
      if (!normalizedStandard || !(await isClassTeacherOf(auth.id, auth.schoolId, normalizedStandard))) {
        return NextResponse.json({ success: false, message: "You can only manage periods for your own class." }, { status: 403 });
      }
    }

    const last = await SchoolPeriod.findOne({ school: auth.schoolId, standard: normalizedStandard }).sort({ order: -1 });
    const order = last ? last.order + 1 : 1;

    const period = await SchoolPeriod.create({
      school: auth.schoolId,
      label: String(label).trim(),
      startTime,
      endTime,
      isBreak: !!isBreak,
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
