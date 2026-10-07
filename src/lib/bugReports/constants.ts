// Bug reporting / ticketing vocabulary shared by the client UI, the API
// routes and the Mongoose model. Client-safe: no server imports here.

export const TICKET_CATEGORIES = [
  { value: "ui_issue", label: "UI Issue" },
  { value: "functionality", label: "Functionality" },
  { value: "login", label: "Login" },
  { value: "performance", label: "Performance" },
  { value: "payment", label: "Payment" },
  { value: "attendance", label: "Attendance" },
  { value: "result", label: "Result" },
  { value: "timetable", label: "Timetable" },
  { value: "dashboard", label: "Dashboard" },
  { value: "reports", label: "Reports" },
  { value: "notification", label: "Notification" },
  { value: "mobile_issue", label: "Mobile Issue" },
  { value: "desktop_issue", label: "Desktop Issue" },
  { value: "feature_request", label: "Feature Request" },
  { value: "other", label: "Other" },
] as const;
export type TicketCategory = (typeof TICKET_CATEGORIES)[number]["value"];
export const CATEGORY_VALUES = TICKET_CATEGORIES.map((c) => c.value) as [TicketCategory, ...TicketCategory[]];

export const TICKET_PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
  { value: "critical", label: "Critical" },
] as const;
export type TicketPriority = (typeof TICKET_PRIORITIES)[number]["value"];
export const PRIORITY_VALUES = TICKET_PRIORITIES.map((p) => p.value) as [TicketPriority, ...TicketPriority[]];

/**
 * The workflow, kept deliberately short. Each status has its own colour
 * (see TicketBadges). `terminal` statuses start the retention clock
 * (`closedAt`) and are what auto-archiving looks at.
 */
export const TICKET_STATUSES = [
  // Active -- the ticket still needs work.
  { value: "open", label: "Open", group: "open", phase: "active", description: "New ticket, not started yet" },
  { value: "in_progress", label: "In Progress", group: "in_progress", phase: "active", description: "Being worked on" },
  { value: "waiting_for_information", label: "Waiting for Info", group: "waiting", phase: "active", description: "Needs details or files from the reporter" },
  { value: "reopened", label: "Reopened", group: "reopened", phase: "active", description: "Came back after being resolved" },
  // Completed -- no further work planned.
  { value: "resolved", label: "Resolved", group: "resolved", phase: "completed", description: "Fixed", terminal: true },
  { value: "closed", label: "Closed", group: "closed", phase: "completed", description: "Done, no further action", terminal: true },
  { value: "rejected", label: "Rejected", group: "rejected", phase: "completed", description: "Not a bug, duplicate or can't be reproduced", terminal: true },
] as const;

/** Headings for the status dropdown, in workflow order. */
export const STATUS_PHASES = [
  { key: "active", label: "Active" },
  { key: "completed", label: "Completed" },
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number]["value"];
export type TicketStatusGroup = (typeof TICKET_STATUSES)[number]["group"];
export const STATUS_VALUES = TICKET_STATUSES.map((s) => s.value) as [TicketStatus, ...TicketStatus[]];
export const TERMINAL_STATUSES: TicketStatus[] = TICKET_STATUSES.filter((s) => "terminal" in s).map((s) => s.value);
/** Statuses in which the reporter is asked to upload more files. */
export const AWAITING_REPORTER_STATUSES: TicketStatus[] = ["waiting_for_information"];
/** Solved = shows up in the Solved Tickets Archive / duplicate search. */
export const SOLVED_STATUSES: TicketStatus[] = ["resolved", "closed"];

/**
 * The earlier 19-status workflow, mapped onto the current one. Used by the
 * one-time data migration (service.ts -> migrateLegacyStatuses) and as a
 * read-side fallback so an old value never renders unlabelled.
 */
export const LEGACY_STATUS_MAP: Record<string, TicketStatus> = {
  new: "open",
  acknowledged: "open",
  assigned: "in_progress",
  investigation: "in_progress",
  bug_confirmed: "in_progress",
  testing: "in_progress",
  qa_verification: "in_progress",
  ready_for_release: "in_progress",
  waiting_for_customer: "waiting_for_information",
  on_hold: "waiting_for_information",
  duplicate: "rejected",
  cannot_reproduce: "rejected",
};

/** Current status for any stored value, including legacy ones. */
export const normalizeStatus = (status: string): string => LEGACY_STATUS_MAP[status] ?? status;

export const REPORTER_ROLES = ["superadmin", "schooladmin", "teacher", "student", "parent"] as const;
export type ReporterRole = (typeof REPORTER_ROLES)[number];

export const ROLE_LABELS: Record<string, string> = {
  superadmin: "System Administrator",
  schooladmin: "School Admin",
  teacher: "Teacher",
  student: "Student",
  parent: "Parent",
};

/** Timeline entry kinds. Internal ones are never sent to the reporter. */
export const TIMELINE_TYPES = [
  "created",
  "status_change",
  "priority_change",
  "assignment",
  "reply",
  "reporter_comment",
  "internal_note",
  "developer_note",
  "resolution",
  "archived",
  "unarchived",
] as const;
export type TimelineType = (typeof TIMELINE_TYPES)[number];
export const INTERNAL_TIMELINE_TYPES: TimelineType[] = ["internal_note", "developer_note", "assignment", "archived", "unarchived"];

/** Comment kinds a super admin can post. */
export const ADMIN_COMMENT_TYPES = ["reply", "internal_note", "developer_note"] as const;
export type AdminCommentType = (typeof ADMIN_COMMENT_TYPES)[number];

export const RETENTION_OPTIONS = [
  { days: 7, label: "7 days" },
  { days: 15, label: "15 days" },
  { days: 30, label: "30 days" },
  { days: 60, label: "60 days" },
  { days: 90, label: "90 days" },
  { days: 180, label: "180 days" },
  { days: 0, label: "Never" },
] as const;

export const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp"] as const;
export const VIDEO_EXTENSIONS = ["mp4", "mov", "webm"] as const;
export type AttachmentKind = "image" | "video";

/** Defaults; super admins can change the size limits in Ticket Settings. */
export const DEFAULT_MAX_IMAGE_MB = 10;
export const DEFAULT_MAX_VIDEO_MB = 100;
export const MAX_ATTACHMENTS_PER_UPLOAD = 6;

export const FIELD_LIMITS = {
  title: { min: 5, max: 150 },
  description: { min: 15, max: 5000 },
  comment: { min: 1, max: 3000 },
  resolution: { max: 2000 },
} as const;

export const labelOf = <T extends { value: string; label: string }>(list: readonly T[], value: string) =>
  list.find((item) => item.value === value)?.label ?? value;

export const statusLabel = (status: string) => labelOf(TICKET_STATUSES, normalizeStatus(status));
export const priorityLabel = (priority: string) => labelOf(TICKET_PRIORITIES, priority);
export const categoryLabel = (category: string) => labelOf(TICKET_CATEGORIES, category);
export const statusGroup = (status: string): TicketStatusGroup =>
  TICKET_STATUSES.find((s) => s.value === normalizeStatus(status))?.group ?? "open";

export function extensionOf(filename: string): string {
  const dot = filename.lastIndexOf(".");
  return dot >= 0 ? filename.slice(dot + 1).toLowerCase() : "";
}

export function attachmentKindOf(filename: string): AttachmentKind | null {
  const ext = extensionOf(filename);
  if ((IMAGE_EXTENSIONS as readonly string[]).includes(ext)) return "image";
  if ((VIDEO_EXTENSIONS as readonly string[]).includes(ext)) return "video";
  return null;
}
