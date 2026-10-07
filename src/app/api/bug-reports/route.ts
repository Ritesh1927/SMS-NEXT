import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { BugTicket } from "@/models/BugTicket";
import { nextTicketNumber } from "@/models/TicketCounter";
import { getTicketSettings } from "@/models/TicketSettings";
import { appOrigin, requireTicketUser } from "@/lib/bugReports/auth";
import { resolveReporter } from "@/lib/bugReports/reporter";
import { AttachmentError, isCloudinaryConfigured, verifyAttachments } from "@/lib/bugReports/attachments";
import { createTicketSchema, firstIssue } from "@/lib/bugReports/validation";
import { APP_VERSION, jsonError, pushTimeline } from "@/lib/bugReports/service";
import { sendNewTicketEmail } from "@/lib/bugReports/emails";

const DUPLICATE_WINDOW_MS = 10 * 60 * 1000;

// GET /api/bug-reports -- "My Reported Bugs": the caller's own tickets only.
export async function GET(req: Request) {
  const result = requireTicketUser(req);
  if ("error" in result) return result.error;
  const { auth } = result;

  const url = new URL(req.url);
  const page = Math.max(1, Number(url.searchParams.get("page")) || 1);
  const limit = Math.min(50, Math.max(5, Number(url.searchParams.get("limit")) || 10));

  try {
    await connectDB();
    const filter = { "reporter.userId": auth.id, "reporter.role": auth.role };
    const [items, total] = await Promise.all([
      BugTicket.find(filter)
        .sort({ lastActivityAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .select("ticketNumber title status priority category createdAt lastActivityAt reporterUnread isArchived")
        .lean(),
      BugTicket.countDocuments(filter),
    ]);
    return NextResponse.json({
      success: true,
      data: items.map((t) => ({ ...t, _id: String(t._id) })),
      pagination: { page, limit, total, pages: Math.max(1, Math.ceil(total / limit)) },
    });
  } catch (err) {
    console.error("[bug-reports] list failed:", err);
    return jsonError("Couldn't load your reports. Please try again.", 500);
  }
}

// POST /api/bug-reports -- create a ticket.
export async function POST(req: Request) {
  const result = requireTicketUser(req);
  if ("error" in result) return result.error;
  const { auth } = result;

  // Spam guard: 5 reports per user per 15 minutes.
  const limited = await checkRateLimit({
    key: `bug-create:${auth.role}:${auth.id}`,
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: "You've sent several reports in a short time. Please wait a few minutes before sending another.",
  });
  if (limited) return limited;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return jsonError("Invalid request body.");
  }
  const parsed = createTicketSchema.safeParse(body);
  if (!parsed.success) return jsonError(firstIssue(parsed.error));
  const input = parsed.data;

  if (!isCloudinaryConfigured()) return jsonError("File uploads aren't configured on this server.", 503);

  try {
    await connectDB();
    const reporter = await resolveReporter(auth);
    if (!reporter) return jsonError("Your account couldn't be found. Please sign in again.", 401);

    // Same person, same title, minutes apart: almost certainly a double submit.
    const duplicate = await BugTicket.findOne({
      "reporter.userId": auth.id,
      "reporter.role": auth.role,
      title: input.title,
      createdAt: { $gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
    })
      .select("ticketNumber")
      .lean();
    if (duplicate) {
      return jsonError(`You already reported this a moment ago as ${duplicate.ticketNumber}.`, 409);
    }

    const settings = await getTicketSettings();
    const attachments = await verifyAttachments(auth, input.attachments, settings);

    const ticket = new BugTicket({
      ticketNumber: await nextTicketNumber(),
      title: input.title,
      description: input.description,
      category: input.category,
      priority: input.priority,
      status: "new",
      reporter,
      context: {
        ...input.context,
        route: input.context.pageUrl.split(/[?#]/)[0],
        appVersion: APP_VERSION,
        userAgent: (req.headers.get("user-agent") || "").slice(0, 400),
        ipAddress: getClientIp(req),
        sessionId: auth.sessionId,
      },
      attachments,
      adminUnread: true,
      reporterUnread: false,
    });
    pushTimeline(ticket, {
      type: "created",
      actorRole: auth.role,
      actorId: auth.id,
      actorName: reporter.name,
      message: "Reported the issue.",
      attachments,
    });
    await ticket.save();

    // Email the support inbox; never fail the submission over it.
    sendNewTicketEmail(ticket, `${appOrigin(req)}/super-admin/tickets/${ticket._id}`).catch((err) =>
      console.warn("[bug-reports] support email failed:", err instanceof Error ? err.message : err),
    );

    return NextResponse.json(
      { success: true, message: "Bug reported.", data: { _id: String(ticket._id), ticketNumber: ticket.ticketNumber } },
      { status: 201 },
    );
  } catch (err) {
    if (err instanceof AttachmentError) return jsonError(err.message);
    console.error("[bug-reports] create failed:", err);
    return jsonError("Couldn't submit your report. Please try again.", 500);
  }
}
