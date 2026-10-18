import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Teacher } from "@/models/Teacher";
import type { IRole, ISectionPermission } from "@/models/Role";
import { buildEmptySections, openSectionKeys } from "@/lib/roles";

// GET /api/roles/my-permissions -- self-serve, any logged-in teacher-role
// user. Returns both the section keys their assigned role has "open" (what
// the sidebar needs) and the full per-section permission map (what a page
// needs to decide whether to show its own Add/View/Edit/Delete controls).
// Teaching staff (or non-teaching staff with no role yet) always get the
// all-false shape: teaching staff's sidebar is driven by the existing
// Permission/pageKey system instead, and no role means no access by design.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "teacher") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const teacher = await Teacher.findById(auth.id).select("staffType staffRole").populate<{ staffRole: IRole | null }>("staffRole");
    const sections: Record<string, ISectionPermission> =
      teacher?.staffType === "non-teaching" && teacher.staffRole ? { ...buildEmptySections(), ...teacher.staffRole.sections } : buildEmptySections();
    const openSections = teacher?.staffType === "non-teaching" ? openSectionKeys(sections) : [];
    return NextResponse.json({ success: true, data: { openSections, sections } });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load permissions." },
      { status: 500 },
    );
  }
}
