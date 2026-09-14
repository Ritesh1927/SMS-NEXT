import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { TimetableEntry } from "@/models/TimetableEntry";
import "@/models/Teacher";

// GET /api/timetable/class/[classId] — admin-only grid editor view for one class.
export async function GET(req: Request, { params }: { params: Promise<{ classId: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { classId } = await params;
    const entries = await TimetableEntry.find({ school: auth.schoolId, classId })
      .populate("teacherId", "name")
      .sort({ day: 1, periodNumber: 1 });
    return NextResponse.json({ success: true, data: entries });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load timetable." },
      { status: 500 },
    );
  }
}
