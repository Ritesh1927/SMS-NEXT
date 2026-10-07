import mongoose, { Schema, type Model } from "mongoose";

// Atomic per-year sequence for human-readable ticket numbers
// (BUG-2026-000154). findOneAndUpdate + $inc is atomic in MongoDB, so
// concurrent submissions on different serverless instances never collide.
interface ITicketCounter {
  _id: string;
  seq: number;
}

const ticketCounterSchema = new Schema<ITicketCounter>({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 },
});

export const TicketCounter: Model<ITicketCounter> =
  mongoose.models.TicketCounter || mongoose.model<ITicketCounter>("TicketCounter", ticketCounterSchema);

export async function nextTicketNumber(prefix = "BUG"): Promise<string> {
  const year = new Date().getFullYear();
  const counter = await TicketCounter.findOneAndUpdate(
    { _id: `${prefix}-${year}` },
    { $inc: { seq: 1 } },
    { upsert: true, new: true },
  );
  return `${prefix}-${year}-${String(counter.seq).padStart(6, "0")}`;
}
