import type { ISectionPermission } from "@/models/Role";

export type SectionAction = "open" | "view" | "create" | "edit" | "delete";
export const SECTION_ACTIONS: SectionAction[] = ["open", "view", "create", "edit", "delete"];

export interface RoleSectionConfig {
  key: string;
  label: string;
  /** Which of the 5 standard actions this section actually supports -- e.g. Leaderboard only has "open". */
  actions: SectionAction[];
  extras?: { key: string; label: string }[];
}

// Every sidebar section a Role can be granted, except the 4 admin-exclusive
// ones (Roles & Permissions, User Master, Login Activity, Settings) -- those
// never appear here, so no role, however permissive, can ever reach them.
// Extras are only added where the codebase already models a genuinely
// distinct, more-sensitive capability (canEnterMarks, canManageFees, etc.),
// not invented ones.
export const ROLE_SECTIONS: RoleSectionConfig[] = [
  { key: "students", label: "Students", actions: ["open", "view", "create", "edit", "delete"] },
  { key: "staff", label: "Staff", actions: ["open", "view", "create", "edit", "delete"] },
  { key: "parents", label: "Parents", actions: ["open", "view", "create", "edit", "delete"] },
  { key: "classes", label: "Classes", actions: ["open", "view", "create", "edit", "delete"] },
  { key: "subjectClass", label: "Subject & Class", actions: ["open", "view", "create", "edit", "delete"] },
  {
    key: "attendance",
    label: "Attendance",
    actions: ["open", "view", "create", "edit", "delete"],
    extras: [{ key: "editPastAttendance", label: "Edit past attendance" }],
  },
  {
    key: "exams",
    label: "Exams",
    actions: ["open", "view", "create", "edit", "delete"],
    extras: [
      { key: "enterMarks", label: "Enter marks" },
      { key: "publishResults", label: "Publish results" },
    ],
  },
  { key: "homework", label: "Homework", actions: ["open", "view", "create", "edit", "delete"] },
  {
    key: "timetable",
    label: "Timetable",
    actions: ["open", "view", "create", "edit", "delete"],
    extras: [{ key: "managePeriods", label: "Manage periods" }],
  },
  { key: "studyMaterials", label: "Study Materials", actions: ["open", "view", "create", "edit", "delete"] },
  {
    key: "fees",
    label: "Fees",
    actions: ["open", "view", "create", "edit", "delete"],
    extras: [
      { key: "collectPayment", label: "Collect payment" },
      { key: "manageFeeStructure", label: "Manage fee structure" },
    ],
  },
  { key: "notices", label: "Notices", actions: ["open", "view", "create", "edit", "delete"] },
  { key: "communication", label: "Communication", actions: ["open"] },
  { key: "reports", label: "Reports", actions: ["open", "view"], extras: [{ key: "exportData", label: "Export data" }] },
  { key: "leaderboard", label: "Leaderboard", actions: ["open"] },
  { key: "aiAssistant", label: "AI Assistant", actions: ["open"] },
];

export const ROLE_SECTION_KEYS: string[] = ROLE_SECTIONS.map((s) => s.key);

export const EMPTY_SECTION_PERMISSION: ISectionPermission = {
  open: false,
  view: false,
  create: false,
  edit: false,
  delete: false,
  extras: {},
};

export function buildEmptySections(): Record<string, ISectionPermission> {
  const sections: Record<string, ISectionPermission> = {};
  for (const s of ROLE_SECTIONS) sections[s.key] = { ...EMPTY_SECTION_PERMISSION, extras: {} };
  return sections;
}

/**
 * Strips/validates an arbitrary client-supplied `sections` object down to
 * only known keys/actions/extras, so a role can never be saved with a
 * section this app doesn't know about (incl. the 4 admin-exclusive ones,
 * which simply aren't in ROLE_SECTIONS and so can never survive this pass).
 */
export function sanitizeSections(input: unknown): Record<string, ISectionPermission> {
  const raw = (input && typeof input === "object" ? (input as Record<string, unknown>) : {}) as Record<string, unknown>;
  const sections: Record<string, ISectionPermission> = {};
  for (const section of ROLE_SECTIONS) {
    const src = (raw[section.key] && typeof raw[section.key] === "object" ? raw[section.key] : {}) as Record<string, unknown>;
    const out: ISectionPermission = { ...EMPTY_SECTION_PERMISSION, extras: {} };
    for (const action of section.actions) out[action] = src[action] === true;
    // A deeper action without "open" is meaningless -- open is implied.
    if (out.view || out.create || out.edit || out.delete) out.open = true;
    if (section.extras) {
      const srcExtras = (src.extras && typeof src.extras === "object" ? src.extras : {}) as Record<string, unknown>;
      for (const extra of section.extras) out.extras[extra.key] = srcExtras[extra.key] === true;
    }
    sections[section.key] = out;
  }
  return sections;
}

/** Section keys where `open` is true -- what the sidebar needs. */
export function openSectionKeys(sections: Record<string, ISectionPermission> | null | undefined): string[] {
  if (!sections) return [];
  return ROLE_SECTIONS.filter((s) => sections[s.key]?.open === true).map((s) => s.key);
}
