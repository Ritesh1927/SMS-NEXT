import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Role } from "@/models/Role";
import { Teacher } from "@/models/Teacher";
import { sanitizeSections } from "@/lib/roles";

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
    const counts = await Teacher.aggregate([
      { $match: { school: new mongoose.Types.ObjectId(auth.schoolId), staffRole: { $ne: null } } },
      { $group: { _id: "$staffRole", count: { $sum: 1 } } },
    ]);
    const countMap = new Map(counts.map((c) => [String(c._id), c.count]));
    const data = roles.map((r) => ({ ...r, _id: String(r._id), staffCount: countMap.get(String(r._id)) || 0 }));
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

    await connectDB();
    if (await Role.findOne({ school: auth.schoolId, name })) {
      return NextResponse.json({ success: false, message: "A role with this name already exists." }, { status: 400 });
    }

    const role = await Role.create({
      school: auth.schoolId,
      name,
      description: typeof body.description === "string" ? body.description : "",
      sections: sanitizeSections(body.sections),
    });

    return NextResponse.json({ success: true, message: "Role created.", data: role }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to create role." },
      { status: 500 },
    );
  }
}
