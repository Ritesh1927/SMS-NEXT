import { NextResponse } from "next/server";
import type { QueryFilter, SortOrder } from "mongoose";
import { connectDB } from "@/lib/db";
import { BugTicket, type IBugTicket } from "@/models/BugTicket";
import { requireSuperAdminActor } from "@/lib/bugReports/auth";
import { CATEGORY_VALUES, PRIORITY_VALUES, REPORTER_ROLES, STATUS_VALUES } from "@/lib/bugReports/constants";
import { csvFilter, escapeRegex, firstIssue, listQuerySchema } from "@/lib/bugReports/validation";
import { jsonError, runRetentionSweep } from "@/lib/bugReports/service";

// GET /api/superadmin/tickets -- the ticket table: filters, search, sort,
// pagination. Projection keeps rows light (no timeline/description).
export async function GET(req: Request) {
  try {
    await connectDB();
    const gate = await requireSuperAdminActor(req);
    if ("error" in gate) return gate.error;

    const parsed = listQuerySchema.safeParse(Object.fromEntries(new URL(req.url).searchParams));
    if (!parsed.success) return jsonError(firstIssue(parsed.error));
    const q = parsed.data;

    // Cheap and throttled to once an hour: keeps auto-archiving current
    // without needing a cron job.
    runRetentionSweep().catch((err) => console.warn("[tickets] retention sweep failed:", err));

    const filter: QueryFilter<IBugTicket> = {};
    if (q.archived) filter.isArchived = q.archived === "true";
    const statuses = csvFilter(q.status, STATUS_VALUES);
    if (statuses.length) filter.status = { $in: statuses };
    const priorities = csvFilter(q.priority, PRIORITY_VALUES);
    if (priorities.length) filter.priority = { $in: priorities };
    const categories = csvFilter(q.category, CATEGORY_VALUES);
    if (categories.length) filter.category = { $in: categories };
    const roles = csvFilter(q.role, REPORTER_ROLES);
    if (roles.length) filter["reporter.role"] = { $in: roles };
    if (q.schoolId) filter["reporter.schoolId"] = q.schoolId;
    if (q.from || q.to) {
      filter.createdAt = {
        ...(q.from ? { $gte: new Date(`${q.from}T00:00:00.000Z`) } : {}),
        ...(q.to ? { $lte: new Date(`${q.to}T23:59:59.999Z`) } : {}),
      };
    }
    if (q.search) {
      const rx = new RegExp(escapeRegex(q.search), "i");
      filter.$or = [
        { ticketNumber: rx },
        { title: rx },
        { "reporter.name": rx },
        { "reporter.email": rx },
        { "reporter.schoolName": rx },
      ];
    }

    const dir: SortOrder = q.order === "asc" ? 1 : -1;
    const sortField = q.sort === "priority" ? "priorityRank" : q.sort;
    const sort: Record<string, SortOrder> = { [sortField]: dir, createdAt: -1 };

    const [items, total] = await Promise.all([
      BugTicket.find(filter)
        .sort(sort)
        .skip((q.page - 1) * q.limit)
        .limit(q.limit)
        .select(
          "ticketNumber title status priority category createdAt updatedAt lastActivityAt assignedTo adminUnread isArchived attachments.kind " +
            "reporter.name reporter.role reporter.email reporter.schoolName reporter.schoolId",
        )
        .lean(),
      BugTicket.countDocuments(filter),
    ]);

    return NextResponse.json({
      success: true,
      data: items.map((t) => ({ ...t, _id: String(t._id) })),
      pagination: { page: q.page, limit: q.limit, total, pages: Math.max(1, Math.ceil(total / q.limit)) },
    });
  } catch (err) {
    console.error("[tickets] list failed:", err);
    return jsonError("Couldn't load tickets.", 500);
  }
}
