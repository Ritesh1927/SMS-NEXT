import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { BugTicket } from "@/models/BugTicket";
import { SuperAdmin } from "@/models/SuperAdmin";
import { getTicketSettings } from "@/models/TicketSettings";
import { appOrigin, requireSuperAdminActor } from "@/lib/bugReports/auth";
import { AttachmentError, verifyAttachments } from "@/lib/bugReports/attachments";
import { adminCommentSchema, firstIssue } from "@/lib/bugReports/validation";
import { jsonError, notifyReporter, pushTimeline, toAdminTicket } from "@/lib/bugReports/service";
import { sendMentionEmail } from "@/lib/bugReports/emails";

// POST /api/superadmin/tickets/:id/comments -- reply (visible to the
// reporter, who is notified), internal note or developer note (team only).
// @mentions are resolved against the Super Admin team and emailed.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const gate = await requireSuperAdminActor(req);
    if ("error" in gate) return gate.error;
    const { actor } = gate;
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Ticket not found.", 404);

    const limited = await checkRateLimit({ key: `ticket-admin-comment:${actor.id}`, windowMs: 5 * 60 * 1000, max: 60, message: "Slow down a little." });
    if (limited) return limited;

    const parsed = adminCommentSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError(firstIssue(parsed.error));
    const input = parsed.data;

    const ticket = await BugTicket.findById(id);
    if (!ticket) return jsonError("Ticket not found.", 404);

    const auth = { id: actor.id, role: "superadmin" as const, schoolId: actor.id, sessionId: "" };
    const attachments = input.attachments.length ? await verifyAttachments(auth, input.attachments, await getTicketSettings()) : [];
    const mentioned = input.mentions.length
      ? await SuperAdmin.find({ _id: { $in: input.mentions }, isActive: { $ne: false } }).select("name email").lean()
      : [];

    pushTimeline(ticket, {
      type: input.type,
      actorRole: actor.role,
      actorId: actor.id,
      actorName: actor.name,
      message: input.message,
      mentions: mentioned.map((m) => m.name),
      attachments,
    });
    if (input.type === "reply") ticket.reporterUnread = true;
    await ticket.save();

    const origin = appOrigin(req);
    if (input.type === "reply") {
      notifyReporter(ticket, { headline: "The EduNivo support team replied to your report", message: input.message }, origin);
    }
    for (const m of mentioned) {
      if (String(m._id) === actor.id || !m.email) continue;
      sendMentionEmail(m.email, ticket, actor.name, input.message, `${origin}/super-admin/tickets/${ticket._id}`).catch(() => {});
    }

    return NextResponse.json({ success: true, message: "Comment added.", data: toAdminTicket(ticket) });
  } catch (err) {
    if (err instanceof AttachmentError) return jsonError(err.message);
    console.error("[tickets] comment failed:", err);
    return jsonError("Couldn't add the comment.", 500);
  }
}
