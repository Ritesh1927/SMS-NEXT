import mongoose, { Schema, type Document, type Model, type Types } from "mongoose";

export interface ISchoolLicense {
  planId: Types.ObjectId | null;
  planName: string;
  startDate: Date | null;
  endDate: Date | null;
  includedUsers: number;
  extraUsers: number;
  totalUsers: number;
  pricePerUser: number;
  months: number;
  totalAmount: number;
  status: "trial" | "active" | "expired" | "suspended";
}

export interface ISchool extends Document {
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  adminPassword: string;
  license: ISchoolLicense;
  isActive: boolean;
  isVerified: boolean;
  adminUserId: Types.ObjectId | null;
}

const schoolLicenseSchema = new Schema<ISchoolLicense>(
  {
    planId: { type: Schema.Types.ObjectId, ref: "Plan", default: null },
    planName: { type: String, default: "" },
    startDate: { type: Date, default: null },
    endDate: { type: Date, default: null },
    includedUsers: { type: Number, default: 0 },
    extraUsers: { type: Number, default: 0, min: 0 },
    totalUsers: { type: Number, default: 0 },
    pricePerUser: { type: Number, default: 0 },
    months: { type: Number, default: 1 },
    totalAmount: { type: Number, default: 0 },
    status: { type: String, enum: ["trial", "active", "expired", "suspended"], default: "trial" },
  },
  { _id: false },
);

const schoolSchema = new Schema<ISchool>(
  {
    name: { type: String, required: true, trim: true },
    code: { type: String, unique: true },
    address: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, default: "" },
    website: { type: String, default: "" },
    adminName: { type: String, required: true, trim: true },
    adminEmail: { type: String, required: true, unique: true, lowercase: true },
    adminPhone: { type: String, default: "" },
    adminPassword: { type: String, required: true },
    license: { type: schoolLicenseSchema, default: () => ({}) },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    adminUserId: { type: Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { timestamps: true },
);

// Mongoose 9 dropped the next()-callback style for document middleware.
schoolSchema.pre<ISchool>("save", async function () {
  if (!this.code) {
    const count = await mongoose.model("School").countDocuments();
    const year = new Date().getFullYear();
    this.code = "SCH-" + year + "-" + String(count + 1).padStart(4, "0");
  }
});

// Next.js dev mode re-executes modules on hot reload, which would otherwise
// throw "Cannot overwrite model once compiled" on the second load.
export const School: Model<ISchool> = mongoose.models.School || mongoose.model<ISchool>("School", schoolSchema);
