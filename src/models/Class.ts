import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IClass extends Document {
  name: string;
  section: string;
  classTeacher: mongoose.Types.ObjectId | null;
  school: mongoose.Types.ObjectId;
  room: string;
  subjects: string[];
}

const classSchema = new Schema<IClass>(
  {
    name: { type: String, required: true, trim: true },
    section: { type: String, required: true, trim: true, uppercase: true },
    classTeacher: { type: Schema.Types.ObjectId, ref: "Teacher", default: null },
    school: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    room: { type: String, default: "" },
    subjects: [{ type: String }],
  },
  { timestamps: true },
);

classSchema.index({ school: 1, name: 1, section: 1 }, { unique: true });

export const Class: Model<IClass> = mongoose.models.Class || mongoose.model<IClass>("Class", classSchema);
