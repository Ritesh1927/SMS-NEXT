import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { TicketSettings, getTicketSettings } from "@/models/TicketSettings";
import { requireSuperAdminActor } from "@/lib/bugReports/auth";
import { firstIssue, settingsSchema } from "@/lib/bugReports/validation";
import { jsonError, runRetentionSweep } from "@/lib/bugReports/service";

// GET/PUT /api/superadmin/tickets/settings -- retention period and upload
// size limits. POST runs the retention sweep right now.
export async function GET(req: Request) {
  await connectDB();
  const gate = await requireSuperAdminActor(req);
  if ("error" in gate) return gate.error;
  const s = await getTicketSettings();
  return NextResponse.json({
    success: true,
    data: { retentionDays: s.retentionDays, maxImageMB: s.maxImageMB, maxVideoMB: s.maxVideoMB, lastCleanupAt: s.lastCleanupAt },
  });
}

export async function PUT(req: Request) {
  try {
    await connectDB();
    const gate = await requireSuperAdminActor(req);
    if ("error" in gate) return gate.error;

    const parsed = settingsSchema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return jsonError(firstIssue(parsed.error));

    await getTicketSettings(); // ensure the singleton exists
    await TicketSettings.updateOne({ _id: "global" }, { $set: { ...parsed.data, updatedBy: gate.actor.name } }, { runValidators: true });
    return NextResponse.json({ success: true, message: "Ticket settings saved." });
  } catch (err) {
    console.error("[tickets] settings save failed:", err);
    return jsonError("Couldn't save settings.", 500);
  }
}

export async function POST(req: Request) {
  try {
    await connectDB();
    const gate = await requireSuperAdminActor(req);
    if ("error" in gate) return gate.error;
    const { archived, skipped } = await runRetentionSweep(true);
    return NextResponse.json({
      success: true,
      message: skipped ? "Retention is set to Never, so nothing was archived." : `${archived} ticket${archived === 1 ? "" : "s"} archived.`,
      data: { archived },
    });
  } catch (err) {
    console.error("[tickets] manual sweep failed:", err);
    return jsonError("Couldn't run the cleanup.", 500);
  }
}
