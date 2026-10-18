import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser, getNonTeachingStaffSections, requireStaffSectionAccess } from "@/lib/auth-server";
import { Class } from "@/models/Class";
import { Student } from "@/models/Student";
import { getTeacherAccessibleClasses } from "@/lib/teacherClasses";
import { isStreamStandard } from "@/lib/streamStandards";
import "@/models/Subject";
import "@/models/Teacher";

// Admin and a non-teaching staffer see every class; a genuine teacher sees
// only their own (classTeacher or assignedClasses) — the same class pickers
// Homework and Study Materials use to restrict what a teacher can
// assign/upload to.
//
// The class list itself (name/section/room/student count, no student PII)
// is low-sensitivity reference data used as a picker by most sections, not
// just "Classes" — Attendance, Homework, Study Materials, Timetable, Fees
// and Reports all fetch it to populate a class filter. Gating the list
// behind the "classes" section's own open grant would mean a role built for
// one of those other sections (e.g. an Accountant with Fees access) can't
// use its own class filter unless separately granted Classes too — so any
// non-teaching staffer with at least one section open can list classes;
// only creating/editing/deleting a class stays gated behind "classes"
// specifically (see POST below).
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();

    const staffSections = await getNonTeachingStaffSections(auth);
    if (staffSections && !Object.values(staffSections).some((s) => s.open)) {
      return NextResponse.json({ success: false, message: "You don't have permission to do this." }, { status: 403 });
    }

    const classQuery: Record<string, unknown> = { school: auth.schoolId };
    if (auth.role === "teacher" && !staffSections) {
      const accessible = await getTeacherAccessibleClasses(auth.id, auth.schoolId);
      classQuery.$or = accessible.length > 0 ? accessible.map((c) => ({ name: c.name, section: c.section })) : [{ _id: null }];
    }

    const classes = await Class.find(classQuery)
      .populate("classTeacher", "name teacherId")
      .populate("assignedSubjects", "name code");
    classes.sort(
      (a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true }) ||
        String(a.section).localeCompare(String(b.section), undefined, { numeric: true }),
    );

    const withCounts = await Promise.all(
      classes.map(async (c) => {
        const count = await Student.countDocuments({
          school: auth.schoolId, class: c.name, section: c.section, isActive: true,
        });
        return { ...c.toObject(), studentCount: count };
      }),
    );

    return NextResponse.json({ success: true, count: classes.length, data: withCounts });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load classes." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  await connectDB();
  const gate = await requireStaffSectionAccess(req, "classes", "create");
  if ("error" in gate) return gate.error;
  const { auth } = gate;

  try {
    const { name, section, classTeacher, room } = await req.json();
    if (!name || !section) {
      return NextResponse.json({ success: false, message: "Class name and section required." }, { status: 400 });
    }

    const existing = await Class.findOne({ school: auth.schoolId, name, section: String(section).toUpperCase() });
    if (existing) {
      return NextResponse.json({ success: false, message: "Class already exists." }, { status: 400 });
    }

    if (room && room.trim()) {
      const dupRoom = await Class.findOne({ school: auth.schoolId, room: room.trim() });
      if (dupRoom) {
        return NextResponse.json({ success: false, message: `Room "${room.trim()}" is already assigned to Class ${dupRoom.name}-${dupRoom.section}.` }, { status: 400 });
      }
    }

    if (classTeacher) {
      const dupTeacher = await Class.findOne({ school: auth.schoolId, classTeacher });
      if (dupTeacher) {
        return NextResponse.json({ success: false, message: "This teacher is already assigned as class teacher to another class." }, { status: 400 });
      }
    }

    // A new section of an existing standard shares that standard's subjects
    // automatically — subjects are assigned per standard (Subject & Class),
    // not per section, so every sibling section should start in sync rather
    // than needing a manual re-assignment. Stream standards (11/12) are the
    // exception: each section is its own stream, so a new section must start
    // empty rather than inheriting a sibling's (possibly different-stream)
    // subject list.
    const sibling = isStreamStandard(name) ? null : await Class.findOne({ school: auth.schoolId, name }).select("assignedSubjects");

    const cls = await Class.create({
      name, section, classTeacher: classTeacher || null, room: room || "", school: auth.schoolId,
      assignedSubjects: sibling?.assignedSubjects || [],
    });
    await cls.populate("classTeacher", "name teacherId");
    await cls.populate("assignedSubjects", "name code");

    return NextResponse.json({ success: true, message: "Class created.", data: cls }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to create class." },
      { status: 500 },
    );
  }
}
