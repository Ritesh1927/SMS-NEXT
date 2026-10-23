import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser, getNonTeachingStaffSections, getTeacherExtraPowers, teacherPowerAllows } from "@/lib/auth-server";
import { Student } from "@/models/Student";
import { AttendanceYearSummary } from "@/models/AttendanceYearSummary";
import { Teacher } from "@/models/Teacher";
import { Class } from "@/models/Class";
import "@/models/Role";
import type { IRole, ITeacherPowers } from "@/models/Role";
import { isClassTeacherOfSection } from "@/lib/teacherClasses";

// GET /api/attendance/previous-years?year= — every student's compacted
// yearly attendance summary for a year that's already ended (see
// AttendanceYearSummary, written once at year-switch time), filtered to
// whatever the requester is allowed to see. The class filter the UI offers
// is applied client-side against classAtYearEnd/sectionAtYearEnd already on
// each row -- "who was in class 5 THAT year," not who's in class 5 today.
//
// GET /api/attendance/previous-years?studentId=&year= — the single-row
// variant (kept for a future direct deep link; the Attendance page's
// Previous Years tab no longer needs it now that the list above already
// carries every row's full summary).
//
// Same gate either way: admin always; non-teaching staff via their existing
// attendance.view grant; a genuine teacher only via class-teacher identity
// of the student's CURRENT class or the new viewPastYears Power scoped to
// it -- unlike the current-year per-student lookup
// (/api/attendance/student/[id]), which has no class-ownership restriction,
// past-year data is deliberately gated behind this new, narrower
// permission per the feature's own spec.
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
    if (!year) {
      return NextResponse.json({ success: false, message: "year is required." }, { status: 400 });
    }

    if (studentId) {
      const student = await Student.findOne({ _id: studentId, school: auth.schoolId }).select("name class section rollNumber");
      if (!student) return NextResponse.json({ success: false, message: "Student not found." }, { status: 404 });

      let allowed = auth.role === "schooladmin";
      if (!allowed) {
        const staffSections = await getNonTeachingStaffSections(auth);
        if (staffSections) {
          allowed = staffSections.attendance?.view === true;
        } else if (await isClassTeacherOfSection(auth.id, auth.schoolId, student.class, student.section)) {
          allowed = true;
        } else {
          const teacher = await Teacher.findById(auth.id)
            .select("staffType powerRole")
            .populate<{ powerRole: IRole | null }>("powerRole");
          const powers = await getTeacherExtraPowers(auth, teacher);
          allowed = teacherPowerAllows(powers, "viewPastYears", student.class);
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
    }

    // List mode: every summary row for this year, filtered to what the
    // requester can see. The per-row rule is identical to the single-row
    // branch above, just resolved once up front instead of per student to
    // avoid an N+1 query pattern.
    const summaries = await AttendanceYearSummary.find({ school: auth.schoolId, academicYear: year })
      .populate<{ studentId: { _id: string; name: string; class: string; section: string; rollNumber: string } | null }>(
        "studentId",
        "name class section rollNumber",
      )
      .lean();
    const rows = summaries.filter((s) => s.studentId);

    let allowAll = auth.role === "schooladmin";
    let classTeacherSet: Set<string> | null = null;
    let powers: ITeacherPowers | null = null;
    if (!allowAll) {
      const staffSections = await getNonTeachingStaffSections(auth);
      if (staffSections) {
        allowAll = staffSections.attendance?.view === true;
      } else {
        const ownClasses = await Class.find({ school: auth.schoolId, classTeacher: auth.id }).select("name section").lean();
        classTeacherSet = new Set(ownClasses.map((c) => `${c.name}::${c.section}`));
        const teacher = await Teacher.findById(auth.id)
          .select("staffType powerRole")
          .populate<{ powerRole: IRole | null }>("powerRole");
        powers = await getTeacherExtraPowers(auth, teacher);
      }
    }

    const visible = allowAll
      ? rows
      : rows.filter((s) => {
          const student = s.studentId!;
          if (classTeacherSet?.has(`${student.class}::${student.section}`)) return true;
          return teacherPowerAllows(powers, "viewPastYears", student.class);
        });

    return NextResponse.json({
      success: true,
      data: visible.map((s) => ({
        studentId: String(s.studentId!._id),
        name: s.studentId!.name,
        rollNumber: s.studentId!.rollNumber,
        classAtYearEnd: s.classAtYearEnd,
        sectionAtYearEnd: s.sectionAtYearEnd,
        totalDays: s.totalDays,
        presentDays: s.presentDays,
        percentage: s.percentage,
      })),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load past-year attendance." },
      { status: 500 },
    );
  }
}
