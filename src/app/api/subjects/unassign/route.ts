import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Class } from "@/models/Class";

// Mirrors assign/route.ts: removes a subject from every section of a
// standard at once, since subjects are assigned per-standard. An optional
// `section` scopes the removal to that one section instead (stream standards).
export async function DELETE(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { standard, subjectId, section } = await req.json();
    if (!standard || !subjectId) {
      return NextResponse.json({ success: false, message: "standard and subjectId are required." }, { status: 400 });
    }

    await connectDB();
    const query: Record<string, unknown> = { school: auth.schoolId, name: standard };
    if (section) query.section = section;

    const sections = await Class.find(query).select("_id");
    if (sections.length === 0) {
      return NextResponse.json({ success: false, message: section ? "Section not found." : "Standard not found." }, { status: 404 });
    }

    await Class.updateMany(query, { $pull: { assignedSubjects: subjectId } });

    return NextResponse.json({ success: true, message: `Subject removed from Class ${standard}${section ? `-${section}` : ""}.` });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to remove subject." },
      { status: 500 },
    );
  }
}
