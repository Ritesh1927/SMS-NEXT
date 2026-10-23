import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireFeeAccess, getNonTeachingStaffSections } from "@/lib/auth-server";
import { getCurrentAcademicYear } from "@/lib/academicYear";
import { AttendanceYearSummary } from "@/models/AttendanceYearSummary";
import "@/models/Student";

// GET /api/fees/reports/past-year-roster?academicYear= — every student
// enrolled during a past educational year, with the class/section they were
// in at the time. Powers the Student Ledger's past-year class filter and
// student search -- sourced from AttendanceYearSummary (the only place this
// app retains a per-year class record), same technique as the Attendance
// page's own Previous Years tab, but gated on the Fees section's own
// viewPastYears grant specifically, since fees and attendance visibility
// are independent permission grants by design.
export async function GET(req: Request) {
  const result = await requireFeeAccess(req, "view");
  if ("error" in result) return result.error;
  const { auth, isAdmin } = result;

  try {
    await connectDB();
    const academicYear = new URL(req.url).searchParams.get("academicYear");
    if (!academicYear) {
      return NextResponse.json({ success: false, message: "academicYear is required." }, { status: 400 });
    }

    // Non-teaching staff need the extra specifically for a year other than
    // the stored current one; a genuine teacher's existing blanket
    // canManageFees flag (already checked above by requireFeeAccess) is
    // untouched either way -- fees stays out of scope for teachers
    // regardless of year, same as the analytics/finance report routes.
    if (!isAdmin) {
      const currentYear = await getCurrentAcademicYear(auth.schoolId);
      if (academicYear !== currentYear) {
        const staffSections = await getNonTeachingStaffSections(auth);
        if (staffSections && !staffSections.fees?.extras?.viewPastYears) {
          return NextResponse.json({ success: false, message: "You don't have permission to view past-year fee data." }, { status: 403 });
        }
      }
    }

    const summaries = await AttendanceYearSummary.find({ school: auth.schoolId, academicYear })
      .populate<{ studentId: { _id: string; name: string; studentId: string; rollNumber: string } | null }>(
        "studentId",
        "name studentId rollNumber",
      )
      .lean();

    const data = summaries
      .filter((s) => s.studentId)
      .map((s) => ({
        id: String(s.studentId!._id),
        name: s.studentId!.name,
        code: s.studentId!.studentId,
        rollNumber: s.studentId!.rollNumber,
        class: s.classAtYearEnd,
        section: s.sectionAtYearEnd,
      }));

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load past-year roster." },
      { status: 500 },
    );
  }
}
