import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { BugTicket } from "@/models/BugTicket";
import { requireTicketUser } from "@/lib/bugReports/auth";
import { SOLVED_STATUSES } from "@/lib/bugReports/constants";
import { jsonError } from "@/lib/bugReports/service";

// GET /api/bug-reports/similar?q=... -- already-solved issues matching what
// the user is typing, so they can check before filing a duplicate. Returns
// only the problem + its resolution: never who reported it or where.
export async function GET(req: Request) {
  const result = requireTicketUser(req);
  if ("error" in result) return result.error;

  const q = (new URL(req.url).searchParams.get("q") || "").replace(/\s+/g, " ").trim().slice(0, 120);
  if (q.length < 4) return NextResponse.json({ success: true, data: [] });

  try {
    await connectDB();
    const items = await BugTicket.find(
      { $text: { $search: q }, status: { $in: SOLVED_STATUSES }, resolution: { $ne: "" } },
      { score: { $meta: "textScore" }, ticketNumber: 1, title: 1, category: 1, resolution: 1, resolvedAt: 1 },
    )
      .sort({ score: { $meta: "textScore" } })
      .limit(5)
      .lean();
    return NextResponse.json(
      {
        success: true,
        data: items.map((t) => ({
          _id: String(t._id),
          ticketNumber: t.ticketNumber,
          title: t.title,
          category: t.category,
          resolution: t.resolution.slice(0, 280),
          resolvedAt: t.resolvedAt,
        })),
      },
      { headers: { "Cache-Control": "private, max-age=60" } },
    );
  } catch (err) {
    console.error("[bug-reports] similar search failed:", err);
    return jsonError("Search failed.", 500);
  }
}
