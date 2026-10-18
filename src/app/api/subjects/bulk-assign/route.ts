import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireStaffSectionAccess } from "@/lib/auth-server";
import { Class } from "@/models/Class";

// Assigns subjects across several standards at once (e.g. "English" for
// standards 5-8) -- each standard still fans out to every one of its
// sections, same as assign/route.ts's single-standard version.
export async function POST(req: Request) {
  await connectDB();
  const gate = await requireStaffSectionAccess(req, "subjectClass", "edit");
  if ("error" in gate) return gate.error;
  const { auth } = gate;

  try {
    const { standards, subjectIds } = await req.json();
    if (!Array.isArray(standards) || standards.length === 0 || !Array.isArray(subjectIds) || subjectIds.length === 0) {
      return NextResponse.json({ success: false, message: "standards[] and subjectIds[] are required." }, { status: 400 });
    }

    await Class.updateMany(
      { school: auth.schoolId, name: { $in: standards } },
      { $addToSet: { assignedSubjects: { $each: subjectIds } } },
    );

    return NextResponse.json({ success: true, message: `${subjectIds.length} subject(s) assigned to ${standards.length} standard(s).` });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Bulk assignment failed." },
      { status: 500 },
    );
  }
}
