import mongoose, { Schema, type Document, type Model } from "mongoose";
import {
  CATEGORY_VALUES, PRIORITY_VALUES, REPORTER_ROLES, STATUS_VALUES, TIMELINE_TYPES, normalizeStatus,
  type AttachmentKind, type ReporterRole, type TicketCategory, type TicketPriority, type TicketStatus, type TimelineType,
} from "@/lib/bugReports/constants";

// One support ticket per bug report. Reporter identity and the technical
// context are SNAPSHOTS taken at submission (resolved server-side from the
// JWT, never from the client), so a ticket stays accurate even if the user
// is later renamed, moved or deleted. The timeline is embedded: tickets
// see tens of updates, not thousands, and the detail view always needs it.

export interface ITicketAttachment {
  url: string;
  publicId: string;
  kind: AttachmentKind;
  format: string;
  name: string;
  bytes: number;
  width?: number;
  height?: number;
  duration?: number;
  uploadedByRole: ReporterRole;
  uploadedAt: Date;
}

export interface ITimelineEntry {
  _id: mongoose.Types.ObjectId;
  type: TimelineType;
  /** "internal" entries are never returned to the reporter. */
  visibility: "public" | "internal";
  actorRole: ReporterRole | "system";
  actorId: string;
  actorName: string;
  message: string;
  from?: string;
  to?: string;
  mentions: string[];
  attachments: ITicketAttachment[];
  createdAt: Date;
}

export interface ITicketReporter {
  userId: string;
  role: ReporterRole;
  name: string;
  /** Not displayed on the ticket; used to email the reporter about updates. */
  email: string;
  /** Teacher ID (TCH-2026-0004) or Student ID; empty for other roles. */
  userCode: string;
  schoolId: string;
  schoolName: string;
}

export interface ITicketContext {
  pageUrl: string;
  route: string;
  module: string;
  pageName: string;
  browser: string;
  os: string;
  deviceType: string;
  screenResolution: string;
  viewport: string;
  timeZone: string;
  language: string;
  appVersion: string;
  clientTime: string;
  userAgent: string;
  ipAddress: string;
  sessionId: string;
  standalone: boolean;
}

export interface IBugTicket extends Document {
  ticketNumber: string;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  /** 4 = critical ... 1 = low; derived from priority, used for sorting. */
  priorityRank: number;
  status: TicketStatus;
  reporter: ITicketReporter;
  context: ITicketContext;
  attachments: ITicketAttachment[];
  assignedTo: { id: string; name: string } | null;
  resolution: string;
  resolvedAt: Date | null;
  resolvedBy: string;
  /** Set when the ticket enters a terminal status; drives retention. */
  closedAt: Date | null;
  isArchived: boolean;
  archivedAt: Date | null;
  timeline: ITimelineEntry[];
  /** Unread flags power the in-app badges on both sides. */
  adminUnread: boolean;
  reporterUnread: boolean;
  lastActivityAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const attachmentSchema = new Schema<ITicketAttachment>(
  {
    url: { type: String, required: true },
    publicId: { type: String, required: true },
    kind: { type: String, enum: ["image", "video"], required: true },
    format: { type: String, default: "" },
    name: { type: String, default: "" },
    bytes: { type: Number, default: 0 },
    width: Number,
    height: Number,
    duration: Number,
    uploadedByRole: { type: String, enum: REPORTER_ROLES, required: true },
    uploadedAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const timelineSchema = new Schema<ITimelineEntry>({
  type: { type: String, enum: TIMELINE_TYPES, required: true },
  visibility: { type: String, enum: ["public", "internal"], default: "public" },
  actorRole: { type: String, enum: [...REPORTER_ROLES, "system"], required: true },
  actorId: { type: String, default: "" },
  actorName: { type: String, default: "" },
  message: { type: String, default: "" },
  from: String,
  to: String,
  mentions: { type: [String], default: [] },
  attachments: { type: [attachmentSchema], default: [] },
  createdAt: { type: Date, default: Date.now },
});

const reporterSchema = new Schema<ITicketReporter>(
  {
    userId: { type: String, required: true },
    role: { type: String, enum: REPORTER_ROLES, required: true },
    name: { type: String, default: "" },
    email: { type: String, default: "" },
    userCode: { type: String, default: "" },
    schoolId: { type: String, default: "" },
    schoolName: { type: String, default: "" },
  },
  { _id: false },
);

const contextSchema = new Schema<ITicketContext>(
  {
    pageUrl: { type: String, default: "" },
    route: { type: String, default: "" },
    module: { type: String, default: "" },
    pageName: { type: String, default: "" },
    browser: { type: String, default: "" },
    os: { type: String, default: "" },
    deviceType: { type: String, default: "" },
    screenResolution: { type: String, default: "" },
    viewport: { type: String, default: "" },
    timeZone: { type: String, default: "" },
    language: { type: String, default: "" },
    appVersion: { type: String, default: "" },
    clientTime: { type: String, default: "" },
    userAgent: { type: String, default: "" },
    ipAddress: { type: String, default: "" },
    sessionId: { type: String, default: "" },
    standalone: { type: Boolean, default: false },
  },
  { _id: false },
);

const bugTicketSchema = new Schema<IBugTicket>(
  {
    ticketNumber: { type: String, required: true, unique: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, required: true },
    category: { type: String, enum: CATEGORY_VALUES, required: true },
    priority: { type: String, enum: PRIORITY_VALUES, default: "medium" },
    priorityRank: { type: Number, default: 2 },
    status: { type: String, enum: STATUS_VALUES, default: "open" },
    reporter: { type: reporterSchema, required: true },
    context: { type: contextSchema, default: () => ({}) },
    attachments: { type: [attachmentSchema], default: [] },
    assignedTo: { type: new Schema({ id: String, name: String }, { _id: false }), default: null },
    resolution: { type: String, default: "" },
    resolvedAt: { type: Date, default: null },
    resolvedBy: { type: String, default: "" },
    closedAt: { type: Date, default: null },
    isArchived: { type: Boolean, default: false },
    archivedAt: { type: Date, default: null },
    timeline: { type: [timelineSchema], default: [] },
    adminUnread: { type: Boolean, default: true },
    reporterUnread: { type: Boolean, default: false },
    lastActivityAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

const PRIORITY_RANK: Record<TicketPriority, number> = { low: 1, medium: 2, high: 3, critical: 4 };
bugTicketSchema.pre("validate", function () {
  this.priorityRank = PRIORITY_RANK[this.priority] ?? 2;
  // Safety net for documents saved before the status migration ran.
  this.status = normalizeStatus(this.status) as TicketStatus;
});

// Super Admin list: filters by status/priority/school/role, newest first.
bugTicketSchema.index({ isArchived: 1, status: 1, createdAt: -1 });
bugTicketSchema.index({ isArchived: 1, priority: 1, createdAt: -1 });
bugTicketSchema.index({ "reporter.schoolId": 1, createdAt: -1 });
// "My Reported Bugs": a user's own tickets.
bugTicketSchema.index({ "reporter.userId": 1, "reporter.role": 1, lastActivityAt: -1 });
// Retention sweep: terminal tickets closed before a cutoff.
bugTicketSchema.index({ isArchived: 1, closedAt: 1 });
bugTicketSchema.index({ adminUnread: 1 });
// Free-text search (list search, duplicate search, archive).
bugTicketSchema.index(
  { title: "text", description: "text", resolution: "text", ticketNumber: "text" },
  { weights: { title: 10, ticketNumber: 10, resolution: 5, description: 2 }, name: "ticket_text" },
);

export const BugTicket: Model<IBugTicket> =
  mongoose.models.BugTicket || mongoose.model<IBugTicket>("BugTicket", bugTicketSchema);
