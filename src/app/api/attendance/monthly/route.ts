import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { AttendanceRecord } from "@/models/AttendanceRecord";
import { Class } from "@/models/Class";

// GET /api/attendance/monthly?month=&year=&classId= — per-class attendance
// rate for a given month, for the Reports page's Attendance tab. Aggregated
// server-side (grouped by classId, present/late counted as present) rather
// than shipping raw per-day records to the client to bucket, which is what
// SMS-BACKEND's shape would otherwise force the client to do.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const month = parseInt(searchParams.get("month") || "", 10);
    const year = parseInt(searchParams.get("year") || "", 10);
    const classId = searchParams.get("classId");

    if (!month || !year) {
      return NextResponse.json({ success: false, message: "month and year are required." }, { status: 400 });
    }

    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 0, 23, 59, 59, 999);

    const match: Record<string, unknown> = { school: new mongoose.Types.ObjectId(auth.schoolId), date: { $gte: start, $lte: end } };
    if (classId) match.classId = new mongoose.Types.ObjectId(classId);

    const grouped = await AttendanceRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$classId",
          total: { $sum: 1 },
          present: { $sum: { $cond: [{ $in: ["$status", ["present", "late"]] }, 1, 0] } },
        },
      },
    ]);

    const classIds = grouped.map((g) => g._id);
    const classes = await Class.find({ _id: { $in: classIds } }).select("name section");
    const classMap = new Map(classes.map((c) => [String(c._id), `${c.name}${c.section ? "-" + c.section : ""}`]));

    const data = grouped
      .map((g) => ({
        class: classMap.get(String(g._id)) || "Unknown",
        rate: g.total > 0 ? Math.round((g.present / g.total) * 100) : 0,
        present: g.present,
        total: g.total,
      }))
      .sort((a, b) => a.class.localeCompare(b.class));

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load attendance report." },
      { status: 500 },
    );
  }
}
