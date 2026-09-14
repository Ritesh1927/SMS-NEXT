import mongoose, { Schema, type Document, type Model } from "mongoose";

// One document per (key, fixed time window) — e.g. "auth:203.0.113.4:31502234"
// where the trailing number is the window index. Incremented atomically on
// every hit; a TTL index reaps old windows automatically so this collection
// never grows unbounded. A DB-backed limiter (vs. an in-memory Map) is the
// only kind that works correctly once this app runs as multiple serverless
// function instances with no shared memory — which is what happens the
// moment this deploys to Vercel (or any other serverless/multi-instance host).
export interface IRateLimitHit extends Omit<Document, "_id"> {
  _id: string;
  count: number;
  expiresAt: Date;
}

const rateLimitHitSchema = new Schema<IRateLimitHit>({
  _id: { type: String, required: true },
  count: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});

rateLimitHitSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RateLimitHit: Model<IRateLimitHit> =
  mongoose.models.RateLimitHit || mongoose.model<IRateLimitHit>("RateLimitHit", rateLimitHitSchema);
