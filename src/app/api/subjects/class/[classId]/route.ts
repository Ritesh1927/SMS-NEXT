import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Class } from "@/models/Class";
import "@/models/Subject";

// GET /api/subjects/class/[classId] — subjects assigned to one class. Used
// by the Homework/Timetable/Study Materials "pick a subject" dropdowns
// (teacher and admin both need this to build their assign/upload forms).
export async function GET(req: Request, { params }: { params: Promise<{ classId: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { classId } = await params;
    await connectDB();

    const cls = await Class.findOne({ _id: classId, school: auth.schoolId }).populate("assignedSubjects", "name code description");
    if (!cls) return NextResponse.json({ success: false, message: "Class not found." }, { status: 404 });

    return NextResponse.json({ success: true, data: cls.assignedSubjects || [] });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load subjects." },
      { status: 500 },
    );
  }
}
