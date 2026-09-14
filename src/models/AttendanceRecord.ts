import mongoose, { Schema, type Document, type Model } from "mongoose";

export type AttendanceStatus = "present" | "absent" | "late";

export interface IAttendanceRecord extends Document {
  studentId: mongoose.Types.ObjectId;
  classId: mongoose.Types.ObjectId;
  school: mongoose.Types.ObjectId;
  date: Date;
  status: AttendanceStatus;
  markedBy: {
    id: mongoose.Types.ObjectId;
    role: "admin" | "teacher";
    name: string;
  };
}

const attendanceRecordSchema = new Schema<IAttendanceRecord>(
  {
    studentId: { type: Schema.Types.ObjectId, ref: "Student", required: true },
    classId: { type: Schema.Types.ObjectId, ref: "Class", required: true },
    school: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    date: { type: Date, required: true },
    status: { type: String, enum: ["present", "absent", "late"], required: true },
    markedBy: {
      id: { type: Schema.Types.ObjectId, required: true },
      role: { type: String, enum: ["admin", "teacher"], required: true },
      name: { type: String, default: "" },
    },
  },
  { timestamps: true },
);

// One record per student per date per school.
attendanceRecordSchema.index({ school: 1, studentId: 1, date: 1 }, { unique: true });

export const AttendanceRecord: Model<IAttendanceRecord> =
  mongoose.models.AttendanceRecord || mongoose.model<IAttendanceRecord>("AttendanceRecord", attendanceRecordSchema);
