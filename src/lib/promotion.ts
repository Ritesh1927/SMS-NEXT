// Pure suggestion logic for the Educational Year Switch's student-promotion
// feature -- never auto-applied. Every suggestion here is shown in a
// reviewable UI where an admin/teacher can override the target class/section
// per student before confirming, so a wrong guess costs nothing. No
// framework imports, same style as lib/classStage.ts / lib/streamStandards.ts.
import { isStreamStandard } from "@/lib/streamStandards";

export type PromotionSuggestion =
  | { type: "promote"; class: string; section: string; needsSectionChoice: boolean }
  | { type: "graduate" };

// Index in the pre-primary ladder, or null if this name isn't a recognized
// pre-primary step. Deliberately a smaller, single canonical ladder (not
// classStage.ts's broader PRE_PRIMARY_NAMES alias set) -- this only needs to
// know WHERE in the sequence a name sits, not just that it's pre-primary.
const PRE_PRIMARY_LADDER = ["Pre-Nursery", "Nursery", "LKG", "UKG"];

function prePrimaryIndex(name: string): number | null {
  const n = name.trim().toLowerCase().replace(/[\s.-]/g, "");
  if (["prenursery", "pg", "playgroup"].includes(n)) return 0;
  if (n === "nursery") return 1;
  if (["lkg", "kg1"].includes(n)) return 2;
  if (["ukg", "kg2"].includes(n)) return 3;
  return null;
}

export function suggestNextClass(className: string, section: string): PromotionSuggestion {
  const name = String(className).trim();

  if (isStreamStandard(name)) {
    // "11" -> "12": the stream (carried in section) continues unchanged.
    if (name === "11") return { type: "promote", class: "12", section, needsSectionChoice: false };
    // "12" -> graduates, no further class.
    return { type: "graduate" };
  }

  const prePrimaryIdx = prePrimaryIndex(name);
  if (prePrimaryIdx !== null) {
    if (prePrimaryIdx < PRE_PRIMARY_LADDER.length - 1) {
      return { type: "promote", class: PRE_PRIMARY_LADDER[prePrimaryIdx + 1], section, needsSectionChoice: false };
    }
    // UKG -> Class 1.
    return { type: "promote", class: "1", section, needsSectionChoice: false };
  }

  const n = Number(name);
  if (Number.isFinite(n) && n >= 1 && n <= 9) {
    return { type: "promote", class: String(n + 1), section, needsSectionChoice: false };
  }
  if (n === 10) {
    // No section carried forward -- streams live in section for 11/12, so
    // the review UI must force an explicit choice rather than guess one.
    return { type: "promote", class: "11", section: "", needsSectionChoice: true };
  }

  // Unrecognized class name -- never guess; force an explicit pick.
  return { type: "promote", class: "", section: "", needsSectionChoice: true };
}
