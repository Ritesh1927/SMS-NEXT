import mongoose, { Schema, type Document, type Model } from "mongoose";

export type ConcessionType = "Sibling" | "Merit" | "SC/ST" | "Staff Ward" | "Custom";
export type ConcessionDuration = "recurring" | "one-time" | "until-date";

export interface IConcession extends Document {
  school: mongoose.Types.ObjectId;
  student: mongoose.Types.ObjectId;
  feeStructure: mongoose.Types.ObjectId | null;
  type: ConcessionType;
  value: number;
  isPct: boolean;
  description: string;
  duration: ConcessionDuration;
  validUntil: Date | null;
  appliedMonths: string[];
}

const concessionSchema = new Schema<IConcession>(
  {
    school: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    feeStructure: { type: Schema.Types.ObjectId, ref: "FeeStructure", default: null },
    type: { type: String, enum: ["Sibling", "Merit", "SC/ST", "Staff Ward", "Custom"], default: "Custom" },
    value: { type: Number, required: true, min: 0 },
    isPct: { type: Boolean, default: true },
    description: { type: String, default: "" },
    duration: { type: String, enum: ["recurring", "one-time", "until-date"], default: "recurring" },
    validUntil: { type: Date, default: null },
    appliedMonths: { type: [String], default: [] },
  },
  { timestamps: true },
);

export const Concession: Model<IConcession> =
  mongoose.models.Concession || mongoose.model<IConcession>("Concession", concessionSchema);
