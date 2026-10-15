import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { TimetableEntry } from "@/models/TimetableEntry";
import { Class } from "@/models/Class";
import { Teacher } from "@/models/Teacher";
import { isClassTeacherOfSection } from "@/lib/teacherClasses";

// GET /api/timetable/class/[classId] — grid editor view for one class.
// Admin can view any class; a teacher only the one class they're the class
// teacher of (their "My Class" view). Also returns the small set of
// teachers relevant to this one class (its own class teacher + anyone with
// it in assignedClasses) for the cell-edit teacher picker -- scoped and
// minimal-field rather than the full admin-only /api/teachers roster
// (salary, address, aadhaar, etc.), since a class teacher can reach this
// but must never see the whole staff directory.
export async function GET(req: Request, { params }: { params: Promise<{ classId: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { classId } = await params;

    const cls = await Class.findOne({ _id: classId, school: auth.schoolId }).select("name section classTeacher").lean();
    if (!cls) return NextResponse.json({ success: false, message: "Class not found." }, { status: 404 });

    if (auth.role === "teacher") {
      const allowed = await isClassTeacherOfSection(auth.id, auth.schoolId, cls.name, cls.section);
      if (!allowed) return NextResponse.json({ success: false, message: "Access denied." }, { status: 403 });
    }

    const [entries, classTeachers] = await Promise.all([
      TimetableEntry.find({ school: auth.schoolId, classId })
        .populate("teacherId", "name")
        .sort({ day: 1, periodNumber: 1 }),
      Teacher.find({
        school: auth.schoolId,
        $or: [{ assignedClasses: classId }, { _id: cls.classTeacher }],
      }).select("name primarySubject secondarySubject"),
    ]);

    return NextResponse.json({ success: true, data: entries, classTeachers });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load timetable." },
      { status: 500 },
    );
  }
}
