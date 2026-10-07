import { NextResponse } from "next/server";
import { BugTicket, type IBugTicket, type ITimelineEntry } from "@/models/BugTicket";
import { TicketSettings, getTicketSettings } from "@/models/TicketSettings";
import pkg from "../../../package.json";
import { INTERNAL_TIMELINE_TYPES, LEGACY_STATUS_MAP, SOLVED_STATUSES, TERMINAL_STATUSES, statusLabel, type TicketStatus } from "./constants";
import { sendReporterUpdateEmail } from "./emails";

export const APP_VERSION = [pkg.version, process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7)].filter(Boolean).join("+");

type TimelineInput = Omit<ITimelineEntry, "_id" | "createdAt" | "visibility" | "mentions" | "attachments"> &
  Partial<Pick<ITimelineEntry, "mentions" | "attachments">>;

/** Appends a timeline entry; visibility is derived from the type so it can't be set wrong. */
export function pushTimeline(ticket: IBugTicket, entry: TimelineInput): void {
  ticket.timeline.push({
    ...entry,
    mentions: entry.mentions ?? [],
    attachments: entry.attachments ?? [],
    visibility: INTERNAL_TIMELINE_TYPES.includes(entry.type) ? "internal" : "public",
    createdAt: new Date(),
  } as ITimelineEntry);
  ticket.lastActivityAt = new Date();
}

/** Applies a status change with all its side effects (timestamps + timeline). */
export function applyStatusChange(ticket: IBugTicket, to: TicketStatus, actor: { role: "superadmin"; id: string; name: string }, note?: string): void {
  const from = ticket.status;
  if (from === to) return;
  ticket.status = to;

  // closedAt starts the retention clock; any non-terminal status stops it.
  ticket.closedAt = TERMINAL_STATUSES.includes(to) ? new Date() : null;

  if (SOLVED_STATUSES.includes(to)) {
    if (!ticket.resolvedAt) {
      ticket.resolvedAt = new Date();
      ticket.resolvedBy = actor.name;
    }
  } else {
    ticket.resolvedAt = null;
    ticket.resolvedBy = "";
  }

  // Moving an archived ticket back into the workflow restores it.
  if (!TERMINAL_STATUSES.includes(to) && ticket.isArchived) {
    ticket.isArchived = false;
    ticket.archivedAt = null;
    pushTimeline(ticket, { type: "unarchived", actorRole: "system", actorId: "", actorName: "System", message: "Restored from archive." });
  }

  pushTimeline(ticket, {
    type: "status_change",
    actorRole: actor.role,
    actorId: actor.id,
    actorName: actor.name,
    from,
    to,
    message: note || "",
  });
}

// ---- Serialization -------------------------------------------------------

type Lean<T> = T & { _id: unknown };

/** Full view for Super Admins. */
export function toAdminTicket(ticket: Lean<IBugTicket> | IBugTicket) {
  const t = "toObject" in ticket ? (ticket as IBugTicket).toObject() : ticket;
  return { ...t, _id: String(t._id), timeline: [...(t.timeline ?? [])].map((e: ITimelineEntry) => ({ ...e, _id: String(e._id) })) };
}

/**
 * Reporter view: drops internal notes, developer notes and assignment
 * entries, plus fields the reporter has no business seeing (IP, session,
 * who it's assigned to, admin-side unread state).
 */
export function toReporterTicket(ticket: Lean<IBugTicket> | IBugTicket) {
  const t = "toObject" in ticket ? (ticket as IBugTicket).toObject() : ticket;
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- stripping private fields
  const { ipAddress, sessionId, userAgent, ...context } = t.context ?? {};
  return {
    _id: String(t._id),
    ticketNumber: t.ticketNumber,
    title: t.title,
    description: t.description,
    category: t.category,
    priority: t.priority,
    status: t.status,
    resolution: SOLVED_STATUSES.includes(t.status) ? t.resolution : "",
    resolvedAt: t.resolvedAt,
    reporter: t.reporter,
    context,
    attachments: t.attachments,
    isArchived: t.isArchived,
    reporterUnread: t.reporterUnread,
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
    lastActivityAt: t.lastActivityAt,
    timeline: (t.timeline ?? [])
      .filter((e: ITimelineEntry) => e.visibility === "public")
      .map((e: ITimelineEntry) => ({ ...e, _id: String(e._id), actorId: undefined, mentions: undefined })),
  };
}

// ---- Reporter notifications ----------------------------------------------

/** Emails the reporter about an update (in-app badge is the reporterUnread flag). Never throws. */
export function notifyReporter(ticket: IBugTicket, update: { headline: string; message?: string }, origin: string): void {
  // The Super Admin's own tickets: they're the one making the change.
  if (ticket.reporter.role === "superadmin") return;
  sendReporterUpdateEmail(ticket, update, `${origin}/dashboard/my-bugs/${ticket._id}`).catch((err) =>
    console.warn("[bug-reports] reporter email failed:", err instanceof Error ? err.message : err),
  );
}

export function statusHeadline(status: TicketStatus): string {
  switch (status) {
    case "resolved": return "Your bug report has been resolved";
    case "closed": return "Your bug report has been closed";
    case "reopened": return "Your bug report has been reopened";
    case "waiting_for_information": return "We need a bit more information about your report";
    default: return `Your bug report is now: ${statusLabel(status)}`;
  }
}

// ---- Data migration ---------------------------------------------------------

let statusMigration: Promise<void> | null = null;

/**
 * One-time migration from the original 19-status workflow to the current
 * 7 statuses (LEGACY_STATUS_MAP). Idempotent (once nothing matches, it is a
 * handful of no-op updateMany calls) and runs at most once per server
 * process; on failure it retries on the next call. Rewrites the ticket
 * status and the from/to of status_change timeline entries only, because
 * assignment entries also store the word "assigned".
 */
export function migrateLegacyStatuses(): Promise<void> {
  statusMigration ??= (async () => {
    const byTarget = new Map<TicketStatus, string[]>();
    for (const [legacy, target] of Object.entries(LEGACY_STATUS_MAP)) {
      byTarget.set(target, [...(byTarget.get(target) ?? []), legacy]);
    }
    for (const [target, legacy] of byTarget) {
      // Raw collection: legacy values are outside the schema enum, so skip Mongoose casting.
      await BugTicket.collection.updateMany({ status: { $in: legacy } }, { $set: { status: target } });
      for (const field of ["from", "to"] as const) {
        await BugTicket.collection.updateMany(
          { timeline: { $elemMatch: { type: "status_change", [field]: { $in: legacy } } } },
          { $set: { [`timeline.$[e].${field}`]: target } },
          { arrayFilters: [{ "e.type": "status_change", [`e.${field}`]: { $in: legacy } }] },
        );
      }
    }
  })().catch((err) => {
    statusMigration = null;
    console.warn("[bug-reports] status migration failed, will retry:", err);
  });
  return statusMigration;
}

// ---- Retention -----------------------------------------------------------

const CLEANUP_INTERVAL_MS = 60 * 60 * 1000;

/**
 * Archives terminal tickets closed longer ago than the retention period.
 * Archiving (not deleting) keeps solved tickets searchable as a knowledge
 * base; Super Admins can permanently delete archived tickets by hand.
 * Runs opportunistically (at most hourly) from Super Admin list/stats
 * requests, so no cron is required; `force` runs it immediately.
 */
export async function runRetentionSweep(force = false): Promise<{ archived: number; skipped: boolean }> {
  const settings = await getTicketSettings();
  if (!settings.retentionDays) return { archived: 0, skipped: true };
  if (!force && settings.lastCleanupAt && Date.now() - new Date(settings.lastCleanupAt).getTime() < CLEANUP_INTERVAL_MS) {
    return { archived: 0, skipped: true };
  }

  // Claim the sweep first so concurrent requests don't all run it.
  await TicketSettings.updateOne({ _id: "global" }, { $set: { lastCleanupAt: new Date() } });

  const cutoff = new Date(Date.now() - settings.retentionDays * 24 * 60 * 60 * 1000);
  const now = new Date();
  const result = await BugTicket.updateMany(
    { isArchived: false, status: { $in: TERMINAL_STATUSES }, closedAt: { $ne: null, $lte: cutoff } },
    {
      $set: { isArchived: true, archivedAt: now },
      $push: {
        timeline: {
          type: "archived",
          visibility: "internal",
          actorRole: "system",
          actorId: "",
          actorName: "System",
          message: `Archived automatically after ${settings.retentionDays} days (retention policy).`,
          mentions: [],
          attachments: [],
          createdAt: now,
        },
      },
    },
  );
  return { archived: result.modifiedCount, skipped: false };
}

/** Uniform JSON error helper for the ticket routes. */
export function jsonError(message: string, status = 400) {
  return NextResponse.json({ success: false, message }, { status });
}
