import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Teacher } from "@/models/Teacher";
import { Student } from "@/models/Student";
import { formatClassName } from "@/lib/helpers";

// Teacher.classes is a plain string array (no Class model exists yet to
// join against), entered by the admin as "<class>-<section>" — e.g. "5-A".
// Split on the last hyphen so class names that themselves contain one
// (unlikely here, but cheap to guard) don't get mis-parsed.
function parseClassLabel(label: string): { className: string; section: string } {
  const idx = label.lastIndexOf("-");
  if (idx === -1) return { className: label.trim(), section: "" };
  return { className: label.slice(0, idx).trim(), section: label.slice(idx + 1).trim() };
}

export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "teacher") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const teacher = await Teacher.findById(auth.id).select("-password");
    if (!teacher) {
      return NextResponse.json({ success: false, message: "Teacher not found." }, { status: 404 });
    }

    const classBreakdown = await Promise.all(
      (teacher.classes || []).map(async (label) => {
        const { className, section } = parseClassLabel(label);
        const query: Record<string, unknown> = { school: teacher.school, isActive: true, class: className };
        if (section) query.section = section;
        const count = await Student.countDocuments(query);
        return { label: formatClassName(className, section || undefined), studentCount: count };
      }),
    );

    const totalStudents = classBreakdown.reduce((sum, c) => sum + c.studentCount, 0);

    return NextResponse.json({
      success: true,
      data: {
        teacher: {
          name: teacher.name,
          teacherId: teacher.teacherId,
          designation: teacher.designation,
          subjects: teacher.subjects,
          staffType: teacher.staffType,
        },
        stats: { classCount: classBreakdown.length, totalStudents },
        classBreakdown,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load dashboard." },
      { status: 500 },
    );
  }
}
