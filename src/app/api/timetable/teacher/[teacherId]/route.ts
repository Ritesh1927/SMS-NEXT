import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { TimetableEntry } from "@/models/TimetableEntry";
import "@/models/Class";

// GET /api/timetable/teacher/[teacherId] — a teacher's own weekly schedule
// across every class they teach. Admin may look up any teacher; a teacher
// may only look up themselves.
export async function GET(req: Request, { params }: { params: Promise<{ teacherId: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { teacherId } = await params;
    if (auth.role === "teacher" && auth.id !== teacherId) {
      return NextResponse.json({ success: false, message: "Access denied." }, { status: 403 });
    }

    await connectDB();
    const entries = await TimetableEntry.find({ school: auth.schoolId, teacherId })
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
