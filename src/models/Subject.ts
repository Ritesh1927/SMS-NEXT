import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface ISubject extends Document {
  school: mongoose.Types.ObjectId;
  name: string;
  code: string;
  description: string;
}

const subjectSchema = new Schema<ISubject>(
  {
    school: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, uppercase: true, trim: true },
    description: { type: String, default: "" },
  },
  { timestamps: true },
);

subjectSchema.index({ school: 1, code: 1 }, { unique: true });

export const Subject: Model<ISubject> = mongoose.models.Subject || mongoose.model<ISubject>("Subject", subjectSchema);
