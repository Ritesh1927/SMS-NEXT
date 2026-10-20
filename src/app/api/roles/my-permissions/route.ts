import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Teacher } from "@/models/Teacher";
import "@/models/Role";
import type { IRole, ISectionPermission, ITeacherPowers } from "@/models/Role";
import { buildEmptySections, openSectionKeys, buildEmptyTeacherPowers } from "@/lib/roles";

// GET /api/roles/my-permissions -- self-serve, any logged-in teacher-role
// user. Returns both the section keys their assigned role has "open" (what
// the sidebar needs) and the full per-section permission map (what a page
// needs to decide whether to show its own Add/View/Edit/Delete controls),
// for non-teaching staff -- plus `teacherPowers` for genuine teaching staff
// with a "teaching" Power Role assigned. One universal "what extra can I do
// right now" fetch for both staff types, deliberately kept live (every page
// re-fetches on mount) rather than baked into the login-time
// JWT/localStorage snapshot, so an admin editing a role takes effect
// immediately without forcing a re-login.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "teacher") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const teacher = await Teacher.findById(auth.id)
      .select("staffType staffRole powerRole")
      .populate<{ staffRole: IRole | null }>("staffRole")
      .populate<{ powerRole: IRole | null }>("powerRole");
    const sections: Record<string, ISectionPermission> =
      teacher?.staffType === "non-teaching" && teacher.staffRole ? { ...buildEmptySections(), ...teacher.staffRole.sections } : buildEmptySections();
    const openSections = teacher?.staffType === "non-teaching" ? openSectionKeys(sections) : [];
    const teacherPowers: ITeacherPowers =
      teacher?.staffType === "teaching" && teacher.powerRole?.roleType === "teaching"
        ? { ...buildEmptyTeacherPowers(), ...teacher.powerRole.teacherPowers }
        : buildEmptyTeacherPowers();
    return NextResponse.json({ success: true, data: { openSections, sections, teacherPowers } });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load permissions." },
      { status: 500 },
    );
  }
}
