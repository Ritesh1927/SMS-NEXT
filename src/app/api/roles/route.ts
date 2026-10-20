import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Role } from "@/models/Role";
import { Teacher } from "@/models/Teacher";
import { sanitizeSections, sanitizeTeacherPowers, buildEmptyTeacherPowers } from "@/lib/roles";
import type { RoleType } from "@/models/Role";

function requireSchoolAdmin(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") return null;
  return auth;
}

// GET /api/roles -- list this school's roles, with how many staff hold each
// one (for the "N staff" count in the left panel and the delete guard).
export async function GET(req: Request) {
  const auth = requireSchoolAdmin(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    await connectDB();
    const roles = await Role.find({ school: auth.schoolId }).sort({ name: 1 }).lean();
    // Aggregate pipelines skip Mongoose's automatic string->ObjectId
    // casting, unlike find(), so schoolId has to be cast explicitly here.
    // A role is referenced by exactly one of staffRole/powerRole depending
    // on its own roleType, so the two counts never overlap -- summed below.
    const schoolObjectId = new mongoose.Types.ObjectId(auth.schoolId);
    const [staffCounts, powerCounts] = await Promise.all([
      Teacher.aggregate([
        { $match: { school: schoolObjectId, staffRole: { $ne: null } } },
        { $group: { _id: "$staffRole", count: { $sum: 1 } } },
      ]),
      Teacher.aggregate([
        { $match: { school: schoolObjectId, powerRole: { $ne: null } } },
        { $group: { _id: "$powerRole", count: { $sum: 1 } } },
      ]),
    ]);
    const countMap = new Map<string, number>();
    for (const c of [...staffCounts, ...powerCounts]) countMap.set(String(c._id), c.count);
    // .lean() returns raw stored documents with no schema-default filling --
    // any role created before `roleType`/`teacherPowers` existed on the
    // schema has neither field in its actual stored document, not even as
    // "nonTeaching"/empty. Normalized here so every consumer (this list,
    // the staff form's Role dropdown) sees a consistent shape regardless of
    // when the role was created, rather than each caller having to guess
    // what a missing roleType means.
    const data = roles.map((r) => ({
      ...r,
      _id: String(r._id),
      roleType: r.roleType || "nonTeaching",
      teacherPowers: r.teacherPowers || buildEmptyTeacherPowers(),
      staffCount: countMap.get(String(r._id)) || 0,
    }));
    return NextResponse.json({ success: true, count: data.length, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load roles." },
      { status: 500 },
    );
  }
}

// POST /api/roles -- create a role. `sections` is sanitized against
// ROLE_SECTIONS so an unknown or admin-exclusive section key can never be
// stored, regardless of what the client sends.
export async function POST(req: Request) {
  const auth = requireSchoolAdmin(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) return NextResponse.json({ success: false, message: "Role name is required." }, { status: 400 });
    const roleType: RoleType = body.roleType === "teaching" ? "teaching" : "nonTeaching";

    await connectDB();
    if (await Role.findOne({ school: auth.schoolId, name })) {
      return NextResponse.json({ success: false, message: "A role with this name already exists." }, { status: 400 });
    }

    const role = await Role.create({
      school: auth.schoolId,
      name,
      description: typeof body.description === "string" ? body.description : "",
      roleType,
      // Only the shape matching roleType is ever meaningfully populated --
      // the other stays zeroed, so a role is never ambiguous about which
      // system it belongs to.
      sections: roleType === "nonTeaching" ? sanitizeSections(body.sections) : sanitizeSections(undefined),
      teacherPowers: roleType === "teaching" ? sanitizeTeacherPowers(body.teacherPowers) : sanitizeTeacherPowers(undefined),
    });

    return NextResponse.json({ success: true, message: "Role created.", data: role }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to create role." },
      { status: 500 },
    );
  }
}
