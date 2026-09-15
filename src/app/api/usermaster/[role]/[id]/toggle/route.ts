import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Teacher } from "@/models/Teacher";
import { Parent } from "@/models/Parent";
import { Student } from "@/models/Student";

export async function PATCH(req: Request, { params }: { params: Promise<{ role: string; id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { role, id } = await params;
    await connectDB();

    let userName: string;
    let isActive: boolean;
    if (role === "teacher" || role === "non-teaching") {
      const user = await Teacher.findOne({ _id: id, school: auth.schoolId });
      if (!user) return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
      user.isActive = !user.isActive;
      await user.save();
      userName = user.name;
      isActive = user.isActive;
    } else if (role === "parent") {
      const user = await Parent.findOne({ _id: id, school: auth.schoolId });
      if (!user) return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
      user.isActive = !user.isActive;
      await user.save();
      userName = user.name;
      isActive = user.isActive;
    } else if (role === "student") {
      const user = await Student.findOne({ _id: id, school: auth.schoolId });
      if (!user) return NextResponse.json({ success: false, message: "User not found." }, { status: 404 });
      user.isActive = !user.isActive;
      await user.save();
      userName = user.name;
      isActive = user.isActive;
    } else {
      return NextResponse.json({ success: false, message: "Invalid role." }, { status: 400 });
    }

    return NextResponse.json({ success: true, message: `${userName} ${isActive ? "activated" : "deactivated"}.`, isActive });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to toggle user." },
      { status: 500 },
    );
  }
}
