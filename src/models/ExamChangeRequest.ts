import mongoose, { Schema, type Document, type Model } from "mongoose";

export type ExamChangeSourceType = "exam" | "scheduledExam";
export type ExamChangeStatus = "pending" | "approved" | "rejected";

// A teacher's request to edit an exam/exam-term that's within its 2-hour
// pre-start edit lock — an admin must approve (which applies the change) or
// reject it. Matches SMS-BACKEND's ExamChangeRequest; sourceType "exam"
// covers both standalone exams and individual subject-slots of a
// ScheduledExam term, since both are just Exam documents here.
export interface IExamChangeRequest extends Document {
  school: mongoose.Types.ObjectId;
  sourceType: ExamChangeSourceType;
  examId: mongoose.Types.ObjectId | null;
  scheduledExamId: mongoose.Types.ObjectId | null;
  requestedBy: mongoose.Types.ObjectId;
  reason: string;
  currentData: Record<string, unknown>;
  requestedChanges: Record<string, unknown>;
  status: ExamChangeStatus;
  adminReply: string;
  reviewedBy: mongoose.Types.ObjectId | null;
  reviewedAt: Date | null;
}

const examChangeRequestSchema = new Schema<IExamChangeRequest>(
  {
    school: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    sourceType: { type: String, enum: ["exam", "scheduledExam"], required: true },
    examId: { type: Schema.Types.ObjectId, ref: "Exam", default: null },
    scheduledExamId: { type: Schema.Types.ObjectId, ref: "ScheduledExam", default: null },
    requestedBy: { type: Schema.Types.ObjectId, ref: "Teacher", required: true },
    reason: { type: String, required: true, trim: true },
    currentData: { type: Schema.Types.Mixed, required: true },
    requestedChanges: { type: Schema.Types.Mixed, required: true },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    adminReply: { type: String, default: "" },
    reviewedBy: { type: Schema.Types.ObjectId, ref: "Admin", default: null },
    reviewedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

examChangeRequestSchema.index({ school: 1, status: 1 });

export const ExamChangeRequest: Model<IExamChangeRequest> =
  mongoose.models.ExamChangeRequest || mongoose.model<IExamChangeRequest>("ExamChangeRequest", examChangeRequestSchema);
