import mongoose, { Schema, type Document, type Model } from "mongoose";
import bcrypt from "bcryptjs";

interface IPermissions {
  canCreateStudent: boolean;
  canEditStudent: boolean;
  canDeleteStudent: boolean;
  canViewAllStudents: boolean;
  canMarkAttendance: boolean;
  canViewAttendance: boolean;
  canManageFees: boolean;
  canViewFees: boolean;
  canCreateExam: boolean;
  canEnterMarks: boolean;
  canViewExams: boolean;
  canPostNotice: boolean;
  canViewNotices: boolean;
  canAssignHomework: boolean;
  canViewHomework: boolean;
  canPostNoticeBoard: boolean;
  canManageLibrary: boolean;
  canDailyChallenge: boolean;
  canAwardBadges: boolean;
}

const permissionsSchema = new Schema<IPermissions>(
  {
    canCreateStudent: { type: Boolean, default: false },
    canEditStudent: { type: Boolean, default: false },
    canDeleteStudent: { type: Boolean, default: false },
    canViewAllStudents: { type: Boolean, default: false },
    canMarkAttendance: { type: Boolean, default: false },
    canViewAttendance: { type: Boolean, default: false },
    canManageFees: { type: Boolean, default: false },
    canViewFees: { type: Boolean, default: false },
    canCreateExam: { type: Boolean, default: false },
    canEnterMarks: { type: Boolean, default: false },
    canViewExams: { type: Boolean, default: true },
    canPostNotice: { type: Boolean, default: false },
    canViewNotices: { type: Boolean, default: true },
    canAssignHomework: { type: Boolean, default: false },
    canViewHomework: { type: Boolean, default: true },
    canPostNoticeBoard: { type: Boolean, default: false },
    canManageLibrary: { type: Boolean, default: false },
    canDailyChallenge: { type: Boolean, default: false },
    canAwardBadges: { type: Boolean, default: false },
  },
  { _id: false },
);

export interface ITeacher extends Document {
  name: string;
  email: string;
  password: string;
  phone: string;
  teacherId: string;
  school: mongoose.Types.ObjectId;
  subjects: string[];
  classes: string[];
  qualification: string;
  experience: string;
  designation: string;
  role: "teacher";
  staffType: "teaching" | "non-teaching";
  department: string;
  assignedClasses: mongoose.Types.ObjectId[];
  permissions: IPermissions;
  gender: "male" | "female" | "other";
  dateOfBirth: Date | null;
  photo: string;
  photoPublicId: string;
  address: string;
  bloodGroup: string;
  joiningDate: Date | null;
  salary: number;
  employmentType: "full-time" | "part-time" | "contract";
  emergencyContact: string;
  emergencyPhone: string;
  emergencyRelation: string;
  aadhaarNumber: string;
  panNumber: string;
  bankName: string;
  accountNumber: string;
  ifscCode: string;
  specialization: string;
  previousExperience: string;
  isActive: boolean;
  isVerified: boolean;
  resetOTP: string | null;
  resetOTPExpire: Date | null;
  badges: string[];
  points: number;
  comparePassword(candidate: string): Promise<boolean>;
}

const teacherSchema = new Schema<ITeacher>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
    phone: { type: String, default: "" },
    teacherId: { type: String },
    school: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    subjects: [{ type: String }],
    classes: [{ type: String }],
    qualification: { type: String, default: "" },
    experience: { type: String, default: "" },
    designation: { type: String, default: "Teacher" },
    role: { type: String, enum: ["teacher"], default: "teacher" },
    staffType: { type: String, enum: ["teaching", "non-teaching"], default: "teaching" },
    department: { type: String, default: "" },
    assignedClasses: [{ type: Schema.Types.ObjectId, ref: "Class" }],
    permissions: { type: permissionsSchema, default: () => ({}) },
    gender: { type: String, enum: ["male", "female", "other"], default: "male" },
    dateOfBirth: { type: Date, default: null },
    photo: { type: String, default: "" },
    photoPublicId: { type: String, default: "" },
    address: { type: String, default: "" },
    bloodGroup: { type: String, default: "" },
    joiningDate: { type: Date, default: null },
    salary: { type: Number, default: 0 },
    employmentType: { type: String, enum: ["full-time", "part-time", "contract"], default: "full-time" },
    emergencyContact: { type: String, default: "" },
    emergencyPhone: { type: String, default: "" },
    emergencyRelation: { type: String, default: "" },
    aadhaarNumber: { type: String, default: "" },
    panNumber: { type: String, default: "" },
    bankName: { type: String, default: "" },
    accountNumber: { type: String, default: "" },
    ifscCode: { type: String, default: "" },
    specialization: { type: String, default: "" },
    previousExperience: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: true },
    resetOTP: { type: String, default: null },
    resetOTPExpire: { type: Date, default: null },
    badges: [{ type: String }],
    points: { type: Number, default: 0 },
  },
  { timestamps: true },
);

// Mongoose 9 dropped the next()-callback style for document middleware.
teacherSchema.pre<ITeacher>("save", async function () {
  if (!this.teacherId) {
    const count = await mongoose.model("Teacher").countDocuments({ school: this.school });
    const year = new Date().getFullYear();
    this.teacherId = "TCH-" + year + "-" + String(count + 1).padStart(4, "0");
  }
});

teacherSchema.methods.comparePassword = function (candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

teacherSchema.index({ school: 1, email: 1 }, { unique: true });
teacherSchema.index({ school: 1, teacherId: 1 }, { unique: true });

export const Teacher: Model<ITeacher> =
  mongoose.models.Teacher || mongoose.model<ITeacher>("Teacher", teacherSchema);
