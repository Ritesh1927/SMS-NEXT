import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Parent } from "@/models/Parent";
import { Student } from "@/models/Student";

function requireSchoolAdmin(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") return null;
  return auth;
}

const ALLOWED_FIELDS = [
  "name", "motherName", "motherPhone", "phone", "alternatePhone", "address", "occupation", "motherOccupation", "relation", "isActive",
] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireSchoolAdmin(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json();
    const updates: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    await connectDB();
    const parent = await Parent.findOneAndUpdate({ _id: id, school: auth.schoolId }, updates, {
      returnDocument: "after",
    })
      .select("-password")
      .populate("students", "name studentId class section");
    if (!parent) return NextResponse.json({ success: false, message: "Parent not found." }, { status: 404 });

    return NextResponse.json({ success: true, message: "Parent updated.", data: parent });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to update parent." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireSchoolAdmin(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    const { id } = await params;
    await connectDB();

    const parent = await Parent.findOne({ _id: id, school: auth.schoolId });
    if (!parent) return NextResponse.json({ success: false, message: "Parent not found." }, { status: 404 });

    // No Fee model yet to check for payment history — SMS-BACKEND blocks
    // deletion on that too, but here an active-child check is the only
    // guard available.
    const activeChildren = await Student.countDocuments({ parent: parent._id, school: auth.schoolId, isActive: true });
    if (activeChildren > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Cannot delete "${parent.name}" — has ${activeChildren} active child. Deactivate instead.`,
          code: "HAS_TRANSACTIONS",
        },
        { status: 409 },
      );
    }

    await Student.updateMany({ parent: parent._id, school: auth.schoolId }, { isActive: false });
    await Parent.findOneAndDelete({ _id: id, school: auth.schoolId });

    return NextResponse.json({ success: true, message: `"${parent.name}" deleted.` });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to delete parent." },
      { status: 500 },
    );
  }
}
