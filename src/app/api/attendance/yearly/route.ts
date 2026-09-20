import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { AttendanceRecord } from "@/models/AttendanceRecord";

// GET /api/attendance/yearly?year=&classId= — attendance rate per calendar
// month for a given year, aggregated across the whole school or scoped to
// one class. Sibling to /api/attendance/monthly (which groups by class for a
// single month); this one groups by month instead, for the Attendance
// page's yearly trend view.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get("year") || "", 10);
    const classId = searchParams.get("classId");

    if (!year) {
      return NextResponse.json({ success: false, message: "year is required." }, { status: 400 });
    }

    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31, 23, 59, 59, 999);

    const match: Record<string, unknown> = { school: new mongoose.Types.ObjectId(auth.schoolId), date: { $gte: start, $lte: end } };
    if (classId) match.classId = new mongoose.Types.ObjectId(classId);

    const grouped = await AttendanceRecord.aggregate([
      { $match: match },
      {
        $group: {
          _id: { $month: "$date" },
          total: { $sum: 1 },
          present: { $sum: { $cond: [{ $in: ["$status", ["present", "late"]] }, 1, 0] } },
        },
      },
    ]);

    const byMonth = new Map(grouped.map((g) => [g._id, g]));
    const data = Array.from({ length: 12 }, (_, i) => {
      const g = byMonth.get(i + 1);
      const total = g?.total || 0;
      const present = g?.present || 0;
      return { month: i + 1, rate: total > 0 ? Math.round((present / total) * 100) : 0, present, total };
    });

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load yearly attendance." },
      { status: 500 },
    );
  }
}
