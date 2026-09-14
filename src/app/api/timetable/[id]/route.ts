import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { TimetableEntry } from "@/models/TimetableEntry";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { id } = await params;
    const entry = await TimetableEntry.findOne({ _id: id, school: auth.schoolId });
    if (!entry) return NextResponse.json({ success: false, message: "Entry not found." }, { status: 404 });

    await entry.deleteOne();
    return NextResponse.json({ success: true, message: "Entry deleted." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to delete entry." },
      { status: 500 },
    );
  }
}
