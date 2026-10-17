import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { BugTicket } from "@/models/BugTicket";
import { requireSuperAdminActor } from "@/lib/bugReports/auth";
import { destroyAttachment } from "@/lib/bugReports/attachments";
import { DELETABLE_TIMELINE_TYPES, NOTE_CLEARABLE_TIMELINE_TYPES } from "@/lib/bugReports/constants";
import { jsonError, toAdminTicket } from "@/lib/bugReports/service";

// DELETE /api/superadmin/tickets/:id/comments/:entryId -- removes a chat
// message. For reply / reporter comment / internal or developer note, the
// whole timeline entry is removed. For a status or priority change, the
// transition itself is audit trail and stays -- only its optional attached
// note is cleared, so "Open -> Resolved" survives even after its note goes.
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

    if (DELETABLE_TIMELINE_TYPES.includes(entry.type)) {
      await Promise.all((entry.attachments ?? []).map((a) => destroyAttachment(a.publicId, a.kind)));
      entry.deleteOne();
    } else if (NOTE_CLEARABLE_TIMELINE_TYPES.includes(entry.type) && entry.message) {
      await Promise.all((entry.attachments ?? []).map((a) => destroyAttachment(a.publicId, a.kind)));
      entry.message = "";
      entry.attachments = [];
    } else {
      return jsonError("That entry can't be deleted.", 400);
    }

    ticket.lastActivityAt = new Date();
    await ticket.save();

    return NextResponse.json({ success: true, message: "Message deleted.", data: toAdminTicket(ticket) });
  } catch (err) {
    console.error("[tickets] comment delete failed:", err);
    return jsonError("Couldn't delete this message.", 500);
  }
}
