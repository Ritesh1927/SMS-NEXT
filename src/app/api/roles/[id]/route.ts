import { NextResponse } from "next/server";
import { isValidObjectId } from "mongoose";
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

type Params = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Params) {
  const auth = requireSchoolAdmin(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ success: false, message: "Role not found." }, { status: 404 });

  try {
    await connectDB();
    const role = await Role.findOne({ _id: id, school: auth.schoolId }).lean();
    if (!role) return NextResponse.json({ success: false, message: "Role not found." }, { status: 404 });
    return NextResponse.json({ success: true, data: role });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load role." },
      { status: 500 },
    );
  }
}

// PATCH /api/roles/:id -- rename, re-describe, and/or change the permission
// checklist. Always re-sanitized against ROLE_SECTIONS, same as create.
export async function PATCH(req: Request, { params }: Params) {
  const auth = requireSchoolAdmin(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ success: false, message: "Role not found." }, { status: 404 });

  try {
    const body = await req.json();
    await connectDB();
    const role = await Role.findOne({ _id: id, school: auth.schoolId });
    if (!role) return NextResponse.json({ success: false, message: "Role not found." }, { status: 404 });

    if (body.name !== undefined) {
      const name = typeof body.name === "string" ? body.name.trim() : "";
      if (!name) return NextResponse.json({ success: false, message: "Role name is required." }, { status: 400 });
      if (name !== role.name && (await Role.findOne({ school: auth.schoolId, name, _id: { $ne: id } }))) {
        return NextResponse.json({ success: false, message: "A role with this name already exists." }, { status: 400 });
      }
      role.name = name;
    }
    if (body.description !== undefined) role.description = typeof body.description === "string" ? body.description : "";
    if (body.sections !== undefined) role.sections = sanitizeSections(body.sections);

    await role.save();
    return NextResponse.json({ success: true, message: "Role updated.", data: role });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to update role." },
      { status: 500 },
    );
  }
}

// DELETE /api/roles/:id -- blocked while any staff member still holds this
// role, so an admin can't silently strip someone's access by deleting it
// out from under them; they have to reassign those staff first.
export async function DELETE(req: Request, { params }: Params) {
  const auth = requireSchoolAdmin(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const { id } = await params;
  if (!isValidObjectId(id)) return NextResponse.json({ success: false, message: "Role not found." }, { status: 404 });

  try {
    await connectDB();
    const role = await Role.findOne({ _id: id, school: auth.schoolId });
    if (!role) return NextResponse.json({ success: false, message: "Role not found." }, { status: 404 });

    const staffCount = await Teacher.countDocuments({ school: auth.schoolId, staffRole: id });
    if (staffCount > 0) {
      return NextResponse.json(
        { success: false, message: `${staffCount} staff member${staffCount === 1 ? "" : "s"} still ${staffCount === 1 ? "has" : "have"} this role. Reassign them first.` },
        { status: 409 },
      );
    }

    await Role.deleteOne({ _id: id });
    return NextResponse.json({ success: true, message: "Role deleted." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to delete role." },
      { status: 500 },
    );
  }
}
