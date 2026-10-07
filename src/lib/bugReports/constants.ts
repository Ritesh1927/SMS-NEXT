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
 * Full workflow. `group` buckets statuses for the dashboard cards and the
 * badge colour; `terminal` statuses stop the retention clock running from
 * `closedAt` and are what auto-archiving looks at.
 */
export const TICKET_STATUSES = [
  { value: "new", label: "New", group: "open" },
  { value: "open", label: "Open", group: "open" },
  { value: "acknowledged", label: "Acknowledged", group: "open" },
  { value: "assigned", label: "Assigned", group: "assigned" },
  { value: "investigation", label: "Investigation", group: "in_progress" },
  { value: "in_progress", label: "In Progress", group: "in_progress" },
  { value: "waiting_for_information", label: "Waiting for Information", group: "waiting" },
  { value: "waiting_for_customer", label: "Waiting for Customer", group: "waiting" },
  { value: "bug_confirmed", label: "Bug Confirmed", group: "in_progress" },
  { value: "testing", label: "Testing", group: "testing" },
  { value: "qa_verification", label: "QA Verification", group: "testing" },
  { value: "ready_for_release", label: "Ready for Release", group: "testing" },
  { value: "resolved", label: "Resolved", group: "resolved", terminal: true },
  { value: "closed", label: "Closed", group: "closed", terminal: true },
  { value: "rejected", label: "Rejected", group: "rejected", terminal: true },
  { value: "duplicate", label: "Duplicate", group: "rejected", terminal: true },
  { value: "cannot_reproduce", label: "Cannot Reproduce", group: "rejected", terminal: true },
  { value: "on_hold", label: "On Hold", group: "waiting" },
  { value: "reopened", label: "Reopened", group: "reopened" },
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number]["value"];
export type TicketStatusGroup = (typeof TICKET_STATUSES)[number]["group"];
export const STATUS_VALUES = TICKET_STATUSES.map((s) => s.value) as [TicketStatus, ...TicketStatus[]];
export const TERMINAL_STATUSES: TicketStatus[] = TICKET_STATUSES.filter((s) => "terminal" in s).map((s) => s.value);
/** Statuses in which the reporter is asked to upload more files. */
export const AWAITING_REPORTER_STATUSES: TicketStatus[] = ["waiting_for_information", "waiting_for_customer"];
/** Solved = shows up in the Solved Tickets Archive / duplicate search. */
export const SOLVED_STATUSES: TicketStatus[] = ["resolved", "closed"];

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

export const statusLabel = (status: string) => labelOf(TICKET_STATUSES, status);
export const priorityLabel = (priority: string) => labelOf(TICKET_PRIORITIES, priority);
export const categoryLabel = (category: string) => labelOf(TICKET_CATEGORIES, category);
export const statusGroup = (status: string): TicketStatusGroup =>
  TICKET_STATUSES.find((s) => s.value === status)?.group ?? "open";

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
