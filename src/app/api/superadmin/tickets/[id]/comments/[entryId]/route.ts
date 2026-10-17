import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { BugTicket } from "@/models/BugTicket";
import { requireSuperAdminActor } from "@/lib/bugReports/auth";
import { destroyAttachment } from "@/lib/bugReports/attachments";
import { DELETABLE_TIMELINE_TYPES } from "@/lib/bugReports/constants";
import { jsonError, toAdminTicket } from "@/lib/bugReports/service";

// DELETE /api/superadmin/tickets/:id/comments/:entryId -- removes one chat
// message (reply / reporter comment / internal or developer note) from the
// timeline, incl. its attachments. Status/priority/assignment history can't
// be targeted this way -- that's audit trail, not a message to delete.
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string; entryId: string }> }) {
  try {
    await connectDB();
    const gate = await requireSuperAdminActor(req);
    if ("error" in gate) return gate.error;
    const { id, entryId } = await params;
    if (!isValidObjectId(id) || !isValidObjectId(entryId)) return jsonError("Not found.", 404);

    const ticket = await BugTicket.findById(id);
    if (!ticket) return jsonError("Ticket not found.", 404);

    const entry = ticket.timeline.id(entryId);
    if (!entry) return jsonError("That message no longer exists.", 404);
    if (!DELETABLE_TIMELINE_TYPES.includes(entry.type)) return jsonError("That entry can't be deleted.", 400);

    await Promise.all((entry.attachments ?? []).map((a) => destroyAttachment(a.publicId, a.kind)));
    entry.deleteOne();
    ticket.lastActivityAt = new Date();
    await ticket.save();

    return NextResponse.json({ success: true, message: "Message deleted.", data: toAdminTicket(ticket) });
  } catch (err) {
    console.error("[tickets] comment delete failed:", err);
    return jsonError("Couldn't delete this message.", 500);
  }
}
