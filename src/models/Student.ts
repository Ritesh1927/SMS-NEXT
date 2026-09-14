import mongoose, { Schema, type Document, type Model } from "mongoose";
import bcrypt from "bcryptjs";

export interface IStudent extends Document {
  name: string;
  email: string | null;
  password: string | null;
  phone: string;
  studentId: string;
  school: mongoose.Types.ObjectId;
  class: string;
  section: string;
  rollNumber: string;
  dateOfBirth: Date | null;
  gender: "male" | "female" | "other";
  address: string;
  bloodGroup: string;
  photo: string;
  photoPublicId: string;
  admissionDate: Date | null;
  admissionNo: string;
  previousSchool: string;
  aadhaarNumber: string;
  emergencyContact: string;
  emergencyPhone: string;
  emergencyRelation: string;
  allergies: string;
  medicalConditions: string;
  caste: string;
  religion: string;
  category: string;
  height: string;
  weight: string;
  classTeacher: mongoose.Types.ObjectId | null;
  parent: mongoose.Types.ObjectId | null;
  role: "student";
  isActive: boolean;
  isVerified: boolean;
  resetOTP: string | null;
  resetOTPExpire: string | null;
  canUseAI: boolean;
  badges: string[];
  points: number;
  streakDays: number;
  lastAttendance: Date | null;
  moodHistory: { mood: string; date: Date }[];
  comparePassword(candidate: string): Promise<boolean>;
}

const studentSchema = new Schema<IStudent>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, lowercase: true, default: null },
    password: { type: String, minlength: 6, default: null },
    phone: { type: String, default: "" },
    studentId: { type: String },
    school: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    class: { type: String, default: "" },
    section: { type: String, default: "" },
    rollNumber: { type: String, default: "" },
    dateOfBirth: { type: Date, default: null },
    gender: { type: String, enum: ["male", "female", "other"], default: "male" },
    address: { type: String, default: "" },
    bloodGroup: { type: String, default: "" },
    photo: { type: String, default: "" },
    photoPublicId: { type: String, default: "" },
    admissionDate: { type: Date, default: null },
    admissionNo: { type: String, default: "" },
    previousSchool: { type: String, default: "" },
    aadhaarNumber: { type: String, default: "" },
    emergencyContact: { type: String, default: "" },
    emergencyPhone: { type: String, default: "" },
    emergencyRelation: { type: String, default: "" },
    allergies: { type: String, default: "" },
    medicalConditions: { type: String, default: "" },
    caste: { type: String, default: "" },
    religion: { type: String, default: "" },
    category: { type: String, default: "" },
    height: { type: String, default: "" },
    weight: { type: String, default: "" },
    classTeacher: { type: Schema.Types.ObjectId, ref: "Teacher", default: null },
    parent: { type: Schema.Types.ObjectId, ref: "Parent", default: null },
    role: { type: String, enum: ["student"], default: "student" },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: true },
    resetOTP: { type: String, default: null },
    resetOTPExpire: { type: String, default: null },
    canUseAI: { type: Boolean, default: true },
    badges: [{ type: String }],
    points: { type: Number, default: 0 },
    streakDays: { type: Number, default: 0 },
    lastAttendance: { type: Date, default: null },
    moodHistory: [{ mood: String, date: Date }],
  },
  { timestamps: true },
);

// Mongoose 9 dropped the next()-callback style for document middleware.
studentSchema.pre<IStudent>("save", async function () {
  if (!this.studentId) {
    const count = await mongoose.model("Student").countDocuments({ school: this.school });
    const year = new Date().getFullYear();
    this.studentId = "STU-" + year + "-" + String(count + 1).padStart(4, "0");
  }
});

studentSchema.methods.comparePassword = function (candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

studentSchema.index({ school: 1, studentId: 1 }, { unique: true });

export const Student: Model<IStudent> =
  mongoose.models.Student || mongoose.model<IStudent>("Student", studentSchema);
