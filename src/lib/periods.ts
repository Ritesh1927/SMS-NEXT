import { SchoolPeriod } from "@/models/SchoolPeriod";

// Re-numbers every non-break period in display order (1, 2, 3...) so
// periodNumber always reflects the current order/gaps left by deletes,
// matching SMS-BACKEND's recomputePeriodNumbers. Scoped to one standard
// (or the default list, standard: null) at a time -- renumbering one
// standard's periods must never touch another's.
export async function recomputePeriodNumbers(schoolId: string, standard: string | null) {
  const all = await SchoolPeriod.find({ school: schoolId, standard }).sort({ order: 1 });
  let num = 1;
  for (const p of all) {
    p.periodNumber = p.isBreak ? null : num++;
    await p.save();
  }
}
