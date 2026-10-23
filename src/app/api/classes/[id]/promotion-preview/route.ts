import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Class } from "@/models/Class";
import { Student } from "@/models/Student";
import { canPromoteClass } from "@/lib/promotionAccess";
import { suggestNextClass } from "@/lib/promotion";

// GET /api/classes/[id]/promotion-preview — the roster of this class+section
// with a suggested target class/section per student (never auto-applied;
// the review dialog lets every row be edited or excluded before POSTing).
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { id } = await params;
    const cls = await Class.findOne({ _id: id, school: auth.schoolId }).select("name section");
    if (!cls) return NextResponse.json({ success: false, message: "Class not found." }, { status: 404 });

    if (!(await canPromoteClass(auth, auth.schoolId, cls))) {
      return NextResponse.json({ success: false, message: "You don't have permission to promote this class." }, { status: 403 });
    }

    const suggestion = suggestNextClass(cls.name, cls.section);
    const students = await Student.find({ school: auth.schoolId, class: cls.name, section: cls.section, isActive: true })
      .collation({ locale: "en" })
      .sort({ name: 1 })
      .select("name rollNumber");

    return NextResponse.json({
      success: true,
      data: {
        fromClass: cls.name,
        fromSection: cls.section,
        suggestion,
        students: students.map((s) => ({ id: String(s._id), name: s.name, rollNumber: s.rollNumber })),
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load promotion preview." },
      { status: 500 },
    );
  }
}
