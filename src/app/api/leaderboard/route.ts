import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Student } from "@/models/Student";

// GET /api/leaderboard — top students by points. Ported from
// SMS-BACKEND's getLeaderboard/getStarStudent; skipped the rest of
// gamification.controller.js (custom Badge/UserBadge creation, daily
// challenges, mood check-ins, getMyRank) since those either need a real
// student login (confirmed not to exist here) or are a separate,
// admin-authored-badges subsystem this app doesn't have yet — the
// points/badges this leaderboard ranks are already being earned through
// exams, attendance streaks, fee payment and homework, with nowhere to see
// them until now.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || !["schooladmin", "teacher", "parent"].includes(auth.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const cls = searchParams.get("class");

    const query: Record<string, unknown> = { school: auth.schoolId, isActive: true };
    if (cls) query.class = cls;

    const [students, star] = await Promise.all([
      Student.find(query)
        .select("name studentId class section points streakDays badges photo")
        .sort({ points: -1 })
        .limit(20),
      Student.findOne(query)
        .sort({ points: -1, streakDays: -1 })
        .select("name studentId class points streakDays badges photo"),
    ]);

    const ranked = students.map((s, i) => ({ rank: i + 1, ...s.toObject() }));

    return NextResponse.json({ success: true, data: ranked, star });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load leaderboard." },
      { status: 500 },
    );
  }
}
