import { NextResponse } from "next/server";
import { z } from "zod";
import { connectDB } from "@/lib/db";
import { checkRateLimit, getClientIp } from "@/lib/rateLimit";
import { sendMail } from "@/lib/mail";
import { escapeHtml, supportInbox } from "@/lib/bugReports/emails";
import { Lead } from "@/models/Lead";

// POST /api/leads -- public homepage enquiries (no auth).
//   { kind: "demo", schoolName, contactPerson, phone, email, city, students }
//   { kind: "newsletter", email }
// Saved to the Lead collection, then emailed to the support inbox.
// Spam protection: per-IP rate limit + a hidden honeypot field ("website").

const text = (max: number) => z.string().trim().max(max);

const demoSchema = z.object({
  kind: z.literal("demo"),
  schoolName: text(120).min(2, "Please enter your school name."),
  contactPerson: text(80).min(2, "Please enter the contact person's name."),
  phone: z.string().trim().regex(/^(\+?91[\s-]?)?[6-9]\d{9}$/, "Enter a valid 10-digit Indian mobile number."),
  email: z.email("Enter a valid email address.").max(160),
  city: text(80).min(2, "Please enter your city."),
  students: z.enum(["Under 300", "300 – 1,000", "1,000 – 3,000", "3,000+"], { error: "Choose the number of students." }),
  website: z.string().max(0).optional(),
});

const newsletterSchema = z.object({
  kind: z.literal("newsletter"),
  email: z.email("Enter a valid email address.").max(160),
  website: z.string().max(0).optional(),
});

const bodySchema = z.discriminatedUnion("kind", [demoSchema, newsletterSchema]);

export async function POST(req: Request) {
  const raw = await req.json().catch(() => null);

  // Honeypot: real visitors never fill the hidden field. Pretend success.
  if (raw && typeof raw === "object" && "website" in raw && raw.website) {
    return NextResponse.json({ success: true });
  }

  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ success: false, message: parsed.error.issues[0]?.message || "Invalid request." }, { status: 400 });
  }
  const input = parsed.data;

  const ip = getClientIp(req);
  if (ip) {
    const limited = await checkRateLimit({
      key: `lead:${input.kind}:${ip}`,
      windowMs: 60 * 60 * 1000,
      max: input.kind === "demo" ? 5 : 10,
      message: "Too many requests. Please try again in a little while.",
    });
    if (limited) return limited;
  }

  try {
    await connectDB();
    const lead = await Lead.create({
      ...input,
      ipAddress: ip,
      userAgent: (req.headers.get("user-agent") || "").slice(0, 300),
    });

    const to = supportInbox();
    if (to) {
      const rows =
        input.kind === "demo"
          ? [
              ["School", input.schoolName],
              ["Contact person", input.contactPerson],
              ["Mobile", input.phone],
              ["Email", input.email],
              ["City", input.city],
              ["Students", input.students],
            ]
          : [["Email", input.email]];
      const html = `<div style="font-family:Segoe UI,Arial,sans-serif;padding:24px;color:#101828">
<h2 style="margin:0 0 12px;color:#1F6FA6">${input.kind === "demo" ? "New demo request" : "New newsletter sign-up"}</h2>
<table cellpadding="8" style="border-collapse:collapse;border:1px solid #e4e7ec">${rows
        .map(([k, v]) => `<tr><td style="background:#f8fbfe;color:#667085;font-size:13px">${escapeHtml(k)}</td><td style="font-weight:600;font-size:14px">${escapeHtml(v)}</td></tr>`)
        .join("")}</table>
<p style="font-size:12px;color:#667085">Lead #${escapeHtml(String(lead._id))} · ${new Date().toLocaleString("en-IN", { timeZone: "Asia/Kolkata" })} IST</p></div>`;
      sendMail(to, input.kind === "demo" ? `Demo request: ${input.schoolName} (${input.city})` : "Newsletter sign-up", html).catch((err) =>
        console.warn("[leads] notification email failed:", err instanceof Error ? err.message : err),
      );
    }

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (err) {
    console.error("[leads] save failed:", err);
    return NextResponse.json({ success: false, message: "Something went wrong. Please try again or call us." }, { status: 500 });
  }
}
