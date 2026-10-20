import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface ISectionPermission {
  open: boolean;
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  extras: Record<string, boolean>;
}

/** roleType "nonTeaching" uses `sections`; "teaching" uses `teacherPowers` -- the unused shape stays zeroed, never both at once. */
export type RoleType = "nonTeaching" | "teaching";

export interface ITeacherPowers {
  /** Subset of STAGE_KEYS (src/lib/classStage.ts) -- the school stages this role's powers apply to. */
  scope: string[];
  timetableEdit: boolean;
  attendanceMark: boolean;
  attendanceEditPast: boolean;
  examCreate: boolean;
  marksEnter: boolean;
  resultsPublish: boolean;
  studentsEdit: boolean;
}

export interface IRole extends Document {
  school: mongoose.Types.ObjectId;
  name: string;
  description: string;
  roleType: RoleType;
  /** Keyed by ROLE_SECTIONS key (src/lib/roles.ts), e.g. "students", "fees". */
  sections: Record<string, ISectionPermission>;
  teacherPowers: ITeacherPowers;
  createdAt: Date;
  updatedAt: Date;
}

const teacherPowersSchema = new Schema<ITeacherPowers>(
  {
    scope: { type: [String], default: [] },
    timetableEdit: { type: Boolean, default: false },
    attendanceMark: { type: Boolean, default: false },
    attendanceEditPast: { type: Boolean, default: false },
    examCreate: { type: Boolean, default: false },
    marksEnter: { type: Boolean, default: false },
    resultsPublish: { type: Boolean, default: false },
    studentsEdit: { type: Boolean, default: false },
  },
  { _id: false },
);

const roleSchema = new Schema<IRole>(
  {
    school: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    roleType: { type: String, enum: ["nonTeaching", "teaching"], default: "nonTeaching" },
    // Plain object (not a Mongoose Map) -- a Map field silently loses its
    // entries under plain JSON.stringify/NextResponse.json unless every call
    // site remembers `flattenMaps`. The API routes validate its shape
    // against ROLE_SECTIONS on write instead of relying on schema typing.
    sections: { type: Schema.Types.Mixed, default: () => ({}) },
    // Fixed keys (unlike `sections`), so a real sub-schema is safe here --
    // no Map-flattening risk.
    teacherPowers: { type: teacherPowersSchema, default: () => ({}) },
  },
  { timestamps: true },
);

roleSchema.index({ school: 1, name: 1 }, { unique: true });

export const Role: Model<IRole> = mongoose.models.Role || mongoose.model<IRole>("Role", roleSchema);
