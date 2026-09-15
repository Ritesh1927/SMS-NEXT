import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Teacher } from "@/models/Teacher";
import { Permission } from "@/models/Permission";
import { ALL_PERMISSION_KEYS, ALL_PAGE_KEYS, permissionArrayToBooleanMap } from "@/lib/permissions";

// GET /api/permissions/[teacherId] — schooladmin can read any of their
// teachers' permissions; a teacher can only read their own (used by the
// sidebar to decide which nav items to show).
export async function GET(req: Request, { params }: { params: Promise<{ teacherId: string }> }) {
  const auth = getAuthUser(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  const { teacherId } = await params;
  if (auth.role === "teacher") {
    if (auth.id !== teacherId) {
      return NextResponse.json({ success: false, message: "Access denied." }, { status: 403 });
    }
  } else if (auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    if (auth.role === "schooladmin") {
      const teacher = await Teacher.findOne({ _id: teacherId, school: auth.schoolId });
      if (!teacher) return NextResponse.json({ success: false, message: "Teacher not found." }, { status: 404 });
    }

    const perm = await Permission.findOne({ teacher: teacherId });
    return NextResponse.json({
      success: true,
      data: perm || { teacher: teacherId, permissions: [], pages: [], assignedBy: null, updatedAt: null },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load permissions." },
      { status: 500 },
    );
  }
}

// POST /api/permissions/[teacherId] — schooladmin assigns permissions/pages.
export async function POST(req: Request, { params }: { params: Promise<{ teacherId: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { teacherId } = await params;
    const { permissions, pages } = await req.json();
    if (!Array.isArray(permissions)) {
      return NextResponse.json({ success: false, message: "permissions must be an array." }, { status: 400 });
    }

    const invalid = permissions.filter((k: string) => !(ALL_PERMISSION_KEYS as readonly string[]).includes(k));
    if (invalid.length) {
      return NextResponse.json({ success: false, message: "Invalid permission keys: " + invalid.join(", ") }, { status: 400 });
    }
    const invalidPages = (pages || []).filter((k: string) => !(ALL_PAGE_KEYS as readonly string[]).includes(k));
    if (invalidPages.length) {
      return NextResponse.json({ success: false, message: "Invalid page keys: " + invalidPages.join(", ") }, { status: 400 });
    }

    await connectDB();
    const teacher = await Teacher.findOne({ _id: teacherId, school: auth.schoolId });
    if (!teacher) return NextResponse.json({ success: false, message: "Teacher not found." }, { status: 404 });

    const perm = await Permission.findOneAndUpdate(
      { teacher: teacher._id },
      { teacher: teacher._id, school: auth.schoolId, permissions, pages: pages || [], assignedBy: auth.schoolId },
      { upsert: true, new: true },
    );

    // Sync to Teacher.permissions booleans so the existing permission-gated
    // routes (requireFeeManager, exam creation, etc.) keep working unchanged.
    teacher.permissions = permissionArrayToBooleanMap(permissions) as unknown as typeof teacher.permissions;
    await teacher.save();

    return NextResponse.json({ success: true, message: "Permissions updated.", data: perm });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to update permissions." },
      { status: 500 },
    );
  }
}
