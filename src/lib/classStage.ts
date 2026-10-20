import { isStreamStandard } from "@/lib/streamStandards";

// Maps a free-text Class.name (there's no enum -- schools type whatever
// standard name they use) to one of four school stages, for Teacher Power
// Roles' scope. Pure, no framework imports, so it's importable from both API
// routes and client components (same style as lib/streamStandards.ts).
//
// Deliberately separate from dashboard/notices/page.tsx's own 3-band
// gradeKey/classesInBand logic -- that one folds Pre-Primary into Primary
// and has no prefix/suffix stripping. Changing it in place would risk
// regressing Notices, an already-shipped feature with different semantics.
export const STAGE_KEYS = ["prePrimary", "primary", "middle", "high"] as const;
export type StageKey = (typeof STAGE_KEYS)[number];

export const STAGE_LABELS: Record<StageKey, string> = {
  prePrimary: "Pre-Primary",
  primary: "Primary (1–5)",
  middle: "Middle School (6–8)",
  high: "High School (9–12)",
};

const PRE_PRIMARY_NAMES = new Set([
  "pre-nursery", "pre nursery", "prenursery", "pg",
  "playgroup", "play group",
  "nursery",
  "lkg", "l.k.g", "l.k.g.",
  "ukg", "u.k.g", "u.k.g.",
  "kg", "kg1", "kg2", "kindergarten",
]);

function normalize(name: string): string {
  return String(name)
    .trim()
    .toLowerCase()
    .replace(/^(class|grade|standard|std)\.?\s*/, "")
    .replace(/(st|nd|rd|th)$/, "")
    .trim();
}

// Returns null for any class name that can't be confidently classified --
// callers must treat null as "never in scope," never as a wildcard match.
export function classifyStage(className: string): StageKey | null {
  // Stream standards (11/12) keep the stream (Science/Commerce/Arts) in
  // section, never in name, so a plain "11"/"12" always means High School
  // regardless of normalization below.
  if (isStreamStandard(className)) return "high";

  const norm = normalize(className);
  if (PRE_PRIMARY_NAMES.has(norm)) return "prePrimary";

  if (norm === "") return null;
  const n = Number(norm);
  if (!Number.isFinite(n)) return null;
  if (n >= 1 && n <= 5) return "primary";
  if (n >= 6 && n <= 8) return "middle";
  if (n >= 9 && n <= 12) return "high";
  return null;
}
