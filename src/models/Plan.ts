import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IPlan extends Document {
  name: string;
  pricePerUser: number;
  includedUsers: number;
  features: string[];
  isActive: boolean;
}

const planSchema = new Schema<IPlan>(
  {
    name: { type: String, required: true, unique: true, trim: true },
    pricePerUser: { type: Number, required: true, min: 0 },
    includedUsers: { type: Number, required: true, min: 1, default: 2 },
    features: { type: [String], default: [] },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const Plan: Model<IPlan> = mongoose.models.Plan || mongoose.model<IPlan>("Plan", planSchema);
