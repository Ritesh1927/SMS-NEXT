import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IClass extends Document {
  name: string;
  section: string;
  classTeacher: mongoose.Types.ObjectId | null;
  school: mongoose.Types.ObjectId;
  room: string;
  assignedSubjects: mongoose.Types.ObjectId[];
  // The academic year (e.g. "2025-2026") this class was last promoted for,
  // via POST /api/classes/[id]/promote -- "" until the first promotion.
  // Strictly one-shot per year-switch cycle: once this matches
  // Admin.settings.yearSwitch.lastSwitchedYear, the promote route refuses a
  // second run and the Classes page hides the icon, until the next switch
  // advances lastSwitchedYear again.
  lastPromotedForYear: string;
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
    lastPromotedForYear: { type: String, default: "" },
  },
  { timestamps: true },
);

classSchema.index({ school: 1, name: 1, section: 1 }, { unique: true });

export const Class: Model<IClass> = mongoose.models.Class || mongoose.model<IClass>("Class", classSchema);
