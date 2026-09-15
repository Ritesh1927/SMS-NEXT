import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth-server";
import { School } from "@/models/School";
import { Teacher } from "@/models/Teacher";
import { Student } from "@/models/Student";
import { Parent } from "@/models/Parent";

export async function GET(req: Request) {
  const auth = requireSuperAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    await connectDB();
    const [totalSchools, activeSchools, totalTeachers, totalStudents, totalParents] = await Promise.all([
      School.countDocuments(),
      School.countDocuments({ isActive: true }),
      Teacher.countDocuments(),
      Student.countDocuments(),
      Parent.countDocuments(),
    ]);

    return NextResponse.json({
      success: true,
      data: { totalSchools, activeSchools, totalTeachers, totalStudents, totalParents },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load stats." },
      { status: 500 },
    );
  }
}
