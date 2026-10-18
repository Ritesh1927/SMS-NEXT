import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface ISectionPermission {
  open: boolean;
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  extras: Record<string, boolean>;
}

export interface IRole extends Document {
  school: mongoose.Types.ObjectId;
  name: string;
  description: string;
  /** Keyed by ROLE_SECTIONS key (src/lib/roles.ts), e.g. "students", "fees". */
  sections: Record<string, ISectionPermission>;
  createdAt: Date;
  updatedAt: Date;
}

const roleSchema = new Schema<IRole>(
  {
    school: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    name: { type: String, required: true, trim: true },
    description: { type: String, default: "" },
    // Plain object (not a Mongoose Map) -- a Map field silently loses its
    // entries under plain JSON.stringify/NextResponse.json unless every call
    // site remembers `flattenMaps`. The API routes validate its shape
    // against ROLE_SECTIONS on write instead of relying on schema typing.
    sections: { type: Schema.Types.Mixed, default: () => ({}) },
  },
  { timestamps: true },
);

roleSchema.index({ school: 1, name: 1 }, { unique: true });

export const Role: Model<IRole> = mongoose.models.Role || mongoose.model<IRole>("Role", roleSchema);
