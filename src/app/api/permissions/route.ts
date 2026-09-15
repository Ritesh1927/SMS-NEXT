import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Teacher } from "@/models/Teacher";
import { Permission } from "@/models/Permission";
import { ALL_PERMISSION_KEYS } from "@/lib/permissions";

// GET /api/permissions — schooladmin gets every teaching-staff member with
// their current permissions/pages, for the Roles & Permissions list view.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const teachers = await Teacher.find({ school: auth.schoolId, staffType: "teaching" })
      .select("name email teacherId permissions")
      .lean();

    const permDocs = await Permission.find({ school: auth.schoolId }).lean();
    const permMap = new Map(permDocs.map((p) => [String(p.teacher), { permissions: p.permissions, pages: p.pages || [] }]));

    const data = teachers.map((t) => {
      const saved = permMap.get(String(t._id));
      return {
        teacher: { _id: t._id, name: t.name, email: t.email, teacherId: t.teacherId },
        permissions: saved?.permissions || ALL_PERMISSION_KEYS.filter((k) => t.permissions?.[k as keyof typeof t.permissions]),
        pages: saved?.pages || [],
      };
    });

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load permissions." },
      { status: 500 },
    );
  }
}
