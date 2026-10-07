import { NextResponse } from "next/server";
import type { QueryFilter } from "mongoose";
import { connectDB } from "@/lib/db";
import { BugTicket, type IBugTicket } from "@/models/BugTicket";
import { requireSuperAdminActor } from "@/lib/bugReports/auth";
import { CATEGORY_VALUES, SOLVED_STATUSES } from "@/lib/bugReports/constants";
import { csvFilter, escapeRegex } from "@/lib/bugReports/validation";
import { jsonError } from "@/lib/bugReports/service";

// GET /api/superadmin/tickets/archive -- the Solved Tickets Archive:
// resolved/closed tickets (archived or not), newest resolution first, as a
// searchable knowledge base for spotting duplicates.
export async function GET(req: Request) {
  try {
    await connectDB();
    const gate = await requireSuperAdminActor(req);
    if ("error" in gate) return gate.error;

    const params = new URL(req.url).searchParams;
    const page = Math.max(1, Number(params.get("page")) || 1);
    const limit = Math.min(50, Math.max(5, Number(params.get("limit")) || 12));
    const search = (params.get("search") || "").replace(/\s+/g, " ").trim().slice(0, 120);
    const categories = csvFilter(params.get("category") || "", CATEGORY_VALUES);
    const archivedOnly = params.get("archivedOnly") === "true";

    const filter: QueryFilter<IBugTicket> = { status: { $in: SOLVED_STATUSES } };
    if (archivedOnly) filter.isArchived = true;
    if (categories.length) filter.category = { $in: categories };
    if (search) {
      const rx = new RegExp(escapeRegex(search), "i");
      filter.$or = [{ ticketNumber: rx }, { title: rx }, { description: rx }, { resolution: rx }, { "reporter.schoolName": rx }];
    }

    const [items, total] = await Promise.all([
      BugTicket.find(filter)
        .sort({ resolvedAt: -1, closedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("ticketNumber title description category resolution resolvedAt resolvedBy closedAt status isArchived reporter.name reporter.role reporter.schoolName")
        .lean(),
      BugTicket.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      data: items.map((t) => ({ ...t, _id: String(t._id), description: t.description.slice(0, 220) })),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) {
    console.error("[tickets] archive list failed:", err);
    return jsonError("Couldn't load the archive.", 500);
  }
}
