import mongoose, { Schema, type Document, type Model } from "mongoose";

// One row per student per past academic year, written once at year-switch
// time from that year's live AttendanceRecord rows (which are then deleted)
// -- see POST /api/school/year-switch. The current year keeps its full
// daily AttendanceRecord history unchanged; only past years are compacted
// to this single yearly percentage, by design (no daily/monthly detail is
// kept for a year once it's ended).
export interface IAttendanceYearSummary extends Document {
  school: mongoose.Types.ObjectId;
  studentId: mongoose.Types.ObjectId;
  academicYear: string;
  classAtYearEnd: string;
  sectionAtYearEnd: string;
  totalDays: number;
  presentDays: number;
  percentage: number;
}

const attendanceYearSummarySchema = new Schema<IAttendanceYearSummary>(
  {
    school: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    academicYear: { type: String, required: true },
    classAtYearEnd: { type: String, default: "" },
    sectionAtYearEnd: { type: String, default: "" },
    totalDays: { type: Number, required: true },
    // Present + late counted as present -- same convention as
    // src/lib/studentAttendance.ts's withAttendancePercent.
    presentDays: { type: Number, required: true },
    percentage: { type: Number, required: true },
  },
  { timestamps: true },
);

attendanceYearSummarySchema.index({ school: 1, studentId: 1, academicYear: 1 }, { unique: true });

export const AttendanceYearSummary: Model<IAttendanceYearSummary> =
  mongoose.models.AttendanceYearSummary || mongoose.model<IAttendanceYearSummary>("AttendanceYearSummary", attendanceYearSummarySchema);
