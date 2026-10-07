import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { BugTicket } from "@/models/BugTicket";
import { requireSuperAdminActor } from "@/lib/bugReports/auth";
import { jsonError, runRetentionSweep } from "@/lib/bugReports/service";

// GET /api/superadmin/tickets/stats -- dashboard cards, the unread badge
// and the School filter's options, in one aggregation round-trip.
export async function GET(req: Request) {
  try {
    await connectDB();
    const gate = await requireSuperAdminActor(req);
    if ("error" in gate) return gate.error;

    runRetentionSweep().catch((err) => console.warn("[tickets] retention sweep failed:", err));

    const [facets] = await BugTicket.aggregate<{
      byStatus: { _id: string; count: number }[];
      byPriority: { _id: string; count: number }[];
      totals: { total: number; unread: number; archived: number }[];
      schools: { _id: string; name: string; count: number }[];
    }>([
      {
        $facet: {
          byStatus: [{ $group: { _id: "$status", count: { $sum: 1 } } }],
          // Priority cards count live work only -- archived tickets are done.
          byPriority: [{ $match: { isArchived: false } }, { $group: { _id: "$priority", count: { $sum: 1 } } }],
          totals: [
            {
              $group: {
                _id: null,
                total: { $sum: 1 },
                unread: { $sum: { $cond: ["$adminUnread", 1, 0] } },
                archived: { $sum: { $cond: ["$isArchived", 1, 0] } },
              },
            },
          ],
          schools: [
            { $match: { "reporter.schoolId": { $ne: "" } } },
            { $group: { _id: "$reporter.schoolId", name: { $first: "$reporter.schoolName" }, count: { $sum: 1 } } },
            { $sort: { name: 1 } },
          ],
        },
      },
    ]);

    const toMap = (rows: { _id: string; count: number }[]) => Object.fromEntries(rows.map((r) => [r._id, r.count]));
    const totals = facets.totals[0] ?? { total: 0, unread: 0, archived: 0 };
    return NextResponse.json({
      success: true,
      data: {
        total: totals.total,
        unread: totals.unread,
        archived: totals.archived,
        byStatus: toMap(facets.byStatus),
        byPriority: toMap(facets.byPriority),
        schools: facets.schools.map((s) => ({ id: s._id, name: s.name || "Unknown school", count: s.count })),
      },
    });
  } catch (err) {
    console.error("[tickets] stats failed:", err);
    return jsonError("Couldn't load ticket stats.", 500);
  }
}
