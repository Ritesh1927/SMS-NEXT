// Single source of truth for "is this day a holiday" -- used both by the
// attendance POST route (to reject marking) and by every calendar component
// (to color the day). Pure and framework-agnostic (no DB/server imports) so
// it's importable from client components too, same as lib/attendanceStreak.ts.

export interface HolidayConfig {
  weeklyOffDays: number[];
  dates: { date: string | Date; name: string }[];
}

// The /api/school/holidays response shape: holiday config plus events,
// which live as a separate top-level settings key (not nested under
// holidays) since they're semantically different -- events never block
// attendance. Combined here only so calendar components can fetch and
// hold both with one request.
export interface CalendarData extends HolidayConfig {
  events: { date: string | Date; name: string }[];
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function getHolidayInfo(date: Date | string, config: HolidayConfig): { type: "weekly" | "custom"; name: string } | null {
  const d = typeof date === "string" ? new Date(date) : date;

  const custom = config.dates.find((h) => isSameDay(new Date(h.date), d));
  if (custom) return { type: "custom", name: custom.name };

  if (config.weeklyOffDays.includes(d.getDay())) return { type: "weekly", name: "Weekly Holiday" };

  return null;
}

export function isHoliday(date: Date | string, config: HolidayConfig): boolean {
  return !!getHolidayInfo(date, config);
}

// Separate from getHolidayInfo -- an event never blocks attendance, so it's
// deliberately not folded into that function's holiday/weekly result.
export function getEventInfo(date: Date | string, events: { date: string | Date; name: string }[]): { name: string } | null {
  const d = typeof date === "string" ? new Date(date) : date;
  const match = events.find((e) => isSameDay(new Date(e.date), d));
  return match ? { name: match.name } : null;
}
