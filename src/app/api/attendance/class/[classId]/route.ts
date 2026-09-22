import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Class } from "@/models/Class";
import { Student } from "@/models/Student";
import { AttendanceRecord } from "@/models/AttendanceRecord";

// GET /api/attendance/class/[classId]?date=YYYY-MM-DD — the class roster
// plus each student's attendance status for that date (null if unmarked).
export async function GET(req: Request, { params }: { params: Promise<{ classId: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { classId } = await params;
    const { searchParams } = new URL(req.url);
    const date = searchParams.get("date");

    await connectDB();
    const cls = await Class.findOne({ _id: classId, school: auth.schoolId });
    if (!cls) return NextResponse.json({ success: false, message: "Class not found." }, { status: 404 });

    if (auth.role === "teacher" && String(cls.classTeacher) !== auth.id) {
      return NextResponse.json(
        { success: false, message: "Only the class teacher can view this class's attendance." },
        { status: 403 },
      );
    }

    // rollNumber is a plain "1", "2", "3"... string, so sorting by it
    // lexicographically would put "10" before "2" — sort by name instead,
    // which is equivalent now that roll number always tracks name order.
    const students = await Student.find({ school: auth.schoolId, class: cls.name, section: cls.section, isActive: true })
      .select("name photo rollNumber")
      .collation({ locale: "en" })
      .sort({ name: 1 });

    let existingRecords: { studentId: mongoose.Types.ObjectId; status: string }[] = [];
    if (date) {
      const normalizedDate = new Date(date);
      normalizedDate.setHours(0, 0, 0, 0);
      const end = new Date(normalizedDate);
      end.setHours(23, 59, 59, 999);
      existingRecords = await AttendanceRecord.find({
        school: auth.schoolId, classId, date: { $gte: normalizedDate, $lte: end },
      }).select("studentId status");
    }

    const recMap = new Map(existingRecords.map((r) => [String(r.studentId), r.status]));

    const data = students.map((s) => ({
      student: { _id: s._id, name: s.name, photo: s.photo, rollNumber: s.rollNumber },
      status: recMap.get(String(s._id)) || null,
    }));

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load attendance." },
      { status: 500 },
    );
  }
}
