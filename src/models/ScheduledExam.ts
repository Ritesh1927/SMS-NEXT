import mongoose, { Schema, type Document, type Model } from "mongoose";

export type ScheduledExamType = "midterm" | "final" | "unit" | "annual";
export type ScheduledExamStatus = "upcoming" | "ongoing" | "completed" | "cancelled";

// A multi-subject, multi-day exam term (e.g. "Mid-Term Exams" spanning six
// subjects over a week) — matches SMS-BACKEND's ScheduledExam. Each subject
// "slot" is a normal Exam document with scheduledExamId set to this term's
// _id, rather than a separate ExamSubject model, so marks entry/results/
// publish reuse the existing single-exam routes unchanged.
export interface IScheduledExam extends Document {
  school: mongoose.Types.ObjectId;
  title: string;
  class: string;
  section: string;
  examType: ScheduledExamType;
  startDate: Date;
  endDate: Date;
  description: string;
  status: ScheduledExamStatus;
  createdBy: mongoose.Types.ObjectId;
  createdByModel: "Teacher" | "Admin";
}

const scheduledExamSchema = new Schema<IScheduledExam>(
  {
    school: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    title: { type: String, required: true, trim: true },
    class: { type: String, required: true },
    section: { type: String, default: "" },
    examType: { type: String, enum: ["midterm", "final", "unit", "annual"], required: true },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    description: { type: String, default: "" },
    status: { type: String, enum: ["upcoming", "ongoing", "completed", "cancelled"], default: "upcoming" },
    createdBy: { type: Schema.Types.ObjectId, required: true, refPath: "createdByModel" },
    createdByModel: { type: String, enum: ["Teacher", "Admin"], default: "Teacher" },
  },
  { timestamps: true },
);

export const ScheduledExam: Model<IScheduledExam> =
  mongoose.models.ScheduledExam || mongoose.model<IScheduledExam>("ScheduledExam", scheduledExamSchema);
