import mongoose, { Schema, type Document, type Model } from "mongoose";

export type NoticeCategory = "general" | "exam" | "fee" | "holiday" | "event" | "urgent" | "other";
export type NoticeTargetRole = "all" | "teacher" | "student" | "parent";

export interface INotice extends Document {
  school: mongoose.Types.ObjectId;
  title: string;
  content: string;
  category: NoticeCategory;
  targetRoles: NoticeTargetRole[];
  targetClass: string;
  postedBy: mongoose.Types.ObjectId;
  postedByModel: "Admin" | "Teacher";
  isUrgent: boolean;
  isPinned: boolean;
  expiryDate: Date | null;
  views: number;
}

const noticeSchema = new Schema<INotice>(
  {
    school: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    category: { type: String, enum: ["general", "exam", "fee", "holiday", "event", "urgent", "other"], default: "general" },
    targetRoles: { type: [String], enum: ["all", "teacher", "student", "parent"], default: ["all"] },
    targetClass: { type: String, default: "" },
    postedBy: { type: Schema.Types.ObjectId, required: true, refPath: "postedByModel" },
    postedByModel: { type: String, enum: ["Admin", "Teacher"], required: true },
    isUrgent: { type: Boolean, default: false },
    isPinned: { type: Boolean, default: false },
    expiryDate: { type: Date, default: null },
    views: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const Notice: Model<INotice> = mongoose.models.Notice || mongoose.model<INotice>("Notice", noticeSchema);
