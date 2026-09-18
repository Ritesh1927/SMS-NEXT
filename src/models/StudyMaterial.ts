import mongoose, { Schema, type Document, type Model } from "mongoose";

export type MaterialType = "notes" | "paper" | "worksheet";

export interface IStudyMaterial extends Document {
  school: mongoose.Types.ObjectId;
  title: string;
  description: string;
  subject: string;
  class: string;
  section: string;
  type: MaterialType;
  fileUrl: string;
  filePublicId: string;
  fileName: string;
  uploadedBy: mongoose.Types.ObjectId;
  uploaderModel: "Teacher" | "Admin";
  uploaderName: string;
  downloads: number;
}

const studyMaterialSchema = new Schema<IStudyMaterial>(
  {
    school: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    subject: { type: String, required: true, trim: true },
    class: { type: String, required: true },
    section: { type: String, default: "" },
    type: { type: String, enum: ["notes", "paper", "worksheet"], default: "notes" },
    fileUrl: { type: String, required: true },
    filePublicId: { type: String, default: "" },
    fileName: { type: String, default: "" },
    uploadedBy: { type: Schema.Types.ObjectId, refPath: "uploaderModel" },
    uploaderModel: { type: String, enum: ["Teacher", "Admin"], default: "Teacher" },
    uploaderName: { type: String, default: "" },
    downloads: { type: Number, default: 0 },
  },
  { timestamps: true },
);

export const StudyMaterial: Model<IStudyMaterial> =
  mongoose.models.StudyMaterial || mongoose.model<IStudyMaterial>("StudyMaterial", studyMaterialSchema);
