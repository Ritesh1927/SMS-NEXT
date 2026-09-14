import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import crypto from "crypto";

export interface TokenPayload {
  id: string;
  role: string;
  schoolId: string;
}

export const generateToken = (id: string, role: string, schoolId: string): string => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set. Add it to .env.local");
  return jwt.sign({ id, role, schoolId }, secret, { expiresIn: (process.env.JWT_EXPIRES_IN as jwt.SignOptions["expiresIn"]) || "7d" });
};

export const verifyToken = (token: string): TokenPayload => {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error("JWT_SECRET is not set. Add it to .env.local");
  return jwt.verify(token, secret) as TokenPayload;
};

// crypto.randomInt is cryptographically secure and unbiased, unlike Math.random()
export const generateOTP = (): string => crypto.randomInt(100000, 1000000).toString();

// Excludes visually-ambiguous characters (0/O, 1/l/I) since these get typed by humans
const PASSWORD_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
export const generatePassword = (length = 10): string => {
  let pw = "";
  for (let i = 0; i < length; i++) pw += PASSWORD_CHARS[crypto.randomInt(0, PASSWORD_CHARS.length)];
  return pw;
};

export const hashPassword = (p: string): Promise<string> => bcrypt.hash(p, 12);

// Escapes regex metacharacters so user-supplied search text is matched
// literally instead of being interpreted as a regex pattern (which could
// otherwise be used for a ReDoS attack or to match unintended records).
export const escapeRegex = (s: string): string => String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Class names are stored as either a bare grade ("1", "10") or, for older
// records, already-prefixed ("Class 1"). Use this anywhere a class name is
// sent to the client so it's never duplicated regardless of which form the
// stored value is in. Mirrors the SMS-FRONTEND/SMS-BACKEND helper of the
// same name so ported data displays identically.
const SPECIAL_CLASS_NAMES = ["nursery", "lkg", "ukg"];
export const formatClassName = (className?: string | null, section?: string | null): string => {
  if (!className) return "";
  const trimmed = String(className).trim();
  const isSpecial = SPECIAL_CLASS_NAMES.includes(trimmed.toLowerCase());
  const alreadyPrefixed = /^class\s/i.test(trimmed);
  const base = isSpecial || alreadyPrefixed ? trimmed : `Class ${trimmed}`;
  return section ? `${base}-${section}` : base;
};

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
  }
}

// Due/start dates entered via a plain <input type="date"> are stored as UTC
// midnight of that calendar date with no time-of-day meaning. Filtering
// "upcoming/pending" lists with `$gte: new Date()` compares that midnight
// timestamp against the exact current instant, so anything due *today*
// silently drops out as soon as the clock passes midnight UTC. Use this as
// the lower bound instead, so today's items stay visible until the day ends.
export const startOfToday = (): Date => {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
};
