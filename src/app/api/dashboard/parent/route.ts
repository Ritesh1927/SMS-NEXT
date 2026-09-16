import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Parent } from "@/models/Parent";
import "@/models/Student";

export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "parent") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const parent = await Parent.findById(auth.id).populate(
      "students",
      "name studentId class section rollNumber admissionNo photo isActive",
    );
    if (!parent) {
      return NextResponse.json({ success: false, message: "Parent not found." }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      data: {
        parent: { name: parent.name, email: parent.email, phone: parent.phone, relation: parent.relation },
        children: parent.students,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load dashboard." },
      { status: 500 },
    );
  }
}
