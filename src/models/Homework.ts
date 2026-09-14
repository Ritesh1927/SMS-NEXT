import mongoose, { Schema, type Document, type Model } from "mongoose";

export type SubmissionStatus = "submitted" | "late" | "graded";

interface ISubmission {
  student: mongoose.Types.ObjectId;
  submittedAt: Date;
  note: string;
  status: SubmissionStatus;
  marks: number | null;
  feedback: string;
}

export interface IHomework extends Document {
  school: mongoose.Types.ObjectId;
  title: string;
  description: string;
  subject: string;
  class: string;
  section: string;
  dueDate: Date;
  assignedBy: mongoose.Types.ObjectId;
  assignedByModel: "Teacher" | "Admin";
  submissions: mongoose.Types.DocumentArray<ISubmission>;
  maxMarks: number | null;
  isActive: boolean;
}

const submissionSchema = new Schema<ISubmission>(
  {
    student: { type: Schema.Types.ObjectId, ref: "Student" },
    submittedAt: { type: Date, default: Date.now },
    note: { type: String, default: "" },
    status: { type: String, enum: ["submitted", "late", "graded"], default: "submitted" },
    marks: { type: Number, default: null },
    feedback: { type: String, default: "" },
  },
  { _id: false },
);

const homeworkSchema = new Schema<IHomework>(
  {
    school: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    title: { type: String, required: true },
    description: { type: String, required: true },
    subject: { type: String, required: true },
    class: { type: String, required: true },
    section: { type: String, default: "" },
    dueDate: { type: Date, required: true },
    assignedBy: { type: Schema.Types.ObjectId, refPath: "assignedByModel" },
    assignedByModel: { type: String, enum: ["Teacher", "Admin"], default: "Teacher" },
    submissions: [submissionSchema],
    maxMarks: { type: Number, default: null },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Homework: Model<IHomework> = mongoose.models.Homework || mongoose.model<IHomework>("Homework", homeworkSchema);
