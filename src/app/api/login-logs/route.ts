import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { LoginLog } from "@/models/LoginLog";
import { escapeRegex } from "@/lib/helpers";

export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));
    const limit = Math.min(200, Math.max(1, parseInt(searchParams.get("limit") || "50", 10)));
    const search = searchParams.get("search");
    const role = searchParams.get("role");
    const from = searchParams.get("from");
    const to = searchParams.get("to");

    const filter: Record<string, unknown> = { school: auth.schoolId };
    if (search) {
      const rx = { $regex: escapeRegex(search), $options: "i" };
      filter.$or = [{ userName: rx }, { email: rx }];
    }
    if (role) filter.role = role;
    if (from || to) {
      const loginAt: Record<string, Date> = {};
      if (from) loginAt.$gte = new Date(from);
      if (to) loginAt.$lte = new Date(to + "T23:59:59.999Z");
      filter.loginAt = loginAt;
    }

    const { role: _role, ...filterWithoutRole } = filter;
    void _role;
    // Aggregate pipelines skip Mongoose's schema-based casting, so the ObjectId
    // filter has to be cast explicitly or $match silently matches nothing.
    const aggregateFilter = { ...filterWithoutRole, school: new mongoose.Types.ObjectId(auth.schoolId) };

    const [total, logs, roleCountRows] = await Promise.all([
      LoginLog.countDocuments(filter),
      LoginLog.find(filter)
        .sort({ loginAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      LoginLog.aggregate([{ $match: aggregateFilter }, { $group: { _id: "$role", count: { $sum: 1 } } }]),
    ]);

    const roleCounts = { schooladmin: 0, teacher: 0, parent: 0 };
    for (const row of roleCountRows) {
      if (row._id in roleCounts) roleCounts[row._id as keyof typeof roleCounts] = row.count;
    }

    return NextResponse.json({ success: true, data: logs, total, page, pages: Math.ceil(total / limit), roleCounts });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load login logs." },
      { status: 500 },
    );
  }
}
