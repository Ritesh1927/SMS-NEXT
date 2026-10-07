import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { BugTicket } from "@/models/BugTicket";
import { SuperAdmin } from "@/models/SuperAdmin";
import { appOrigin, requireSuperAdminActor } from "@/lib/bugReports/auth";
import { destroyAttachment } from "@/lib/bugReports/attachments";
import { priorityLabel } from "@/lib/bugReports/constants";
import { adminUpdateSchema, firstIssue } from "@/lib/bugReports/validation";
import { applyStatusChange, jsonError, notifyReporter, pushTimeline, statusHeadline, toAdminTicket } from "@/lib/bugReports/service";

type Params = { params: Promise<{ id: string }> };

// GET /api/superadmin/tickets/:id -- full ticket incl. internal notes.
// Opening it marks it read for the admin side.
export async function GET(req: Request, { params }: Params) {
  try {
    await connectDB();
    const gate = await requireSuperAdminActor(req);
    if ("error" in gate) return gate.error;
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Ticket not found.", 404);

    const ticket = await BugTicket.findByIdAndUpdate(id, { $set: { adminUnread: false } }, { returnDocument: "after" }).lean();
    if (!ticket) return jsonError("Ticket not found.", 404);
    return NextResponse.json({ success: true, data: toAdminTicket(ticket) });
  } catch (err) {
    console.error("[tickets] detail failed:", err);
    return jsonError("Couldn't load this ticket.", 500);
  }
}

// PATCH /api/superadmin/tickets/:id -- status / priority / assignee /
// resolution. Every change is recorded on the timeline; status changes and
// resolutions notify the reporter.
export async function PATCH(req: Request, { params }: Params) {
  try {
    await connectDB();
    const gate = await requireSuperAdminActor(req);
    if ("error" in gate) return gate.error;
    const { actor } = gate;
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Ticket not found.", 404);

    const parsed = adminUpdateSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError(firstIssue(parsed.error));
    const input = parsed.data;

    const ticket = await BugTicket.findById(id);
    if (!ticket) return jsonError("Ticket not found.", 404);

    const actorRef = { actorRole: actor.role, actorId: actor.id, actorName: actor.name };
    let reporterUpdate: { headline: string; message?: string } | null = null;

    if (input.resolution !== undefined && input.resolution !== ticket.resolution) {
      ticket.resolution = input.resolution;
      if (input.resolution) pushTimeline(ticket, { ...actorRef, type: "resolution", message: input.resolution });
    }

    if (input.priority && input.priority !== ticket.priority) {
      pushTimeline(ticket, { ...actorRef, type: "priority_change", from: ticket.priority, to: input.priority, message: "" });
      ticket.priority = input.priority;
    }

    if (input.assignedTo !== undefined) {
      const current = ticket.assignedTo?.id ?? null;
      if (input.assignedTo !== current) {
        const assignee = input.assignedTo ? await SuperAdmin.findById(input.assignedTo).select("name isActive").lean() : null;
        if (input.assignedTo && (!assignee || assignee.isActive === false)) return jsonError("That team member doesn't exist.");
        ticket.assignedTo = assignee ? { id: input.assignedTo!, name: assignee.name } : null;
        pushTimeline(ticket, {
          ...actorRef,
          type: "assignment",
          from: current ? "assigned" : "unassigned",
          to: assignee ? assignee.name : "unassigned",
          message: assignee ? `Assigned to ${assignee.name}.` : "Unassigned.",
        });
        // Assigning a fresh ticket moves it along the workflow.
        if (assignee && ["new", "open", "acknowledged"].includes(ticket.status) && !input.status) {
          applyStatusChange(ticket, "assigned", actor);
        }
      }
    }

    if (input.status && input.status !== ticket.status) {
      applyStatusChange(ticket, input.status, actor, input.note);
      reporterUpdate = {
        headline: statusHeadline(input.status),
        message: [input.note, ["resolved", "closed"].includes(input.status) ? ticket.resolution : ""].filter(Boolean).join("\n\n") || undefined,
      };
    }

    if (reporterUpdate) ticket.reporterUnread = true;
    await ticket.save();
    if (reporterUpdate) notifyReporter(ticket, reporterUpdate, appOrigin(req));

    return NextResponse.json({
      success: true,
      message: input.priority ? `Priority set to ${priorityLabel(input.priority)}.` : "Ticket updated.",
      data: toAdminTicket(ticket),
    });
  } catch (err) {
    console.error("[tickets] update failed:", err);
    return jsonError("Couldn't update this ticket.", 500);
  }
}

// DELETE /api/superadmin/tickets/:id -- permanent deletion, archived
// tickets only (archive first, per the retention policy), incl. its files.
export async function DELETE(req: Request, { params }: Params) {
  try {
    await connectDB();
    const gate = await requireSuperAdminActor(req);
    if ("error" in gate) return gate.error;
    const { id } = await params;
    if (!isValidObjectId(id)) return jsonError("Ticket not found.", 404);

    const ticket = await BugTicket.findById(id).select("isArchived attachments timeline.attachments").lean();
    if (!ticket) return jsonError("Ticket not found.", 404);
    if (!ticket.isArchived) return jsonError("Archive the ticket before deleting it permanently.", 409);

    await BugTicket.deleteOne({ _id: id });
    const files = [...ticket.attachments, ...ticket.timeline.flatMap((e) => e.attachments ?? [])];
    await Promise.all([...new Map(files.map((f) => [f.publicId, f])).values()].map((f) => destroyAttachment(f.publicId, f.kind)));

    return NextResponse.json({ success: true, message: "Ticket deleted permanently." });
  } catch (err) {
    console.error("[tickets] delete failed:", err);
    return jsonError("Couldn't delete this ticket.", 500);
  }
}
