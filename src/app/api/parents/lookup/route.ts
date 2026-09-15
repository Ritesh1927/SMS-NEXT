import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Parent } from "@/models/Parent";
import { Student } from "@/models/Student";

// GET /api/parents/lookup?email= — used by the Student form to check
// whether a parent email already belongs to an existing parent in this
// school, so the Parent/Guardian fields can be auto-filled for a second
// (or later) child instead of retyping them and risking a duplicate
// parent record. Read-only, no password in the response.
//
// Address and emergency contact live on Student, not Parent (a family
// could technically give different ones per child), so those come from
// that parent's most recently added child as a same-household best guess
// — the admin can still edit any auto-filled field before saving.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const email = searchParams.get("email")?.trim().toLowerCase();
    if (!email) {
      return NextResponse.json({ success: false, message: "Email is required." }, { status: 400 });
    }

    await connectDB();
    const parent = await Parent.findOne({ email, school: auth.schoolId }).select(
      "name motherName motherPhone phone relation",
    );

    if (!parent) {
      return NextResponse.json({ success: true, found: false });
    }

    const latestSibling = await Student.findOne({ parent: parent._id, school: auth.schoolId })
      .select("address emergencyContact emergencyPhone emergencyRelation religion category")
      .sort({ createdAt: -1 });

    return NextResponse.json({
      success: true,
      found: true,
      data: {
        name: parent.name,
        motherName: parent.motherName,
        motherPhone: parent.motherPhone,
        phone: parent.phone,
        relation: parent.relation,
        address: latestSibling?.address || "",
        emergencyContact: latestSibling?.emergencyContact || "",
        emergencyPhone: latestSibling?.emergencyPhone || "",
        emergencyRelation: latestSibling?.emergencyRelation || "",
        religion: latestSibling?.religion || "",
        category: latestSibling?.category || "",
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to look up parent." },
      { status: 500 },
    );
  }
}
