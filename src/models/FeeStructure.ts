import mongoose, { Schema, type Document, type Model } from "mongoose";

export type FeeFrequency = "monthly" | "quarterly" | "yearly" | "one-time";

export interface IFeeStructure extends Document {
  school: mongoose.Types.ObjectId;
  class: string;
  title: string;
  amount: number;
  dueDate: Date;
  frequency: FeeFrequency;
  description: string;
  academicYear: string;
  isActive: boolean;
}

const feeStructureSchema = new Schema<IFeeStructure>(
  {
    school: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    class: { type: String, required: true },
    title: { type: String, required: true },
    amount: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    frequency: { type: String, enum: ["monthly", "quarterly", "yearly", "one-time"], default: "monthly" },
    description: { type: String, default: "" },
    academicYear: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const FeeStructure: Model<IFeeStructure> =
  mongoose.models.FeeStructure || mongoose.model<IFeeStructure>("FeeStructure", feeStructureSchema);
