import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { AttendanceRecord } from "@/models/AttendanceRecord";
import { Parent } from "@/models/Parent";

// GET /api/attendance/student/[studentId]?month&year — one student's
// attendance history and summary. Schooladmin/teacher can view any student
// in their school; a parent only their own linked children.
export async function GET(req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const auth = getAuthUser(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    const { studentId } = await params;
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month");
    const year = searchParams.get("year");

    await connectDB();

    if (auth.role === "parent") {
      const parentDoc = await Parent.findById(auth.id);
      const childIds = (parentDoc?.students || []).map((id) => String(id));
      if (!childIds.includes(studentId)) {
        return NextResponse.json({ success: false, message: "Access denied." }, { status: 403 });
      }
    } else if (auth.role !== "schooladmin" && auth.role !== "teacher") {
      return NextResponse.json({ success: false, message: "Access denied." }, { status: 403 });
    }

    const query: Record<string, unknown> = { school: auth.schoolId, studentId };
    if (month && year) {
      query.date = {
        $gte: new Date(Number(year), Number(month) - 1, 1),
        $lte: new Date(Number(year), Number(month), 0, 23, 59, 59),
      };
    }

    const records = await AttendanceRecord.find(query).sort({ date: -1 }).populate("classId", "name section");

    const total = records.length;
    const present = records.filter((r) => r.status === "present").length;
    const absent = records.filter((r) => r.status === "absent").length;
    const late = records.filter((r) => r.status === "late").length;
    const percentage = total > 0 ? Math.round(((present + late) / total) * 100) : 0;

    return NextResponse.json({
      success: true,
      data: {
        records: records.map((r) => {
          const cls = r.classId as unknown as { name: string; section: string } | null;
          return {
            _id: r._id,
            date: r.date,
            status: r.status,
            markedBy: r.markedBy,
            class: cls ? `${cls.name}-${cls.section}` : "",
          };
        }),
        summary: { total, present, absent, late, percentage },
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load attendance." },
      { status: 500 },
    );
  }
}
