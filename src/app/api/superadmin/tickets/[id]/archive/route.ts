import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { BugTicket } from "@/models/BugTicket";
import { requireSuperAdminActor } from "@/lib/bugReports/auth";
import { TERMINAL_STATUSES } from "@/lib/bugReports/constants";
import { jsonError, pushTimeline, toAdminTicket } from "@/lib/bugReports/service";

const bodySchema = z.object({ archived: z.boolean() });

// POST /api/superadmin/tickets/:id/archive { archived } -- manual archive /
// restore. Only finished (terminal) tickets can be archived.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const gate = await requireSuperAdminActor(req);
    if ("error" in gate) return gate.error;
    const { actor } = gate;
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Ticket not found.", 404);

    const parsed = bodySchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError("Invalid request.");

    const ticket = await BugTicket.findById(id);
    if (!ticket) return jsonError("Ticket not found.", 404);
    if (ticket.isArchived === parsed.data.archived) return NextResponse.json({ success: true, data: toAdminTicket(ticket) });
    if (parsed.data.archived && !TERMINAL_STATUSES.includes(ticket.status)) {
      return jsonError("Only resolved, closed or rejected tickets can be archived.", 409);
    }

    ticket.isArchived = parsed.data.archived;
    ticket.archivedAt = parsed.data.archived ? new Date() : null;
    pushTimeline(ticket, {
      type: parsed.data.archived ? "archived" : "unarchived",
      actorRole: actor.role,
      actorId: actor.id,
      actorName: actor.name,
      message: parsed.data.archived ? "Archived manually." : "Restored from archive.",
    });
    await ticket.save();
    return NextResponse.json({ success: true, message: parsed.data.archived ? "Ticket archived." : "Ticket restored.", data: toAdminTicket(ticket) });
  } catch (err) {
    console.error("[tickets] archive failed:", err);
    return jsonError("Couldn't update the archive.", 500);
  }
}
