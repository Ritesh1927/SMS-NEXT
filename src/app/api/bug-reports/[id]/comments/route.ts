import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { BugTicket } from "@/models/BugTicket";
import { getTicketSettings } from "@/models/TicketSettings";
import { requireTicketUser } from "@/lib/bugReports/auth";
import { AttachmentError, verifyAttachments } from "@/lib/bugReports/attachments";
import { AWAITING_REPORTER_STATUSES } from "@/lib/bugReports/constants";
import { firstIssue, reporterCommentSchema } from "@/lib/bugReports/validation";
import { jsonError, pushTimeline, toReporterTicket } from "@/lib/bugReports/service";

// POST /api/bug-reports/:id/comments -- the reporter adds a comment. Files
// are accepted only while the team is waiting for information from them.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = requireTicketUser(req);
  if ("error" in result) return result.error;
  const { auth } = result;
  const { id } = await params;
  if (!isValidObjectId(id)) return jsonError("Report not found.", 404);

  const limited = await checkRateLimit({
    key: `bug-comment:${auth.role}:${auth.id}`,
    windowMs: 15 * 60 * 1000,
    max: 30,
    message: "You're commenting very quickly. Please wait a few minutes.",
  });
  if (limited) return limited;

  const parsed = reporterCommentSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError(firstIssue(parsed.error));
  const { message, attachments: refs } = parsed.data;

  try {
    await connectDB();
    const ticket = await BugTicket.findOne({ _id: id, "reporter.userId": auth.id, "reporter.role": auth.role });
    if (!ticket) return jsonError("Report not found.", 404);
    if (ticket.isArchived) return jsonError("This report is archived. Please open a new report instead.", 409);

    let attachments: Awaited<ReturnType<typeof verifyAttachments>> = [];
    if (refs.length) {
      if (!AWAITING_REPORTER_STATUSES.includes(ticket.status)) {
        return jsonError("You can attach files when the support team asks for more information.", 403);
      }
      attachments = await verifyAttachments(auth, refs, await getTicketSettings());
    }

    pushTimeline(ticket, {
      type: "reporter_comment",
      actorRole: auth.role,
      actorId: auth.id,
      actorName: ticket.reporter.name,
      message,
      attachments,
    });
    ticket.adminUnread = true;
    await ticket.save();

    return NextResponse.json({ success: true, message: "Comment added.", data: toReporterTicket(ticket) });
  } catch (err) {
    if (err instanceof AttachmentError) return jsonError(err.message);
    console.error("[bug-reports] comment failed:", err);
    return jsonError("Couldn't add your comment. Please try again.", 500);
  }
}
