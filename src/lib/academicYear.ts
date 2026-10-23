import { Admin } from "@/models/Admin";

const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// The academic year a given session-start-month puts "today" in — for an
// April session in Oct 2026 that's "2026-2027" (Apr 2026 - Mar 2027). This
// is the pre-existing calculation duplicated across reports/page.tsx,
// AdminFeesPage.tsx, settings/page.tsx and fees/analytics/route.ts before
// this feature -- kept only for first-deploy migration seeding and an
// optional "past the natural boundary" nudge. Everyday reads should use
// getCurrentAcademicYear() below instead, which reads the stored value --
// once a school has switched at least once, this function's answer and the
// stored one can legitimately diverge (that's the whole point: the stored
// year only moves when an admin explicitly switches it, not automatically
// every session boundary like this calculation would).
export function computeNaturalAcademicYear(sessionStartMonth: string, now: Date = new Date()): string {
  const startIdx = MONTHS_FULL.indexOf(sessionStartMonth);
  const idx = startIdx >= 0 ? startIdx : 3;
  const startYear = now.getMonth() >= idx ? now.getFullYear() : now.getFullYear() - 1;
  return `${startYear}-${startYear + 1}`;
}

// The one function every server-side route should call for "what's the
// current academic year" from now on, instead of recomputing it. Caller
// must have already called connectDB() -- mirrors the convention every
// other auth-server.ts-style helper in this codebase already follows.
export async function getCurrentAcademicYear(schoolId: string): Promise<string> {
  const admin = await Admin.findById(schoolId).select("settings.academicYear settings.sessionStartMonth").lean();
  if (admin?.settings?.academicYear) return admin.settings.academicYear;
  // Defensive fallback for a school whose migration hasn't run yet (or any
  // unexpected empty value) -- never let a year-scoped query see "" and
  // silently match nothing; fall back to what the natural calculation would
  // show, same as today's pre-feature behavior.
  return computeNaturalAcademicYear(admin?.settings?.sessionStartMonth || "April");
}
