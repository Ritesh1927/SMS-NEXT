import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Teacher } from "@/models/Teacher";
import { Parent } from "@/models/Parent";

export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const [teachers, nonTeaching, parents] = await Promise.all([
      Teacher.countDocuments({ school: auth.schoolId, staffType: "teaching" }),
      Teacher.countDocuments({ school: auth.schoolId, staffType: "non-teaching" }),
      Parent.countDocuments({ school: auth.schoolId }),
    ]);
    return NextResponse.json({ success: true, data: { teachers, nonTeaching, parents, total: teachers + nonTeaching + parents } });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load counts." },
      { status: 500 },
    );
  }
}
