import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { RateLimitHit } from "@/models/RateLimitHit";

export function getClientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "";
}

// Fixed-window counter, keyed by client IP, stored in Mongo so every
// serverless instance shares the same count. Mirrors SMS-BACKEND's
// authLimiter (20 requests / 15 min, applied to every auth-sensitive route:
// login, signup, OTP send/verify, forgot/reset password) — same limits,
// same 429 + message, so the client-side error handling doesn't need to
// change either.
const WINDOW_MS = 15 * 60 * 1000;
const MAX_REQUESTS = 20;

// Returns a 429 NextResponse if the caller (by IP) has exceeded the limit
// for this window, or null if the request may proceed. Call this first,
// before any DB writes or slow work, in every auth-sensitive route.
export async function checkAuthRateLimit(req: Request): Promise<NextResponse | null> {
  const ip = getClientIp(req);
  // No IP available (e.g. a same-origin request with the header stripped) —
  // fail open rather than lock out every caller behind a misconfigured proxy.
  if (!ip) return null;
  return checkRateLimit({
    key: `auth:${ip}`,
    windowMs: WINDOW_MS,
    max: MAX_REQUESTS,
    message: "Too many attempts. Please try again in a few minutes.",
  });
}

/**
 * General fixed-window limiter on the same Mongo-backed counter. `key`
 * identifies who/what is limited (e.g. `bug-create:<userId>`); the window
 * index is appended here. Fails open on DB errors, like the auth limiter.
 */
export async function checkRateLimit(opts: {
  key: string;
  windowMs: number;
  max: number;
  message: string;
}): Promise<NextResponse | null> {
  try {
    await connectDB();
    const windowIndex = Math.floor(Date.now() / opts.windowMs);
    const hit = await RateLimitHit.findOneAndUpdate(
      { _id: `${opts.key}:${windowIndex}` },
      { $inc: { count: 1 }, $setOnInsert: { expiresAt: new Date(Date.now() + opts.windowMs * 2) } },
      { upsert: true, new: true },
    );

    if (hit.count > opts.max) {
      return NextResponse.json({ success: false, message: opts.message }, { status: 429 });
    }
    return null;
  } catch {
    // A rate-limit check failing (e.g. a transient DB hiccup) must never
    // block real logins — fail open, same principle as login-activity
    // logging elsewhere in this app.
    return null;
  }
}
