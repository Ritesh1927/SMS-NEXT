import mongoose, { Schema, type Document, type Model } from "mongoose";
import bcrypt from "bcryptjs";

export interface ISuperAdmin extends Document {
  name: string;
  email: string;
  password: string;
  phone: string;
  role: "superadmin";
  isActive: boolean;
  isVerified: boolean;
  otp: string | null;
  otpExpire: Date | null;
  comparePassword(candidate: string): Promise<boolean>;
}

const superAdminSchema = new Schema<ISuperAdmin>(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
    phone: { type: String, default: "" },
    role: { type: String, default: "superadmin" },
    isActive: { type: Boolean, default: true },
    isVerified: { type: Boolean, default: false },
    otp: { type: String, default: null },
    otpExpire: { type: Date, default: null },
  },
  { timestamps: true },
);

// Mongoose 9 dropped the next()-callback style for document middleware.
superAdminSchema.pre<ISuperAdmin>("save", async function () {
  if (!this.isModified("password")) return;
  this.password = await bcrypt.hash(this.password, 12);
});

superAdminSchema.methods.comparePassword = function (candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

export const SuperAdmin: Model<ISuperAdmin> =
  mongoose.models.SuperAdmin || mongoose.model<ISuperAdmin>("SuperAdmin", superAdminSchema);
