import mongoose, { Schema, type Document, type Model } from "mongoose";

export type FeeFrequency = "monthly" | "quarterly" | "yearly" | "one-time";

export interface IFeeStructure extends Document {
  school: mongoose.Types.ObjectId;
  class: string;
  title: string;
  amount: number;
  dueDate: Date;
  frequency: FeeFrequency;
  description: string;
  academicYear: string;
  isActive: boolean;
}

const feeStructureSchema = new Schema<IFeeStructure>(
  {
    school: { type: Schema.Types.ObjectId, ref: "Admin", required: true },
    class: { type: String, required: true },
    title: { type: String, required: true },
    amount: { type: Number, required: true },
    dueDate: { type: Date, required: true },
    frequency: { type: String, enum: ["monthly", "quarterly", "yearly", "one-time"], default: "monthly" },
    description: { type: String, default: "" },
    academicYear: { type: String, default: "" },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

export const FeeStructure: Model<IFeeStructure> =
  mongoose.models.FeeStructure || mongoose.model<IFeeStructure>("FeeStructure", feeStructureSchema);

// Returns every active fee head in the given class whose title matches one
// of `titles` (trimmed, case-insensitive), excluding `excludeId` (the doc
// being edited). Comparison happens in JS rather than a case-insensitive
// regex so user input can't be interpreted as a pattern, and a class holds
// only a handful of heads, so one small query covers the whole check.
// Used by POST/PATCH /fees/structures(/batch) to block duplicates — the same
// head created twice would double the auto-assigned pending payments and the
// dues computed from structures (feeDues ignores academicYear).
export async function findDuplicateFeeStructures(
  schoolId: string | mongoose.Types.ObjectId,
  cls: string,
  titles: string[],
  excludeId?: mongoose.Types.ObjectId | string,
): Promise<{ title: string }[]> {
  const wanted = new Set(titles.map((t) => t.trim().toLowerCase()).filter(Boolean));
  if (wanted.size === 0) return [];
  const list = await FeeStructure.find({ school: schoolId, class: cls, isActive: true })
    .select("title")
    .lean<{ _id: unknown; title: string }[]>();
  const seen = new Set<string>();
  const dups: { title: string }[] = [];
  for (const s of list) {
    const key = s.title.trim().toLowerCase();
    if (!wanted.has(key) || String(s._id) === String(excludeId)) continue;
    if (seen.has(key)) continue;
    seen.add(key);
    dups.push({ title: s.title });
  }
  return dups;
}
