import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser, getNonTeachingStaffSections, getTeacherExtraPowers, teacherPowerAllows } from "@/lib/auth-server";
import { Student } from "@/models/Student";
import { AttendanceYearSummary } from "@/models/AttendanceYearSummary";
import { Teacher } from "@/models/Teacher";
import "@/models/Role";
import type { IRole } from "@/models/Role";
import { isClassTeacherOfSection } from "@/lib/teacherClasses";

// GET /api/attendance/previous-years?studentId=&year= — a student's
// compacted yearly attendance summary for a year that's already ended (see
// AttendanceYearSummary, written once at year-switch time). Admin always;
// non-teaching staff via their existing attendance.view grant; a genuine
// teacher only via class-teacher identity of the student's CURRENT class or
// the new viewPastYears Power scoped to it -- unlike the current-year
// per-student lookup (/api/attendance/student/[id]), which has no
// class-ownership restriction, past-year data is deliberately gated behind
// this new, narrower permission per the feature's own spec.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const studentId = searchParams.get("studentId");
    const year = searchParams.get("year");
    if (!studentId || !year) {
      return NextResponse.json({ success: false, message: "studentId and year are required." }, { status: 400 });
    }

    const student = await Student.findOne({ _id: studentId, school: auth.schoolId }).select("name class section rollNumber");
    if (!student) return NextResponse.json({ success: false, message: "Student not found." }, { status: 404 });

    let allowed = auth.role === "schooladmin";
    if (!allowed) {
      const staffSections = await getNonTeachingStaffSections(auth);
      if (staffSections) {
        allowed = staffSections.attendance?.view === true;
      } else {
        if (await isClassTeacherOfSection(auth.id, auth.schoolId, student.class, student.section)) {
          allowed = true;
        } else {
          const teacher = await Teacher.findById(auth.id)
            .select("staffType powerRole")
            .populate<{ powerRole: IRole | null }>("powerRole");
          const powers = await getTeacherExtraPowers(auth, teacher);
          allowed = teacherPowerAllows(powers, "viewPastYears", student.class);
        }
      }
    }
    if (!allowed) {
      return NextResponse.json({ success: false, message: "You don't have permission to view past-year attendance." }, { status: 403 });
    }

    const summary = await AttendanceYearSummary.findOne({ school: auth.schoolId, studentId, academicYear: year });

    return NextResponse.json({
      success: true,
      data: {
        student: { id: String(student._id), name: student.name, rollNumber: student.rollNumber },
        summary: summary
          ? {
              academicYear: summary.academicYear,
              classAtYearEnd: summary.classAtYearEnd,
              sectionAtYearEnd: summary.sectionAtYearEnd,
              totalDays: summary.totalDays,
              presentDays: summary.presentDays,
              percentage: summary.percentage,
            }
          : null,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load past-year attendance." },
      { status: 500 },
    );
  }
}
