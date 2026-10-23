import { Notice } from "@/models/Notice";

// Auto-posts a notice to every teacher once a year switch finishes, if
// anyone besides the admin was just granted the right to promote students
// (see Admin.settings.yearSwitch's 2 toggles). Deliberately best-effort,
// same convention as postExamScheduleNotice: a notice failure must never
// fail the switch it's a side effect of. The Notices feature has no
// per-class targeting for teacher-role notices (only student-role notices
// are class-scoped), so this reaches every teacher at the school; the
// content says plainly who it actually applies to.
export async function postYearSwitchNotice(opts: {
  schoolId: string;
  previousYear: string;
  nextYear: string;
  classTeacherPromotionAllowed: boolean;
  powerRoleTeacherPromotionAllowed: boolean;
}) {
  if (!opts.classTeacherPromotionAllowed && !opts.powerRoleTeacherPromotionAllowed) return;
  try {
    const who =
      opts.classTeacherPromotionAllowed && opts.powerRoleTeacherPromotionAllowed
        ? "Class teachers, and teachers with the student-promotion power,"
        : opts.classTeacherPromotionAllowed
          ? "Class teachers"
          : "Teachers with the student-promotion power";

    await Notice.create({
      school: opts.schoolId,
      title: `Educational year switched to ${opts.nextYear}`,
      content: `The school has moved from ${opts.previousYear} to ${opts.nextYear}. ${who} can now promote the qualifying students of their class from the Classes page -- look for the promote icon on your class's card.`,
      category: "general",
      targetRoles: ["teacher"],
      classScope: "",
      targetClasses: [],
      postedBy: opts.schoolId,
      postedByModel: "Admin",
      isUrgent: true,
      isPinned: true,
      expiryDate: null,
    });
  } catch {
    // swallow -- see note above
  }
}
