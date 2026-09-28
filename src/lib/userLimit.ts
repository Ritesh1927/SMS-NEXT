import { School } from "@/models/School";
import { Admin } from "@/models/Admin";
import { Teacher } from "@/models/Teacher";
import { Student } from "@/models/Student";

export interface UserLimitStatus {
  // false when this school has no seat cap to enforce -- either it wasn't
  // registered through the Super Admin flow (no School document at all) or
  // its license's includedUsers/extraUsers were never configured.
  capped: boolean;
  used: number;
  total: number;
  remaining: number;
}

// Matches the exact "usersUsed" definition already shown on the Super
// Admin schools list (admin + teachers + students -- parents don't count
// against the seat limit).
export async function getUserLimitStatus(schoolId: string): Promise<UserLimitStatus> {
  const school = await School.findOne({ adminUserId: schoolId }).select("license");
  const total = (school?.license?.includedUsers || 0) + (school?.license?.extraUsers || 0);
  if (!school || total <= 0) {
    return { capped: false, used: 0, total: Infinity, remaining: Infinity };
  }

  const [adminCount, teacherCount, studentCount] = await Promise.all([
    Admin.countDocuments({ _id: schoolId, isActive: true }),
    Teacher.countDocuments({ school: schoolId }),
    Student.countDocuments({ school: schoolId }),
  ]);
  const used = adminCount + teacherCount + studentCount;
  return { capped: true, used, total, remaining: Math.max(0, total - used) };
}

export function userLimitMessage(limit: UserLimitStatus): string {
  return `User limit reached (${limit.used}/${limit.total} used). Ask the platform admin to increase this school's user limit to add more.`;
}
