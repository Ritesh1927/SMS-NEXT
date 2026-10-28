// Pure date math for the educational year's actual calendar boundary --
// deliberately has zero framework/DB imports (unlike src/lib/academicYear.ts,
// which imports the Admin model) so it's safe to import from BOTH src/proxy.ts
// (Node runtime, server-only) and client components (the dashboard layout's
// warning banner) without ever risking Mongoose leaking into a client bundle.
const MONTHS_FULL = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// "2026-2027" + "April" -> 23:59:59.999 on 31 March 2027. Generalizes
// correctly for every start month (including January/December) via the
// "day 0" trick: new Date(startYear+1, idx, 0) is the last day of the
// month BEFORE idx in (startYear+1) -- exactly the day before the next
// cycle's session would start.
export function getAcademicYearEndDate(sessionStartMonth: string, academicYear: string): Date | null {
  const startYear = parseInt(academicYear.split("-")[0], 10);
  const idx = MONTHS_FULL.indexOf(sessionStartMonth);
  if (!startYear || idx < 0) return null;
  return new Date(startYear + 1, idx, 0, 23, 59, 59, 999);
}

// Whole days remaining until (and including) the end date, or a negative
// number once it's passed. Rounds up so "a few hours left today" still
// reads as "0 days left" rather than rolling over to -1 prematurely.
export function daysUntil(endDate: Date, now: Date = new Date()): number {
  return Math.ceil((endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000));
}
