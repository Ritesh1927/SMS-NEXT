import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Class } from "@/models/Class";

// Assigns subjects to every section of a standard at once -- subjects live
// on Class.assignedSubjects (one array per section) but are conceptually
// per-standard, so writes always fan out across every Class doc sharing the
// same name. This also self-heals any sections that had drifted out of sync.
export async function POST(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { standard, subjectIds } = await req.json();
    if (!standard || !Array.isArray(subjectIds) || subjectIds.length === 0) {
      return NextResponse.json({ success: false, message: "standard and subjectIds[] are required." }, { status: 400 });
    }

    await connectDB();
    const sections = await Class.find({ school: auth.schoolId, name: standard }).select("_id");
    if (sections.length === 0) return NextResponse.json({ success: false, message: "Standard not found." }, { status: 404 });

    await Class.updateMany(
      { school: auth.schoolId, name: standard },
      { $addToSet: { assignedSubjects: { $each: subjectIds } } },
    );

    return NextResponse.json({ success: true, message: `Subjects assigned to Class ${standard}.` });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to assign subjects." },
      { status: 500 },
    );
  }
}
