import mongoose, { Schema, type Document, type Model } from "mongoose";

export type ExamType = "unit-test" | "mid-term" | "final" | "practical" | "assignment";
export type ExamStatus = "upcoming" | "ongoing" | "completed" | "cancelled";

export interface IExam extends Document {
  school: mongoose.Types.ObjectId;
  title: string;
  class: string;
  section: string;
  subject: string;
  date: Date;
  startTime: string;
  endTime: string;
  totalMarks: number;
  passingMarks: number;
  examType: ExamType;
  createdBy: mongoose.Types.ObjectId;
  instructions: string;
  status: ExamStatus;
}

const examSchema = new Schema<IExam>(
  {
    school: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    title: { type: String, required: true },
    class: { type: String, required: true },
    section: { type: String, default: "" },
    subject: { type: String, required: true },
    date: { type: Date, required: true },
    startTime: { type: String, default: "" },
    endTime: { type: String, default: "" },
    totalMarks: { type: Number, required: true },
    passingMarks: { type: Number, required: true },
    examType: { type: String, enum: ["unit-test", "mid-term", "final", "practical", "assignment"], default: "unit-test" },
    createdBy: { type: Schema.Types.ObjectId, required: true },
    instructions: { type: String, default: "" },
    status: { type: String, enum: ["upcoming", "ongoing", "completed", "cancelled"], default: "upcoming" },
  },
  { timestamps: true },
);

export const Exam: Model<IExam> = mongoose.models.Exam || mongoose.model<IExam>("Exam", examSchema);
