import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Teacher } from "@/models/Teacher";
import { Parent } from "@/models/Parent";
import { Student } from "@/models/Student";
import { hashPassword } from "@/lib/helpers";

export async function PUT(req: Request, { params }: { params: Promise<{ role: string; id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { role, id } = await params;
    const { newPassword } = await req.json();
    if (!newPassword || String(newPassword).length < 6) {
      return NextResponse.json({ success: false, message: "Password must be at least 6 characters." }, { status: 400 });
    }

    await connectDB();
    const hashed = await hashPassword(newPassword);

    let userName: string | undefined;
    if (role === "teacher" || role === "non-teaching") {
      const user = await Teacher.findOne({ _id: id, school: auth.schoolId });
      if (!user) return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
      user.password = hashed;
      await user.save();
      userName = user.name;
    } else if (role === "parent") {
      const user = await Parent.findOne({ _id: id, school: auth.schoolId });
      if (!user) return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
      user.password = hashed;
      await user.save();
      userName = user.name;
    } else if (role === "student") {
      const user = await Student.findOne({ _id: id, school: auth.schoolId });
      if (!user) return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
      user.password = hashed;
      await user.save();
      userName = user.name;
    } else {
      return NextResponse.json({ success: false, message: "Invalid role." }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: `Password updated for ${userName}.` });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to update password." },
      { status: 500 },
    );
  }
}
