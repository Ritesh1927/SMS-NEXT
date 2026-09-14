import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Teacher } from "@/models/Teacher";
import { Student } from "@/models/Student";
import { Parent } from "@/models/Parent";
import { formatClassName } from "@/lib/helpers";

export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const schoolId = auth.schoolId;

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);

    const [totalStudents, totalTeachers, totalParents, newStudentsThisMonth, newTeachersThisMonth, classCounts] =
      await Promise.all([
        Student.countDocuments({ school: schoolId, isActive: true }),
        Teacher.countDocuments({ school: schoolId, isActive: true }),
        Parent.countDocuments({ school: schoolId, isActive: true }),
        Student.countDocuments({ school: schoolId, isActive: true, admissionDate: { $gte: monthStart } }),
        Teacher.countDocuments({ school: schoolId, isActive: true, joiningDate: { $gte: monthStart } }),
        Student.aggregate([
          // Aggregate pipelines skip Mongoose's automatic string->ObjectId
          // casting, unlike find(), so schoolId has to be cast explicitly
          // here or this $match silently matches nothing.
          { $match: { school: new mongoose.Types.ObjectId(schoolId), isActive: true } },
          { $group: { _id: "$class", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
          { $limit: 6 },
        ]),
      ]);

    const studentsByClass = classCounts
      .filter((c) => c._id)
      .map((c) => ({ name: formatClassName(c._id), count: c.count }));

    return NextResponse.json({
      success: true,
      data: {
        stats: { totalStudents, totalTeachers, totalParents, newStudentsThisMonth, newTeachersThisMonth },
        studentsByClass,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load dashboard." },
      { status: 500 },
    );
  }
}
