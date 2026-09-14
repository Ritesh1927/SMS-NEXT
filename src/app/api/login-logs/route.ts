import { NextResponse } from "next/server";
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

    const [total, logs] = await Promise.all([
      LoginLog.countDocuments(filter),
      LoginLog.find(filter)
        .sort({ loginAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    return NextResponse.json({ success: true, data: logs, total, page, pages: Math.ceil(total / limit) });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load login logs." },
      { status: 500 },
    );
  }
}
