import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Teacher } from "@/models/Teacher";
import { Student } from "@/models/Student";
import { Parent } from "@/models/Parent";
import { AttendanceRecord } from "@/models/AttendanceRecord";
import { formatClassName } from "@/lib/helpers";

export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const schoolId = auth.schoolId;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [totalStudents, totalTeachers, totalParents, newStudentsThisMonth, newTeachersThisMonth, classCounts] =
      await Promise.all([
        Student.countDocuments({ school: schoolId, isActive: true }),
        Teacher.countDocuments({ school: schoolId, isActive: true }),
        Parent.countDocuments({ school: schoolId, isActive: true }),
        Student.countDocuments({ school: schoolId, isActive: true, admissionDate: { $gte: monthStart } }),
        Teacher.countDocuments({ school: schoolId, isActive: true, joiningDate: { $gte: monthStart } }),
        Student.aggregate([
          // Aggregate pipelines skip Mongoose's automatic string->ObjectId
          // casting, unlike find(), so schoolId has to be cast explicitly
          // here or this $match silently matches nothing.
          { $match: { school: new mongoose.Types.ObjectId(schoolId), isActive: true } },
          { $group: { _id: "$class", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 6 },
        ]),
      ]);

    const studentsByClass = classCounts
      .filter((c) => c._id)
      .map((c) => ({ name: formatClassName(c._id), count: c.count }));

    const schoolObjectId = new mongoose.Types.ObjectId(schoolId);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date();
    todayEnd.setHours(23, 59, 59, 999);

    const todayRecords = await AttendanceRecord.find({
      school: schoolId, date: { $gte: todayStart, $lte: todayEnd },
    }).select("status");
    const todayAttendance = {
      present: todayRecords.filter((r) => r.status === "present").length,
      absent: todayRecords.filter((r) => r.status === "absent").length,
      late: todayRecords.filter((r) => r.status === "late").length,
      marked: todayRecords.length,
    };

    // Last 7 days, oldest first — same window SMS-BACKEND's
    // attendanceOverview used, just sourced from AttendanceRecord instead
    // of the older per-class Attendance model.
    const attendanceTrend = await Promise.all(
      Array.from({ length: 7 }, (_, i) => 6 - i).map(async (daysAgo) => {
        const d = new Date();
        d.setDate(d.getDate() - daysAgo);
        const dStart = new Date(d);
        dStart.setHours(0, 0, 0, 0);
        const dEnd = new Date(d);
        dEnd.setHours(23, 59, 59, 999);
        const recs = await AttendanceRecord.aggregate([
          { $match: { school: schoolObjectId, date: { $gte: dStart, $lte: dEnd } } },
          { $group: { _id: "$status", count: { $sum: 1 } } },
        ]);
        const byStatus = Object.fromEntries(recs.map((r) => [r._id, r.count]));
        return {
          day: d.toLocaleDateString("en-US", { weekday: "short" }),
          present: (byStatus.present || 0) + (byStatus.late || 0),
          absent: byStatus.absent || 0,
        };
      }),
    );

    return NextResponse.json({
      success: true,
      data: {
        stats: { totalStudents, totalTeachers, totalParents, newStudentsThisMonth, newTeachersThisMonth },
        studentsByClass,
        todayAttendance,
        attendanceTrend,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load dashboard." },
      { status: 500 },
    );
  }
}
