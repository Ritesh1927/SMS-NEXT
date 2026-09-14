import mongoose, { Schema, type Document, type Model } from "mongoose";
import bcrypt from "bcryptjs";

export interface IAdmin extends Document {
  schoolName: string;
  schoolCode: string;
  schoolAddress: string;
  schoolPhone: string;
  schoolEmail: string;
  website: string;
  logo: string;
  themeColor: string;
  secondaryColor: string;
  name: string;
  email: string;
  password: string;
  phone: string;
  role: "schooladmin";
  isActive: boolean;
  isVerified: boolean;
  otp: string | null;
  otpExpire: Date | null;
  resetOTP: string | null;
  resetOTPExpire: Date | null;
  settings: {
    academicYear: string;
    sessionStartMonth: string;
    establishedYear: string;
    affiliation: string;
    gradingScale: "percentage" | "gpa" | "letter";
    termStructure: "semester" | "trimester" | "quarterly";
    passPercentage: number;
    notifications: {
      emailAlerts: boolean;
      smsAlerts: boolean;
      attendanceAlerts: boolean;
      feeReminders: boolean;
      examNotifications: boolean;
    };
    security: {
      sessionTimeout: number;
      maxLoginAttempts: number;
      twoFactorAuth: boolean;
    };
    lateFee: {
      enabled: boolean;
      gracePeriod: number;
      type: "fixed" | "percentage";
      amount: number;
      percent: number;
      maxAmount: number;
      applyEvery: "once" | "weekly";
    };
  };
  comparePassword(candidate: string): Promise<boolean>;
}

const adminSchema = new Schema<IAdmin>(
  {
    schoolName: { type: String, required: true, trim: true },
    schoolCode: { type: String, unique: true },
    schoolAddress: { type: String, default: "" },
    schoolPhone: { type: String, default: "" },
    schoolEmail: { type: String, default: "" },
    website: { type: String, default: "" },
    logo: { type: String, default: "" },
    themeColor: { type: String, default: "#6366f1" },
    secondaryColor: { type: String, default: "#8B5CF6" },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
    phone: { type: String, default: "" },
    role: { type: String, enum: ["schooladmin"], default: "schooladmin" },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    otp: { type: String, default: null },
    otpExpire: { type: Date, default: null },
    resetOTP: { type: String, default: null },
    resetOTPExpire: { type: Date, default: null },
    settings: {
      academicYear: { type: String, default: "" },
      sessionStartMonth: { type: String, default: "April" },
      establishedYear: { type: String, default: "" },
      affiliation: { type: String, default: "" },
      gradingScale: { type: String, enum: ["percentage", "gpa", "letter"], default: "percentage" },
      termStructure: { type: String, enum: ["semester", "trimester", "quarterly"], default: "semester" },
      passPercentage: { type: Number, default: 35 },
      notifications: {
        emailAlerts: { type: Boolean, default: true },
        smsAlerts: { type: Boolean, default: false },
        attendanceAlerts: { type: Boolean, default: true },
        feeReminders: { type: Boolean, default: true },
        examNotifications: { type: Boolean, default: true },
      },
      security: {
        sessionTimeout: { type: Number, default: 30 },
        maxLoginAttempts: { type: Number, default: 5 },
        twoFactorAuth: { type: Boolean, default: false },
      },
      lateFee: {
        enabled: { type: Boolean, default: false },
        gracePeriod: { type: Number, default: 7 },
        type: { type: String, enum: ["fixed", "percentage"], default: "fixed" },
        amount: { type: Number, default: 100 },
        percent: { type: Number, default: 2 },
        maxAmount: { type: Number, default: 500 },
        applyEvery: { type: String, enum: ["once", "weekly"], default: "once" },
      },
    },
  },
  { timestamps: true },
);

// Mongoose 9 dropped the next()-callback style for document middleware in
// favor of plain async/await — the hook just resolves (or throws) directly.
adminSchema.pre<IAdmin>("save", async function () {
  if (!this.schoolCode) {
    const count = await mongoose.model("Admin").countDocuments();
    const year = new Date().getFullYear();
    this.schoolCode = "SCH-" + year + "-" + String(count + 1).padStart(4, "0");
  }
});

adminSchema.methods.comparePassword = function (candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

// Next.js dev mode re-executes modules on hot reload, which would otherwise
// throw "Cannot overwrite model once compiled" on the second load.
export const Admin: Model<IAdmin> = mongoose.models.Admin || mongoose.model<IAdmin>("Admin", adminSchema);
