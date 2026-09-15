import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Teacher } from "@/models/Teacher";
import { Parent } from "@/models/Parent";
import { escapeRegex } from "@/lib/helpers";

interface UserRow {
  userId: string;
  name: string;
  email: string;
  phone?: string;
  role: "teacher" | "non-teaching" | "parent";
  isActive: boolean;
  teacherId?: string;
  createdAt: Date;
}

export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const role = searchParams.get("role") || "";
    const search = searchParams.get("search") || "";

    const users: UserRow[] = [];

    if (!role || role === "teacher") {
      const teachers = await Teacher.find({ school: auth.schoolId, staffType: "teaching" })
        .select("name email phone teacherId isActive createdAt")
        .lean();
      users.push(...(teachers.map((t) => ({ ...t, userId: String(t._id), role: "teacher" as const })) as unknown as UserRow[]));
    }

    if (!role || role === "non-teaching") {
      const staff = await Teacher.find({ school: auth.schoolId, staffType: "non-teaching" })
        .select("name email phone teacherId isActive createdAt")
        .lean();
      users.push(...(staff.map((s) => ({ ...s, userId: String(s._id), role: "non-teaching" as const })) as unknown as UserRow[]));
    }

    if (!role || role === "parent") {
      const parents = await Parent.find({ school: auth.schoolId })
        .select("name email phone isActive createdAt")
        .lean();
      users.push(...(parents.map((p) => ({ ...p, userId: String(p._id), role: "parent" as const })) as unknown as UserRow[]));
    }

    let filtered = users;
    if (search) {
      const q = new RegExp(escapeRegex(search), "i");
      filtered = users.filter((u) => q.test(u.name) || q.test(u.email) || (u.phone && q.test(u.phone)) || (u.teacherId && q.test(u.teacherId)));
    }

    filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    return NextResponse.json({ success: true, data: filtered, total: filtered.length });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load users." },
      { status: 500 },
    );
  }
}
