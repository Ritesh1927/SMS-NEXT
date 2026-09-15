import mongoose, { Schema, type Document, type Model } from "mongoose";

export interface IPermission extends Document {
  teacher: mongoose.Types.ObjectId;
  school: mongoose.Types.ObjectId;
  permissions: string[];
  pages: string[];
  assignedBy: mongoose.Types.ObjectId | null;
}

const permissionSchema = new Schema<IPermission>(
  {
    teacher: { type: Schema.Types.ObjectId, ref: "Teacher", required: true, unique: true },
    school: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    permissions: { type: [String], default: [] },
    pages: { type: [String], default: [] },
    assignedBy: { type: Schema.Types.ObjectId, ref: "Admin", default: null },
  },
  { timestamps: true },
);

export const Permission: Model<IPermission> =
  mongoose.models.Permission || mongoose.model<IPermission>("Permission", permissionSchema);
