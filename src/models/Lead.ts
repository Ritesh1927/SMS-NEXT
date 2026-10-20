import mongoose, { Schema, type Document, type Model } from "mongoose";

// Website enquiries from the public homepage: demo requests and newsletter
// sign-ups. Stored so no lead is lost even if the notification email fails.
export interface ILead extends Document {
  kind: "demo" | "newsletter";
  schoolName: string;
  contactPerson: string;
  phone: string;
  email: string;
  city: string;
  students: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
}

const leadSchema = new Schema<ILead>(
  {
    kind: { type: String, enum: ["demo", "newsletter"], required: true },
    schoolName: { type: String, default: "" },
    contactPerson: { type: String, default: "" },
    phone: { type: String, default: "" },
    email: { type: String, required: true, lowercase: true, trim: true },
    city: { type: String, default: "" },
    students: { type: String, default: "" },
    ipAddress: { type: String, default: "" },
    userAgent: { type: String, default: "" },
  },
  { timestamps: true },
);

leadSchema.index({ kind: 1, createdAt: -1 });

export const Lead: Model<ILead> = mongoose.models.Lead || mongoose.model<ILead>("Lead", leadSchema);
