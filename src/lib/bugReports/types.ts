// JSON shapes returned by the ticket APIs (dates arrive as ISO strings).
import type { AttachmentKind, ReporterRole, TicketCategory, TicketPriority, TicketStatus, TimelineType } from "./constants";

export interface AttachmentDTO {
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
  uploadedAt: string;
}

export interface TimelineEntryDTO {
  _id: string;
  type: TimelineType;
  visibility: "public" | "internal";
  actorRole: ReporterRole | "system";
  actorName: string;
  message: string;
  from?: string;
  to?: string;
  mentions?: string[];
  attachments: AttachmentDTO[];
  createdAt: string;
}

export interface ReporterDTO {
  userId: string;
  role: ReporterRole;
  name: string;
  email: string;
  /** Teacher ID or Student ID; empty for other roles. */
  userCode: string;
  schoolId: string;
  schoolName: string;
}

export interface ContextDTO {
  pageUrl: string;
  route?: string;
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
  userAgent?: string;
  ipAddress?: string;
  sessionId?: string;
  standalone: boolean;
}

interface TicketBase {
  _id: string;
  ticketNumber: string;
  title: string;
  status: TicketStatus;
  priority: TicketPriority;
  category: TicketCategory;
  createdAt: string;
  lastActivityAt: string;
  isArchived: boolean;
}

/** Row in "My Reported Bugs". */
export interface MyTicketRow extends TicketBase {
  reporterUnread: boolean;
}

/** Reporter-facing detail (no internal notes). */
export interface ReporterTicketDTO extends TicketBase {
  description: string;
  resolution: string;
  resolvedAt: string | null;
  reporter: ReporterDTO;
  context: ContextDTO;
  attachments: AttachmentDTO[];
  reporterUnread: boolean;
  updatedAt: string;
  timeline: TimelineEntryDTO[];
}

/** Row in the Super Admin table. */
export interface AdminTicketRow extends TicketBase {
  updatedAt: string;
  assignedTo: { id: string; name: string } | null;
  adminUnread: boolean;
  attachments: { kind: AttachmentKind }[];
  reporter: Pick<ReporterDTO, "name" | "role" | "email" | "schoolName" | "schoolId">;
}

/** Super Admin detail (everything). */
export interface AdminTicketDTO extends Omit<ReporterTicketDTO, "reporterUnread"> {
  assignedTo: { id: string; name: string } | null;
  resolvedBy: string;
  closedAt: string | null;
  archivedAt: string | null;
  adminUnread: boolean;
  reporterUnread: boolean;
}

export interface Paginated<T> {
  data: T[];
  pagination: { page: number; limit: number; total: number; pages: number };
}

export interface TicketConfig {
  maxImageMB: number;
  maxVideoMB: number;
  appVersion: string;
  uploadsEnabled: boolean;
}

export interface SimilarTicket {
  _id: string;
  ticketNumber: string;
  title: string;
  category: TicketCategory;
  resolution: string;
  resolvedAt: string | null;
}

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  isMe: boolean;
}
