import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Teacher } from "@/models/Teacher";
import { Student } from "@/models/Student";
import { Parent } from "@/models/Parent";
import { AttendanceRecord } from "@/models/AttendanceRecord";
import { FeePayment } from "@/models/FeePayment";
import { Result } from "@/models/Result";
import { Exam } from "@/models/Exam";
import { Notice } from "@/models/Notice";
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

    // Last 6 calendar months (oldest first), bucketed by each fee's dueDate —
    // matches how the Fees page itself groups payments into a monthly cycle.
    const sixMonthsAgo = new Date(monthStart);
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 5);
    const feeBuckets = await FeePayment.aggregate([
      { $match: { school: schoolObjectId, dueDate: { $gte: sixMonthsAgo } } },
      {
        $group: {
          _id: { year: { $year: "$dueDate" }, month: { $month: "$dueDate" } },
          collected: { $sum: "$paidAmount" },
          pending: { $sum: { $subtract: ["$amount", "$paidAmount"] } },
        },
      },
    ]);
    const feeByKey = new Map(feeBuckets.map((b) => [`${b._id.year}-${b._id.month}`, b]));
    const feeMonthly = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(monthStart);
      d.setMonth(d.getMonth() - (5 - i));
      const bucket = feeByKey.get(`${d.getFullYear()}-${d.getMonth() + 1}`);
      return {
        month: d.toLocaleDateString("en-US", { month: "short" }),
        collected: bucket?.collected || 0,
        pending: Math.max(0, bucket?.pending || 0),
      };
    });
    const feeCollectedThisMonth = feeMonthly[feeMonthly.length - 1]?.collected || 0;

    const classPerformance = (
      await Result.aggregate([
        { $match: { school: schoolObjectId, isPublished: true } },
        { $lookup: { from: "students", localField: "student", foreignField: "_id", as: "s" } },
        { $unwind: "$s" },
        { $group: { _id: "$s.class", avg: { $avg: "$percentage" } } },
        { $sort: { _id: 1 } },
        { $limit: 8 },
      ])
    ).map((c) => ({ name: formatClassName(c._id), avg: Math.round(c.avg) }));

    const upcomingExams = (
      await Exam.find({ school: schoolId, date: { $gte: todayStart } })
        .select("title date class section subject")
        .sort({ date: 1 })
        .limit(5)
    ).map((e) => ({ title: e.title, date: e.date, class: formatClassName(e.class, e.section) }));

    const pendingFeeStudents = await FeePayment.find({ school: schoolId, status: { $in: ["pending", "partial", "overdue"] } })
      .populate("student", "name class section")
      .sort({ dueDate: 1 })
      .limit(5);

    const [recentPayments, recentStudents, recentNotices] = await Promise.all([
      FeePayment.find({ school: schoolId, status: "paid" }).populate("student", "name").sort({ paidDate: -1 }).limit(4),
      Student.find({ school: schoolId, isActive: true }).sort({ admissionDate: -1 }).limit(4),
      Notice.find({ school: schoolId }).sort({ createdAt: -1 }).limit(4),
    ]);
    const recentActivity = [
      ...recentPayments
        .filter((p) => p.paidDate)
        .map((p) => ({
          type: "fee" as const,
          text: `${(p.student as unknown as { name: string })?.name || "A student"} paid ₹${p.paidAmount.toLocaleString()} for ${p.title}`,
          time: p.paidDate as Date,
        })),
      ...recentStudents.map((s) => ({ type: "student" as const, text: `${s.name} was admitted`, time: s.admissionDate as Date })),
      ...recentNotices.map((n) => ({ type: "notice" as const, text: `Notice posted: ${n.title}`, time: n.get("createdAt") as Date })),
    ]
      .filter((a) => a.time)
      .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
      .slice(0, 6)
      .map((a) => ({ type: a.type, text: a.text, time: a.time }));

    return NextResponse.json({
      success: true,
      data: {
        stats: { totalStudents, totalTeachers, totalParents, newStudentsThisMonth, newTeachersThisMonth, feeCollectedThisMonth },
        studentsByClass,
        todayAttendance,
        attendanceTrend,
        feeMonthly,
        classPerformance,
        upcomingExams,
        pendingFeeStudents,
        recentActivity,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load dashboard." },
      { status: 500 },
    );
  }
}
