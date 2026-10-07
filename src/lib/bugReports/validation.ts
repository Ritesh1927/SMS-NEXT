import { z } from "zod";
import {
  ADMIN_COMMENT_TYPES, CATEGORY_VALUES, FIELD_LIMITS, MAX_ATTACHMENTS_PER_UPLOAD, PRIORITY_VALUES, RETENTION_OPTIONS, STATUS_VALUES,
} from "./constants";

// Request schemas for every ticket endpoint. Strings are sanitized on the
// way in: control characters stripped, whitespace normalized, lengths
// capped. Output is still always escaped (React on screen, escapeHtml in
// emails) -- sanitizing input is defence in depth, not the only line.

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

/** Single-line text: no control chars, collapsed whitespace. */
const line = (max: number) =>
  z.string().transform((s) => s.replace(CONTROL_CHARS, "").replace(/\s+/g, " ").trim()).pipe(z.string().max(max));

/** Multi-line text: keeps newlines, trims, caps blank-line runs. */
const block = (min: number, max: number, label: string) =>
  z
    .string()
    .transform((s) => s.replace(CONTROL_CHARS, "").replace(/\r\n?/g, "\n").replace(/\n{4,}/g, "\n\n\n").trim())
    .pipe(
      z
        .string()
        .min(min, `${label} must be at least ${min} characters.`)
        .max(max, `${label} must be at most ${max} characters.`),
    );

/** Cloudinary public ids we issued look like bug-reports/<role>/<userId>/<random>. */
export const attachmentRefSchema = z.object({
  publicId: z.string().regex(/^[\w\-/]{1,200}$/, "Invalid attachment."),
  kind: z.enum(["image", "video"]),
  name: line(120).optional().default(""),
});
export type AttachmentRef = z.infer<typeof attachmentRefSchema>;

const attachmentList = (min: number) =>
  z
    .array(attachmentRefSchema)
    .min(min, "Attach at least one screenshot or screen recording.")
    .max(MAX_ATTACHMENTS_PER_UPLOAD, `Attach at most ${MAX_ATTACHMENTS_PER_UPLOAD} files.`);

/** A same-origin path (optionally with query/hash); absolute URLs are reduced to their path. */
const pagePath = z
  .string()
  .max(500)
  .transform((value, ctx) => {
    try {
      const url = new URL(value, "http://edunivo.local");
      return `${url.pathname}${url.search}${url.hash}`.slice(0, 500);
    } catch {
      ctx.addIssue({ code: "custom", message: "Invalid page URL." });
      return z.NEVER;
    }
  })
  .pipe(z.string().startsWith("/", "Invalid page URL."));

export const clientContextSchema = z.object({
  pageUrl: pagePath,
  module: line(80).optional().default(""),
  pageName: line(120).optional().default(""),
  browser: line(80).optional().default(""),
  os: line(80).optional().default(""),
  deviceType: line(40).optional().default(""),
  screenResolution: line(40).optional().default(""),
  viewport: line(40).optional().default(""),
  timeZone: line(80).optional().default(""),
  language: line(40).optional().default(""),
  clientTime: line(60).optional().default(""),
  standalone: z.boolean().optional().default(false),
});

export const createTicketSchema = z.object({
  title: block(FIELD_LIMITS.title.min, FIELD_LIMITS.title.max, "Title").transform((s) => s.replace(/\s+/g, " ")),
  description: block(FIELD_LIMITS.description.min, FIELD_LIMITS.description.max, "Description"),
  category: z.enum(CATEGORY_VALUES, { error: "Choose a category." }),
  priority: z.enum(PRIORITY_VALUES).optional().default("medium"),
  context: clientContextSchema,
  attachments: attachmentList(1),
});
export type CreateTicketInput = z.infer<typeof createTicketSchema>;

export const reporterCommentSchema = z.object({
  message: block(FIELD_LIMITS.comment.min, FIELD_LIMITS.comment.max, "Comment"),
  attachments: attachmentList(0).optional().default([]),
});

export const adminCommentSchema = z.object({
  type: z.enum(ADMIN_COMMENT_TYPES),
  message: block(FIELD_LIMITS.comment.min, FIELD_LIMITS.comment.max, "Comment"),
  attachments: attachmentList(0).optional().default([]),
  /** SuperAdmin ids mentioned with @. Verified against the team list. */
  mentions: z.array(z.string().regex(/^[a-f\d]{24}$/i)).max(10).optional().default([]),
});

export const adminUpdateSchema = z
  .object({
    status: z.enum(STATUS_VALUES).optional(),
    priority: z.enum(PRIORITY_VALUES).optional(),
    /** SuperAdmin id, or null to unassign. */
    assignedTo: z.string().regex(/^[a-f\d]{24}$/i).nullable().optional(),
    resolution: block(0, FIELD_LIMITS.resolution.max, "Resolution").optional(),
    /** Optional note recorded with a status change. */
    note: block(0, FIELD_LIMITS.comment.max, "Note").optional(),
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), "Nothing to update.");

const retentionDays = RETENTION_OPTIONS.map((o) => o.days) as number[];
export const settingsSchema = z.object({
  retentionDays: z.number().refine((d) => retentionDays.includes(d), "Invalid retention period."),
  maxImageMB: z.number().int().min(1).max(50),
  maxVideoMB: z.number().int().min(1).max(500),
});

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  limit: z.coerce.number().int().min(5).max(100).default(20),
  search: line(120).optional().default(""),
  status: z.string().max(400).optional().default(""),
  priority: z.string().max(100).optional().default(""),
  category: z.string().max(400).optional().default(""),
  role: z.string().max(100).optional().default(""),
  schoolId: z.string().regex(/^([a-f\d]{24})?$/i).optional().default(""),
  from: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).optional().default(""),
  to: z.string().regex(/^(\d{4}-\d{2}-\d{2})?$/).optional().default(""),
  sort: z.enum(["createdAt", "lastActivityAt", "priority", "status", "ticketNumber"]).default("createdAt"),
  order: z.enum(["asc", "desc"]).default("desc"),
  archived: z.enum(["", "true", "false"]).optional().default("false"),
});

/** First validation message, for a friendly 400. */
export function firstIssue(error: z.ZodError): string {
  return error.issues[0]?.message || "Invalid request.";
}

/** Splits "a,b,c" filters and keeps only allowed values. */
export function csvFilter<T extends string>(value: string, allowed: readonly T[]): T[] {
  return value
    .split(",")
    .map((v) => v.trim())
    .filter((v): v is T => (allowed as readonly string[]).includes(v));
}

export function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
