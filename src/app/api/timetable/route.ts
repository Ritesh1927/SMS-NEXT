import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { TimetableEntry, WEEKDAYS, type Weekday } from "@/models/TimetableEntry";
import { SchoolPeriod } from "@/models/SchoolPeriod";
// Imported for their side effect of registering the schemas .populate() below
// needs — this route never queries them directly.
import "@/models/Class";
import "@/models/Teacher";

// POST /api/timetable — admin creates/updates a single grid cell. Ported
// from SMS-BACKEND's timetableEntry.controller.js upsertEntry, including its
// teacher-double-booking check.
export async function POST(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { classId, teacherId, day, periodNumber, subject, startTime, endTime } = await req.json();

    if (!classId || !day || !periodNumber || !subject) {
      return NextResponse.json(
        { success: false, message: "classId, day, periodNumber and subject are required." },
        { status: 400 },
      );
    }
    if (!WEEKDAYS.includes(day as Weekday)) {
      return NextResponse.json({ success: false, message: "Invalid day." }, { status: 400 });
    }
    const pNum = Number(periodNumber);
    if (!(pNum >= 1)) {
      return NextResponse.json({ success: false, message: "periodNumber must be >= 1." }, { status: 400 });
    }

    if (teacherId) {
      const conflict = await TimetableEntry.findOne({
        school: auth.schoolId,
        teacherId,
        day,
        periodNumber: pNum,
        classId: { $ne: classId },
      }).populate<{ classId: { name: string; section: string } | null }>("classId", "name section");

      if (conflict) {
        const conflictClassName = conflict.classId ? `${conflict.classId.name}-${conflict.classId.section}` : "another class";
        return NextResponse.json(
          { success: false, message: `Teacher is already assigned to ${conflictClassName} during this period.` },
          { status: 409 },
        );
      }
    }

    const schoolPeriod = await SchoolPeriod.findOne({ school: auth.schoolId, periodNumber: pNum, isBreak: false });
    const resolvedStart = startTime || schoolPeriod?.startTime || "";
    const resolvedEnd = endTime || schoolPeriod?.endTime || "";

    const entry = await TimetableEntry.findOneAndUpdate(
      { school: auth.schoolId, classId, day, periodNumber: pNum },
      {
        $set: {
          school: auth.schoolId,
          classId,
          day,
          periodNumber: pNum,
          teacherId: teacherId || null,
          subject: String(subject).trim(),
          startTime: resolvedStart,
          endTime: resolvedEnd,
        },
      },
      { upsert: true, new: true },
    )
      .populate("teacherId", "name")
      .populate("classId", "name section");

    return NextResponse.json({ success: true, data: entry });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to save timetable entry." },
      { status: 500 },
    );
  }
}
