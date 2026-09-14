import mongoose, { Schema, type Document, type Model } from "mongoose";

export type Weekday = "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday";
export const WEEKDAYS: Weekday[] = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export interface ITimetableEntry extends Document {
  school: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  teacherId: mongoose.Types.ObjectId | null;
  day: Weekday;
  periodNumber: number;
  subject: string;
  startTime: string;
  endTime: string;
}

const timetableEntrySchema = new Schema<ITimetableEntry>(
  {
    school: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    classId: { type: Schema.Types.ObjectId, ref: "Class", required: true },
    teacherId: { type: Schema.Types.ObjectId, ref: "Teacher", default: null },
    day: { type: String, enum: WEEKDAYS, required: true },
    periodNumber: { type: Number, min: 1, required: true },
    subject: { type: String, required: true, trim: true },
    startTime: { type: String, default: "" },
    endTime: { type: String, default: "" },
  },
  { timestamps: true },
);

// One entry per class + day + period.
timetableEntrySchema.index({ school: 1, classId: 1, day: 1, periodNumber: 1 }, { unique: true });
// A teacher can't be in two classes during the same period — matches
// SMS-BACKEND's own unique+sparse index (sparse so null teacherId is fine).
timetableEntrySchema.index({ school: 1, teacherId: 1, day: 1, periodNumber: 1 }, { unique: true, sparse: true });

export const TimetableEntry: Model<ITimetableEntry> =
  mongoose.models.TimetableEntry || mongoose.model<ITimetableEntry>("TimetableEntry", timetableEntrySchema);
