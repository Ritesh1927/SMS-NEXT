import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
import { connectDB } from "@/lib/db";
import { BugTicket } from "@/models/BugTicket";
import { requireTicketUser } from "@/lib/bugReports/auth";
import { jsonError, toReporterTicket } from "@/lib/bugReports/service";

// GET /api/bug-reports/:id -- one of the caller's own tickets (reporter
// view: no internal notes). Opening it clears the reporter's unread flag.
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const result = requireTicketUser(req);
  if ("error" in result) return result.error;
  const { auth } = result;
  const { id } = await params;
  if (!isValidObjectId(id)) return jsonError("Report not found.", 404);

  try {
    await connectDB();
    // Ownership is part of the query, so another user's id is a plain 404.
    const ticket = await BugTicket.findOneAndUpdate(
      { _id: id, "reporter.userId": auth.id, "reporter.role": auth.role },
      { $set: { reporterUnread: false } },
      { returnDocument: "after" },
    ).lean();
    if (!ticket) return jsonError("Report not found.", 404);
    return NextResponse.json({ success: true, data: toReporterTicket(ticket) });
  } catch (err) {
    console.error("[bug-reports] detail failed:", err);
    return jsonError("Couldn't load this report.", 500);
  }
}
