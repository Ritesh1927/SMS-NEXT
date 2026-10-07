import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { BugTicket } from "@/models/BugTicket";
import { requireTicketUser } from "@/lib/bugReports/auth";

// GET /api/bug-reports/unread -- how many of the caller's reports have
// updates they haven't seen. Polled by the floating Report-a-Bug button.
export async function GET(req: Request) {
  const result = requireTicketUser(req);
  if ("error" in result) return result.error;
  const { auth } = result;

  try {
    await connectDB();
    const count = await BugTicket.countDocuments({ "reporter.userId": auth.id, "reporter.role": auth.role, reporterUnread: true });
    return NextResponse.json({ success: true, count });
  } catch {
    return NextResponse.json({ success: true, count: 0 });
  }
}
