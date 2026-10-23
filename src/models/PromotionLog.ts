import mongoose, { Schema, type Document, type Model } from "mongoose";

// Audit record for one promotion batch (one class+section promoted/graduated
// together). Hard deletes elsewhere in the year-switch feature mean this is
// the only place an admin can see what happened after the fact -- cheap
// insurance against a batch promotion going wrong with no way to inspect it.
interface IPromotionLogEntry {
  student: mongoose.Types.ObjectId;
  name: string;
  fromRollNumber: string;
  toRollNumber: string;
}

interface IPromotionLogExcluded {
  student: mongoose.Types.ObjectId;
  name: string;
  reason: string;
}

export interface IPromotionLog extends Document {
  school: mongoose.Types.ObjectId;
  academicYearEnding: string;
  fromClass: string;
  fromSection: string;
  toClass: string;
  toSection: string;
  graduated: boolean;
  promotedBy: mongoose.Types.ObjectId;
  promotedByModel: "Admin" | "Teacher";
  studentsPromoted: IPromotionLogEntry[];
  studentsExcluded: IPromotionLogExcluded[];
}

const promotionLogEntrySchema = new Schema<IPromotionLogEntry>(
  {
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    name: { type: String, required: true },
    fromRollNumber: { type: String, default: "" },
    toRollNumber: { type: String, default: "" },
  },
  { _id: false },
);

const promotionLogExcludedSchema = new Schema<IPromotionLogExcluded>(
  {
    student: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    name: { type: String, required: true },
    reason: { type: String, default: "" },
  },
  { _id: false },
);

const promotionLogSchema = new Schema<IPromotionLog>(
  {
    school: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    academicYearEnding: { type: String, required: true },
    fromClass: { type: String, required: true },
    fromSection: { type: String, default: "" },
    toClass: { type: String, default: "" },
    toSection: { type: String, default: "" },
    graduated: { type: Boolean, default: false },
    promotedBy: { type: Schema.Types.ObjectId, required: true, refPath: "promotedByModel" },
    promotedByModel: { type: String, enum: ["Admin", "Teacher"], default: "Teacher" },
    studentsPromoted: { type: [promotionLogEntrySchema], default: [] },
    studentsExcluded: { type: [promotionLogExcludedSchema], default: [] },
  },
  { timestamps: true },
);

export const PromotionLog: Model<IPromotionLog> =
  mongoose.models.PromotionLog || mongoose.model<IPromotionLog>("PromotionLog", promotionLogSchema);
