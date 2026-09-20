import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Class } from "@/models/Class";
import "@/models/Subject";

// GET /api/subjects/standard/[name] — subjects assigned to a whole standard
// (e.g. "7"), independent of section. Mirrors /api/subjects/class/[classId]
// but keyed by standard name -- used by the "New Exam" picker, which targets
// a standard rather than one section. Every section of a standard carries an
// identical assignedSubjects list (kept in sync by the assign/unassign
// routes), so any one section's Class doc is authoritative.
export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { name } = await params;
    await connectDB();

    const cls = await Class.findOne({ school: auth.schoolId, name: decodeURIComponent(name) }).populate(
      "assignedSubjects",
      "name code description",
    );
    if (!cls) return NextResponse.json({ success: false, message: "Standard not found." }, { status: 404 });

    return NextResponse.json({ success: true, data: cls.assignedSubjects || [] });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load subjects." },
      { status: 500 },
    );
  }
}
