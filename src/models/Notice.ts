import mongoose, { Schema, type Document, type Model } from "mongoose";

export type NoticeCategory = "general" | "exam" | "fee" | "holiday" | "event" | "urgent" | "other";
export type NoticeTargetRole = "all" | "teacher" | "student" | "parent";
// "" = no class restriction (student/parent/teacher visibility isn't narrowed
// by class). Set only when targetRoles includes "student" -- see
// Design note in /api/notices/route.ts for how targetClasses is resolved.
export type NoticeClassScope = "" | "primary" | "middle" | "high" | "custom";

export interface INoticeExamScheduleRow {
  subject: string;
  date: string;
  startTime: string;
  endTime: string;
}

// Carried on a notice auto-posted when a Test/Exam is created, purely so
// the notice can render/export a formal schedule sheet on demand (see
// buildExamSchedulePdf) instead of storing a generated file somewhere.
export interface INoticeExamSchedule {
  examName: string;
  startDate: string;
  endDate: string;
  guidelines: string[];
  rows: INoticeExamScheduleRow[];
}

export interface INotice extends Document {
  school: mongoose.Types.ObjectId;
  title: string;
  content: string;
  category: NoticeCategory;
  targetRoles: NoticeTargetRole[];
  classScope: NoticeClassScope;
  targetClasses: string[];
  examSchedule: INoticeExamSchedule | null;
  postedBy: mongoose.Types.ObjectId;
  postedByModel: "Admin" | "Teacher";
  isUrgent: boolean;
  isPinned: boolean;
  expiryDate: Date | null;
  views: number;
}

const examScheduleRowSchema = new Schema<INoticeExamScheduleRow>(
  {
    subject: { type: String, required: true },
    date: { type: String, required: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
  },
  { _id: false },
);

const examScheduleSchema = new Schema<INoticeExamSchedule>(
  {
    examName: { type: String, required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    guidelines: { type: [String], default: [] },
    rows: { type: [examScheduleRowSchema], default: [] },
  },
  { _id: false },
);

const noticeSchema = new Schema<INotice>(
  {
    school: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    category: { type: String, enum: ["general", "exam", "fee", "holiday", "event", "urgent", "other"], default: "general" },
    targetRoles: { type: [String], enum: ["all", "teacher", "student", "parent"], default: ["all"] },
    // Resolved list of Class.name values (standards) this notice is scoped
    // to when targetRoles includes "student" -- empty means every student
    // (and so every parent/teacher of the "student" concern). classScope
    // records which picker produced the list, purely so the edit form can
    // reopen on the same choice instead of guessing from targetClasses.
    classScope: { type: String, enum: ["", "primary", "middle", "high", "custom"], default: "" },
    targetClasses: { type: [String], default: [] },
    examSchedule: { type: examScheduleSchema, default: null },
    postedBy: { type: Schema.Types.ObjectId, required: true, refPath: "postedByModel" },
    postedByModel: { type: String, enum: ["Admin", "Teacher"], required: true },
    isUrgent: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false },
    expiryDate: { type: Date, default: null },
    views: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Notice: Model<INotice> = mongoose.models.Notice || mongoose.model<INotice>("Notice", noticeSchema);
