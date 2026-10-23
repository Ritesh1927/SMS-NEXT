import type { TokenPayload } from "@/lib/helpers";
import { getTeacherExtraPowers, teacherPowerAllows } from "@/lib/auth-server";
import { Teacher } from "@/models/Teacher";
import { Admin } from "@/models/Admin";
import "@/models/Role";
import type { IRole } from "@/models/Role";
import { isClassTeacherOfSection } from "@/lib/teacherClasses";

// Shared by GET /api/classes/[id]/promotion-preview and POST
// /api/classes/[id]/promote -- admin always; a class teacher of this exact
// section only when the switch's classTeacherPromotionAllowed toggle is on;
// a teacher with the studentsPromote Power scoped to this class's stage
// only when the switch's powerRoleTeacherPromotionAllowed toggle is on.
// Never trusts the UI's own icon-visibility check -- re-verified in both
// routes. Caller must have already called connectDB().
export async function canPromoteClass(
  auth: TokenPayload,
  schoolId: string,
  cls: { name: string; section: string },
): Promise<boolean> {
  if (auth.role === "schooladmin") return true;
  if (auth.role !== "teacher") return false;

  const admin = await Admin.findById(schoolId).select("settings.yearSwitch").lean();
  const yearSwitch = admin?.settings?.yearSwitch;
  if (!yearSwitch) return false;

  if (yearSwitch.classTeacherPromotionAllowed) {
    if (await isClassTeacherOfSection(auth.id, schoolId, cls.name, cls.section)) return true;
  }
  if (yearSwitch.powerRoleTeacherPromotionAllowed) {
    const teacher = await Teacher.findById(auth.id)
      .select("staffType powerRole")
      .populate<{ powerRole: IRole | null }>("powerRole");
    const powers = await getTeacherExtraPowers(auth, teacher);
    if (teacherPowerAllows(powers, "studentsPromote", cls.name)) return true;
  }
  return false;
}
