import { SchoolPeriod } from "@/models/SchoolPeriod";

function toMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// Re-numbers every non-break period in chronological order (1, 2, 3... by
// startTime, not insertion order -- a period added out of sequence via "Add
// Manually" must still land in its correct place) and relabels it "Period
// N" to match, so the label can never drift from the number actually shown
// elsewhere (the Timetable grid's period badge, the Manage Periods list).
// A break keeps whatever label it was given (e.g. "Break", "Lunch") --
// only non-break periods get this auto label. `order` is kept in sync with
// the new chronological position so callers that still sort by it (GET
// /api/periods, the frontend list) stay correct for free.
export async function recomputePeriodNumbers(schoolId: string, standard: string | null) {
  const all = await SchoolPeriod.find({ school: schoolId, standard }).sort({ startTime: 1 });
  let num = 1;
  for (let i = 0; i < all.length; i++) {
    const p = all[i];
    p.order = i + 1;
    if (p.isBreak) {
      p.periodNumber = null;
    } else {
      p.periodNumber = num;
      p.label = `Period ${num}`;
      num++;
    }
    await p.save();
  }
}

// True if [startTime, endTime) would overlap an existing period for this
// standard -- two schools can't both claim a class is in session during the
// same minute. Checked before every create/edit so "Add Manually" (free-
// form times) can't silently double-book a slot.
export async function findOverlappingPeriod(
  schoolId: string,
  standard: string | null,
  startTime: string,
  endTime: string,
  excludeId?: string,
) {
  const s1 = toMins(startTime);
  const e1 = toMins(endTime);
  const query: Record<string, unknown> = { school: schoolId, standard };
  if (excludeId) query._id = { $ne: excludeId };
  const existing = await SchoolPeriod.find(query);
  for (const p of existing) {
    const s2 = toMins(p.startTime);
    const e2 = toMins(p.endTime);
    if (s1 < e2 && s2 < e1) return p;
  }
  return null;
}
