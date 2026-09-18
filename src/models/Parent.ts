import mongoose, { Schema, type Document, type Model } from "mongoose";
import bcrypt from "bcryptjs";

export interface IParent extends Document {
  name: string;
  motherName: string;
  motherPhone: string;
  email: string;
  password: string;
  phone: string;
  alternatePhone: string;
  address: string;
  occupation: string;
  motherOccupation: string;
  relation: "father" | "mother" | "guardian";
  school: mongoose.Types.ObjectId;
  students: mongoose.Types.ObjectId[];
  role: "parent";
  isActive: boolean;
  resetOTP: string | null;
  resetOTPExpire: Date | null;
  comparePassword(candidate: string): Promise<boolean>;
}

const parentSchema = new Schema<IParent>(
  {
    name: { type: String, required: true, trim: true },
    motherName: { type: String, default: "" },
    motherPhone: { type: String, default: "" },
    email: { type: String, required: true, lowercase: true },
    password: { type: String, required: true, minlength: 6 },
    phone: { type: String, default: "" },
    alternatePhone: { type: String, default: "" },
    address: { type: String, default: "" },
    occupation: { type: String, default: "" },
    motherOccupation: { type: String, default: "" },
    relation: { type: String, enum: ["father", "mother", "guardian"], default: "father" },
    school: { type: Schema.Types.ObjectId, ref: "Admin" },
    students: [{ type: Schema.Types.ObjectId, ref: "Student" }],
    role: { type: String, enum: ["parent"], default: "parent" },
    isActive: { type: Boolean, default: true },
    resetOTP: { type: String, default: null },
    resetOTPExpire: { type: Date, default: null },
  },
  { timestamps: true },
);

parentSchema.methods.comparePassword = function (candidate: string) {
  return bcrypt.compare(candidate, this.password);
};

parentSchema.index({ school: 1, email: 1 }, { unique: true });

export const Parent: Model<IParent> =
  mongoose.models.Parent || mongoose.model<IParent>("Parent", parentSchema);
