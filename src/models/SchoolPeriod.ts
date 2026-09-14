import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface ISchoolPeriod extends Document {
  school: mongoose.Types.ObjectId;
  label: string;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  periodNumber: number | null;
  order: number;
}

const schoolPeriodSchema = new Schema<ISchoolPeriod>(
  {
    school: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    label: { type: String, required: true, trim: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    isBreak: { type: Boolean, default: false },
    periodNumber: { type: Number, default: null },
    order: { type: Number, required: true },
  },
  { timestamps: true },
);

schoolPeriodSchema.index({ school: 1, order: 1 });

export const SchoolPeriod: Model<ISchoolPeriod> =
  mongoose.models.SchoolPeriod || mongoose.model<ISchoolPeriod>("SchoolPeriod", schoolPeriodSchema);
