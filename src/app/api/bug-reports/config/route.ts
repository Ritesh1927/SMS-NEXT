import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getTicketSettings } from "@/models/TicketSettings";
import { requireTicketUser } from "@/lib/bugReports/auth";
import { APP_VERSION } from "@/lib/bugReports/service";
import { isCloudinaryConfigured } from "@/lib/bugReports/attachments";

// GET /api/bug-reports/config -- what the report form needs up front:
// upload limits (Super Admin-configurable) and the app version.
export async function GET(req: Request) {
  const result = requireTicketUser(req);
  if ("error" in result) return result.error;

  await connectDB();
  const settings = await getTicketSettings();
  return NextResponse.json(
    {
      success: true,
      data: {
        maxImageMB: settings.maxImageMB,
        maxVideoMB: settings.maxVideoMB,
        appVersion: APP_VERSION,
        uploadsEnabled: isCloudinaryConfigured(),
      },
    },
    // Limits change rarely; let the browser reuse them for a few minutes.
    { headers: { "Cache-Control": "private, max-age=300" } },
  );
}
