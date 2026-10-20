import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser, getNonTeachingStaffSections, getTeacherExtraPowers, teacherPowerAllows } from "@/lib/auth-server";
import { TimetableEntry } from "@/models/TimetableEntry";
import { Class } from "@/models/Class";
import { isClassTeacherOfSection } from "@/lib/teacherClasses";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { id } = await params;
    const entry = await TimetableEntry.findOne({ _id: id, school: auth.schoolId });
    if (!entry) return NextResponse.json({ success: false, message: "Entry not found." }, { status: 404 });

    if (auth.role === "teacher") {
      const staffSections = await getNonTeachingStaffSections(auth);
      if (staffSections) {
        if (!staffSections.timetable?.delete) {
          return NextResponse.json({ success: false, message: "You don't have permission to do this." }, { status: 403 });
        }
      } else {
        const cls = await Class.findOne({ _id: entry.classId, school: auth.schoolId }).select("name section").lean();
        let allowed = !!cls && (await isClassTeacherOfSection(auth.id, auth.schoolId, cls.name, cls.section));
        if (!allowed && cls) {
          const powers = await getTeacherExtraPowers(auth);
          allowed = teacherPowerAllows(powers, "timetableEdit", cls.name);
        }
        if (!allowed) return NextResponse.json({ success: false, message: "You can only edit the timetable for your own class." }, { status: 403 });
      }
    }

    await entry.deleteOne();
    return NextResponse.json({ success: true, message: "Entry deleted." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to delete entry." },
      { status: 500 },
    );
  }
}
