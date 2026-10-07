import mongoose, { Schema, type Model } from "mongoose";
import { DEFAULT_MAX_IMAGE_MB, DEFAULT_MAX_VIDEO_MB } from "@/lib/bugReports/constants";

// Singleton (_id "global") holding Super Admin-configurable ticket settings.
export interface ITicketSettings {
  _id: string;
  /** Archive resolved/closed tickets this many days after closing; 0 = never. */
  retentionDays: number;
  maxImageMB: number;
  maxVideoMB: number;
  /** Throttles the opportunistic retention sweep. */
  lastCleanupAt: Date | null;
  updatedBy: string;
}

const ticketSettingsSchema = new Schema<ITicketSettings>(
  {
    _id: { type: String, default: "global" },
    retentionDays: { type: Number, default: 90, enum: [0, 7, 15, 30, 60, 90, 180] },
    maxImageMB: { type: Number, default: DEFAULT_MAX_IMAGE_MB, min: 1, max: 50 },
    maxVideoMB: { type: Number, default: DEFAULT_MAX_VIDEO_MB, min: 1, max: 500 },
    lastCleanupAt: { type: Date, default: null },
    updatedBy: { type: String, default: "" },
  },
  { timestamps: true },
);

export const TicketSettings: Model<ITicketSettings> =
  mongoose.models.TicketSettings || mongoose.model<ITicketSettings>("TicketSettings", ticketSettingsSchema);

export async function getTicketSettings(): Promise<ITicketSettings> {
  const doc = await TicketSettings.findOneAndUpdate(
    { _id: "global" },
    { $setOnInsert: { _id: "global" } },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  ).lean();
  return doc as ITicketSettings;
}
