import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Notice } from "@/models/Notice";

function requireAdminOrTeacher(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) return null;
  return auth;
}

const ALLOWED_FIELDS = [
  "title", "content", "category", "targetRoles", "targetClass", "isUrgent", "isPinned", "expiryDate",
] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAdminOrTeacher(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json();
    const updates: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    await connectDB();
    const notice = await Notice.findOneAndUpdate({ _id: id, school: auth.schoolId }, updates, {
      returnDocument: "after",
    }).populate("postedBy", "name");
    if (!notice) return NextResponse.json({ success: false, message: "Notice not found." }, { status: 404 });

    return NextResponse.json({ success: true, message: "Notice updated.", data: notice });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to update notice." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireAdminOrTeacher(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    const { id } = await params;
    await connectDB();
    const notice = await Notice.findOneAndDelete({ _id: id, school: auth.schoolId });
    if (!notice) return NextResponse.json({ success: false, message: "Notice not found." }, { status: 404 });

    return NextResponse.json({ success: true, message: "Notice deleted." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to delete notice." },
      { status: 500 },
    );
  }
}
