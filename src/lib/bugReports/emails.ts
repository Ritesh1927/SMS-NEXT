import { sendMail } from "@/lib/mail";
import type { IBugTicket } from "@/models/BugTicket";
import { ROLE_LABELS, categoryLabel, priorityLabel, statusLabel } from "./constants";

// Branded HTML emails for the ticket system. Email clients only render
// inline styles and tables reliably, hence the old-school markup. Every
// user-supplied value goes through escapeHtml().

const BRAND = "#5048e5";
const BRAND_2 = "#8d61f5";
const PRIORITY_COLORS: Record<string, string> = { low: "#64748b", medium: "#0ea5e9", high: "#f59e0b", critical: "#ef4444" };

/** The official EduNivo support inbox: SUPPORT_EMAIL if set, else the configured sender (EMAIL_USER). */
export function supportInbox(): string | null {
  return process.env.SUPPORT_EMAIL || process.env.EMAIL_USER || null;
}

export function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const nl2br = (s: string) => escapeHtml(s).replace(/\n/g, "<br>");

function layout(opts: { preheader: string; heading: string; badge?: string; body: string; cta?: { label: string; href: string } }): string {
  return `<!doctype html><html><body style="margin:0;padding:0;background:#eff0f6;font-family:Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#11182c">
<span style="display:none;max-height:0;overflow:hidden">${escapeHtml(opts.preheader)}</span>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#eff0f6;padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:18px;overflow:hidden;box-shadow:0 18px 40px -20px rgba(80,72,229,.35)">
<tr><td style="background:linear-gradient(135deg,${BRAND},${BRAND_2});background-color:${BRAND};padding:28px 32px;color:#ffffff">
<div style="font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;opacity:.85">EduNivo Support</div>
<div style="font-size:22px;font-weight:800;margin-top:6px;line-height:1.3">${escapeHtml(opts.heading)}</div>
${opts.badge ? `<div style="display:inline-block;margin-top:12px;padding:4px 12px;border-radius:999px;background:rgba(255,255,255,.2);font-size:12px;font-weight:700">${escapeHtml(opts.badge)}</div>` : ""}
</td></tr>
<tr><td style="padding:28px 32px">${opts.body}
${opts.cta ? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:24px"><tr><td style="border-radius:12px;background:${BRAND}"><a href="${escapeHtml(opts.cta.href)}" style="display:inline-block;padding:13px 26px;font-size:14px;font-weight:700;color:#ffffff;text-decoration:none">${escapeHtml(opts.cta.label)}</a></td></tr></table>` : ""}
</td></tr>
<tr><td style="padding:18px 32px;background:#f7f7fb;font-size:12px;color:#576078;border-top:1px solid #e5e7f0">EduNivo · School Management System. This is an automated message from the EduNivo ticket system.</td></tr>
</table></td></tr></table></body></html>`;
}

function rows(pairs: [string, string | undefined][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border:1px solid #e5e7f0;border-radius:12px;border-collapse:separate;overflow:hidden;margin:0 0 18px">${pairs
    .filter(([, v]) => v)
    .map(
      ([k, v], i) =>
        `<tr style="background:${i % 2 ? "#ffffff" : "#fafaff"}"><td style="padding:9px 14px;font-size:12px;color:#576078;width:38%;vertical-align:top">${escapeHtml(k)}</td><td style="padding:9px 14px;font-size:13px;font-weight:600;color:#11182c">${escapeHtml(v)}</td></tr>`,
    )
    .join("")}</table>`;
}

const section = (title: string) =>
  `<div style="font-size:12px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;color:${BRAND};margin:22px 0 10px">${escapeHtml(title)}</div>`;

/** "Notify Super Admin instantly": sent to the support inbox on every new ticket. */
export async function sendNewTicketEmail(ticket: IBugTicket, adminLink: string): Promise<void> {
  const to = supportInbox();
  if (!to) return;
  const r = ticket.reporter;
  const c = ticket.context;
  const created = ticket.createdAt ?? new Date();
  const priorityColor = PRIORITY_COLORS[ticket.priority] || BRAND;

  const attachments = ticket.attachments
    .map(
      (a, i) =>
        `<a href="${escapeHtml(a.url)}" style="display:inline-block;margin:0 8px 8px 0;padding:8px 12px;border-radius:10px;background:#eef0ff;color:${BRAND};font-size:12px;font-weight:700;text-decoration:none">${a.kind === "video" ? "▶ Video" : "🖼 Image"} ${i + 1}: ${escapeHtml(a.name)} (${(a.bytes / 1024 / 1024).toFixed(1)} MB)</a>`,
    )
    .join("");

  const body = `
<div style="font-size:18px;font-weight:800;line-height:1.35">${escapeHtml(ticket.title)}</div>
<div style="margin:10px 0 0"><span style="display:inline-block;padding:3px 10px;border-radius:999px;background:${priorityColor};color:#fff;font-size:11px;font-weight:800">${escapeHtml(priorityLabel(ticket.priority))} priority</span>
<span style="display:inline-block;margin-left:6px;padding:3px 10px;border-radius:999px;background:#eef0ff;color:${BRAND};font-size:11px;font-weight:800">${escapeHtml(categoryLabel(ticket.category))}</span></div>
<div style="margin:16px 0 0;padding:14px 16px;border-radius:12px;background:#fafaff;border:1px solid #e5e7f0;font-size:14px;line-height:1.6">${nl2br(ticket.description)}</div>
${section("Raised by")}
${rows([
    ["Raised by", ROLE_LABELS[r.role] || r.role],
    ["Name", r.name],
    ["School", r.schoolName],
    [r.role === "teacher" ? "Teacher ID" : "Student ID", r.role === "teacher" || r.role === "student" ? r.userCode : ""],
  ])}
${section("Where it happened")}
${rows([
    ["Page URL", c.pageUrl],
    ["Module / Page", [c.module, c.pageName].filter(Boolean).join(" › ")],
    ["Browser", c.browser],
    ["Operating system", c.os],
    ["Device", [c.deviceType, c.screenResolution].filter(Boolean).join(" · ")],
    ["Installed app", c.standalone ? "Yes" : "No"],
    ["Date", created.toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Kolkata" })],
    ["Time", `${created.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Kolkata" })} IST (reporter: ${c.timeZone || "unknown"})`],
    ["IP address", c.ipAddress],
    ["App version", c.appVersion],
  ])}
${section(`Attachments (${ticket.attachments.length})`)}
<div>${attachments}</div>`;

  await sendMail(
    to,
    `[${ticket.ticketNumber}] ${priorityLabel(ticket.priority)}: ${ticket.title}`,
    layout({
      preheader: `${r.name} (${ROLE_LABELS[r.role] || r.role}, ${r.schoolName}) reported: ${ticket.title}`,
      heading: `New bug report ${ticket.ticketNumber}`,
      badge: `${ROLE_LABELS[r.role] || r.role} · ${r.schoolName || "No school"}`,
      body,
      cta: { label: "Open ticket in Admin Panel", href: adminLink },
    }),
  );
}

/** Tells the reporter their ticket changed (status / reply / resolved / reopened). */
export async function sendReporterUpdateEmail(
  ticket: IBugTicket,
  update: { headline: string; message?: string },
  link: string,
): Promise<void> {
  const to = ticket.reporter.email;
  if (!to) return;
  const body = `
<p style="font-size:15px;margin:0 0 6px">Hi ${escapeHtml(ticket.reporter.name.split(" ")[0] || "there")},</p>
<p style="font-size:14px;line-height:1.6;margin:0 0 16px">${escapeHtml(update.headline)}</p>
${update.message ? `<div style="margin:0 0 16px;padding:14px 16px;border-radius:12px;background:#fafaff;border-left:4px solid ${BRAND};font-size:14px;line-height:1.6">${nl2br(update.message)}</div>` : ""}
${rows([
    ["Ticket", ticket.ticketNumber],
    ["Title", ticket.title],
    ["Status", statusLabel(ticket.status)],
  ])}`;
  await sendMail(
    to,
    `[${ticket.ticketNumber}] ${update.headline}`,
    layout({ preheader: update.headline, heading: update.headline, badge: statusLabel(ticket.status), body, cta: { label: "View your report", href: link } }),
  );
}

/** Notifies a team member they were @mentioned on a ticket. */
export async function sendMentionEmail(to: string, ticket: IBugTicket, byName: string, message: string, link: string): Promise<void> {
  const body = `
<p style="font-size:14px;line-height:1.6;margin:0 0 14px"><b>${escapeHtml(byName)}</b> mentioned you on <b>${escapeHtml(ticket.ticketNumber)}</b>: ${escapeHtml(ticket.title)}</p>
<div style="padding:14px 16px;border-radius:12px;background:#fafaff;border-left:4px solid ${BRAND};font-size:14px;line-height:1.6">${nl2br(message)}</div>`;
  await sendMail(
    to,
    `[${ticket.ticketNumber}] ${byName} mentioned you`,
    layout({ preheader: `${byName} mentioned you`, heading: "You were mentioned", body, cta: { label: "Open ticket", href: link } }),
  );
}
