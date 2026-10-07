import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { checkRateLimit } from "@/lib/rateLimit";
import { getTicketSettings } from "@/models/TicketSettings";
import { requireTicketUser } from "@/lib/bugReports/auth";
import { createUploadSignature, isCloudinaryConfigured } from "@/lib/bugReports/attachments";
import { attachmentKindOf } from "@/lib/bugReports/constants";
import { jsonError } from "@/lib/bugReports/service";

const bodySchema = z.object({
  filename: z.string().min(1).max(200),
  bytes: z.number().int().positive(),
});

// POST /api/bug-reports/upload-signature -- signed parameters for one direct
// browser -> Cloudinary upload into the caller's own folder. The declared
// type/size is checked here for fast feedback and re-verified on submit.
export async function POST(req: Request) {
  const result = requireTicketUser(req);
  if ("error" in result) return result.error;
  const { auth } = result;

  if (!isCloudinaryConfigured()) return jsonError("File uploads aren't configured on this server.", 503);

  const limited = await checkRateLimit({
    key: `bug-upload:${auth.role}:${auth.id}`,
    windowMs: 15 * 60 * 1000,
    max: 60,
    message: "Too many uploads. Please wait a few minutes.",
  });
  if (limited) return limited;

  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid file.");

  const kind = attachmentKindOf(parsed.data.filename);
  if (!kind) return jsonError("Only JPG, PNG, WebP images and MP4, MOV, WebM videos are supported.");

  await connectDB();
  const settings = await getTicketSettings();
  const maxMB = kind === "image" ? settings.maxImageMB : settings.maxVideoMB;
  if (parsed.data.bytes > maxMB * 1024 * 1024) {
    return jsonError(`${kind === "image" ? "Images" : "Videos"} must be under ${maxMB} MB.`, 413);
  }

  return NextResponse.json({ success: true, data: { kind, ...createUploadSignature(auth, kind, maxMB) } });
}
