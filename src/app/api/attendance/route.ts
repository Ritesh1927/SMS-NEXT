import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { AttendanceRecord, type IAttendanceRecord } from "@/models/AttendanceRecord";
import { Class } from "@/models/Class";
import { Student } from "@/models/Student";
import "@/models/Parent";
import { sendAbsentAlertMail } from "@/lib/mail";

// POST /api/attendance — bulk-mark a class's roster for one date.
// Body: { classId, date, attendance: [{ studentId, status }] }
export async function POST(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { classId, date, attendance } = await req.json();
    if (!classId || !date || !Array.isArray(attendance) || attendance.length === 0) {
      return NextResponse.json(
        { success: false, message: "classId, date and attendance[] required." },
        { status: 400 },
      );
    }

    await connectDB();
    const cls = await Class.findOne({ _id: classId, school: auth.schoolId });
    if (!cls) return NextResponse.json({ success: false, message: "Class not found." }, { status: 404 });

    // Attendance can only be marked by the school admin or that class's own
    // class teacher — matches SMS-BACKEND's isClassTeacher restriction.
    if (auth.role === "teacher" && String(cls.classTeacher) !== auth.id) {
      return NextResponse.json(
        { success: false, message: "Only the class teacher can mark attendance." },
        { status: 403 },
      );
    }

    const normalizedDate = new Date(date);
    normalizedDate.setHours(0, 0, 0, 0);

    const markedBy = { id: auth.id, role: auth.role === "schooladmin" ? "admin" : "teacher", name: "" };

    const ops: mongoose.AnyBulkWriteOperation<IAttendanceRecord>[] = attendance.map(
      ({ studentId, status }: { studentId: string; status: string }) => ({
        updateOne: {
          filter: { school: auth.schoolId, studentId, date: normalizedDate },
          update: { $set: { studentId, classId, date: normalizedDate, status, markedBy, school: auth.schoolId } },
          upsert: true,
        },
      }),
    ) as unknown as mongoose.AnyBulkWriteOperation<IAttendanceRecord>[];
    await AttendanceRecord.bulkWrite(ops);

    const absentIds = attendance.filter((r: { status: string }) => r.status === "absent").map((r: { studentId: string }) => r.studentId);
    if (absentIds.length > 0) {
      const absentStudents = await Student.find({ _id: { $in: absentIds } }).populate<{ parent: { email?: string } | null }>("parent");
      for (const s of absentStudents) {
        if (s.parent?.email) {
          try {
            await sendAbsentAlertMail(s.parent.email, s.name, new Date(date).toLocaleDateString());
          } catch (e) {
            console.log("Alert mail failed:", e instanceof Error ? e.message : e);
          }
        }
      }
    }

    return NextResponse.json({ success: true, message: `Attendance saved for ${attendance.length} students.` });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to save attendance." },
      { status: 500 },
    );
  }
}
