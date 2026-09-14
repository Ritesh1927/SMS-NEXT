import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IClass extends Document {
  name: string;
  section: string;
  classTeacher: mongoose.Types.ObjectId | null;
  school: mongoose.Types.ObjectId;
  room: string;
  assignedSubjects: mongoose.Types.ObjectId[];
}

const classSchema = new Schema<IClass>(
  {
    name: { type: String, required: true, trim: true },
    section: { type: String, required: true, trim: true, uppercase: true },
    classTeacher: { type: Schema.Types.ObjectId, ref: "Teacher", default: null },
    school: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    room: { type: String, default: "" },
    // Real Subject docs (name/code/description), assigned via the
    // Subject & Class Assignment feature — replaces the earlier plain
    // subjects: string[] field, which duplicated the same relationship
    // with none of the reuse/code/description that feature needs.
    assignedSubjects: [{ type: Schema.Types.ObjectId, ref: "Subject" }],
  },
  { timestamps: true },
);

classSchema.index({ school: 1, name: 1, section: 1 }, { unique: true });

export const Class: Model<IClass> = mongoose.models.Class || mongoose.model<IClass>("Class", classSchema);
