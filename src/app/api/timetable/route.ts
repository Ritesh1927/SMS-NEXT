import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser, getNonTeachingStaffSections } from "@/lib/auth-server";
import { TimetableEntry, WEEKDAYS, type Weekday } from "@/models/TimetableEntry";
import { SchoolPeriod } from "@/models/SchoolPeriod";
import { Class } from "@/models/Class";
import { isClassTeacherOfSection } from "@/lib/teacherClasses";
// Imported for its side effect of registering the schema .populate() below
// needs — this route never queries it directly.
import "@/models/Teacher";

// POST /api/timetable — admin creates/updates a single grid cell for any
// class; a teacher may do the same, but only for the one class they're the
// class teacher of (day-wise subject/teacher assignment, not period
// structure — that stays admin-only, see /api/periods). Ported from
// SMS-BACKEND's timetableEntry.controller.js upsertEntry, including its
// teacher-double-booking check.
export async function POST(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
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

    const cls = await Class.findOne({ _id: classId, school: auth.schoolId }).select("name section").lean();
    if (!cls) return NextResponse.json({ success: false, message: "Class not found." }, { status: 404 });

    if (auth.role === "teacher") {
      const staffSections = await getNonTeachingStaffSections(auth);
      if (staffSections) {
        if (!staffSections.timetable?.edit) {
          return NextResponse.json({ success: false, message: "You don't have permission to edit the timetable." }, { status: 403 });
        }
      } else {
        const allowed = await isClassTeacherOfSection(auth.id, auth.schoolId, cls.name, cls.section);
        if (!allowed) {
          return NextResponse.json({ success: false, message: "You can only edit the timetable for your own class." }, { status: 403 });
        }
      }
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

    // Resolve this period's time from the class's own standard if it has a
    // customized period list, else the school-wide default -- same
    // scoped-then-fallback rule GET /api/periods?standard= uses.
    const standard = cls.name || null;
    const hasCustomPeriods = standard ? await SchoolPeriod.exists({ school: auth.schoolId, standard }) : false;
    const schoolPeriod = await SchoolPeriod.findOne({
      school: auth.schoolId,
      standard: hasCustomPeriods ? standard : null,
      periodNumber: pNum,
      isBreak: false,
    });
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
