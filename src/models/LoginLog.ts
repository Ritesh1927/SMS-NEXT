import mongoose, { Schema, type Document, type Model } from "mongoose";

export type LoginRole = "schooladmin" | "teacher" | "parent";

export interface ILoginLog extends Document {
  school: mongoose.Types.ObjectId;
  userId: mongoose.Types.ObjectId;
  userName: string;
  email: string;
  role: LoginRole;
  ip: string;
  browser: string;
  os: string;
  device: string;
  location: string;
  loginAt: Date;
}

const loginLogSchema = new Schema<ILoginLog>(
  {
    school: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    userId: { type: Schema.Types.ObjectId, required: true },
    userName: { type: String, required: true },
    email: { type: String, required: true },
    role: { type: String, enum: ["schooladmin", "teacher", "parent"], required: true },
    ip: { type: String, default: "" },
    browser: { type: String, default: "" },
    os: { type: String, default: "" },
    device: { type: String, default: "" },
    location: { type: String, default: "" },
    loginAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

loginLogSchema.index({ school: 1, loginAt: -1 });
loginLogSchema.index({ school: 1, email: 1 });

export const LoginLog: Model<ILoginLog> = mongoose.models.LoginLog || mongoose.model<ILoginLog>("LoginLog", loginLogSchema);
