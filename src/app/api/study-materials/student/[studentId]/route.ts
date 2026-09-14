import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { StudyMaterial } from "@/models/StudyMaterial";
import { Student } from "@/models/Student";
import { Parent } from "@/models/Parent";
// Side-effect imports so the dynamic uploadedBy ref (refPath: uploaderModel,
// "Teacher" | "Admin") can populate — this route never queries either model
// directly otherwise, and without this, populate() throws "Schema hasn't
// been registered for model" the same way it did for timetable's refs.
import "@/models/Teacher";
import "@/models/Admin";

// GET /api/study-materials/student/[studentId] — a parent's view of one
// child's materials. SMS-BACKEND's getMaterials assumes the caller IS the
// student (req.user.class/section); here a parent looks it up on behalf of
// their (ownership-checked) child instead, same substitution as
// homework/timetable's parent routes. Materials with section: "" apply to
// every section of that class, matching the original's OR logic.
export async function GET(req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "parent") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { studentId } = await params;
    await connectDB();

    const parentDoc = await Parent.findById(auth.id).select("students");
    const owns = parentDoc?.students?.some((s) => String(s) === studentId);
    if (!owns) {
      return NextResponse.json({ success: false, message: "Access denied." }, { status: 403 });
    }

    const student = await Student.findById(studentId).select("class section");
    if (!student) return NextResponse.json({ success: false, message: "Student not found." }, { status: 404 });

    const query: Record<string, unknown> = { school: auth.schoolId, class: student.class };
    if (student.section) query.$or = [{ section: student.section }, { section: "" }];

    const materials = await StudyMaterial.find(query).populate("uploadedBy", "name teacherId").sort({ createdAt: -1 });
    return NextResponse.json({ success: true, count: materials.length, data: materials });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load materials." },
      { status: 500 },
    );
  }
}
