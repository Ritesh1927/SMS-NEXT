import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { getCurrentAcademicYear } from "@/lib/academicYear";
import { Admin } from "@/models/Admin";
import { Student } from "@/models/Student";
import { AttendanceRecord } from "@/models/AttendanceRecord";
import { AttendanceYearSummary } from "@/models/AttendanceYearSummary";
import { Exam } from "@/models/Exam";
import { Result } from "@/models/Result";
import { Homework } from "@/models/Homework";
import { StudyMaterial } from "@/models/StudyMaterial";
import { Notice } from "@/models/Notice";
import { deleteAsset } from "@/lib/cloudinary";
import { postYearSwitchNotice } from "@/lib/yearSwitchNotice";

function requireSchoolAdmin(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") return null;
  return auth;
}

// The next consecutive label after "2025-2026" is "2026-2027" -- advancing
// is always a +1 on both halves of the stored label, independent of
// today's date or sessionStartMonth. The year only ever moves when an
// admin runs this switch, never automatically.
function nextAcademicYear(current: string): string {
  const [start, end] = current.split("-").map(Number);
  return `${start + 1}-${end + 1}`;
}

// GET /api/school/year-switch — preview only, no mutation. Real counts of
// what a switch right now would do, for the confirmation wizard's
// consequences screen.
export async function GET(req: Request) {
  const auth = requireSchoolAdmin(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    await connectDB();
    const schoolId = auth.schoolId;
    const currentYear = await getCurrentAcademicYear(schoolId);

    const [attendanceRecords, distinctStudentsWithAttendance, totalStudents, standaloneExams, homeworkCount, studyMaterialCount, noticeCount] =
      await Promise.all([
        AttendanceRecord.countDocuments({ school: schoolId }),
        AttendanceRecord.distinct("studentId", { school: schoolId }),
        Student.countDocuments({ school: schoolId }),
        Exam.find({ school: schoolId, scheduledExamId: null, academicYear: { $in: [currentYear, ""] } }).select("_id"),
        Homework.countDocuments({ school: schoolId }),
        StudyMaterial.countDocuments({ school: schoolId }),
        Notice.countDocuments({ school: schoolId }),
      ]);

    const testIds = standaloneExams.map((e) => e._id);
    const testResultCount = testIds.length > 0 ? await Result.countDocuments({ school: schoolId, exam: { $in: testIds } }) : 0;

    return NextResponse.json({
      success: true,
      data: {
        currentYear,
        nextYear: nextAcademicYear(currentYear),
        attendanceRecords,
        studentsWithAttendance: distinctStudentsWithAttendance.length,
        studentsAffected: totalStudents,
        tests: testIds.length,
        testResults: testResultCount,
        homework: homeworkCount,
        studyMaterials: studyMaterialCount,
        notices: noticeCount,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load year-switch preview." },
      { status: 500 },
    );
  }
}

// POST /api/school/year-switch — the switch itself. Permanently deletes a
// full year of leaderboard/homework/study-material/notice/test data,
// compacts the ending year's attendance to one yearly % per student, and
// advances the stored current academic year. Irreversible -- gated on the
// admin typing the current year back exactly, same spirit as a typed
// "DELETE" confirmation elsewhere in this app.
export async function POST(req: Request) {
  const auth = requireSchoolAdmin(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    await connectDB();
    const schoolId = auth.schoolId;
    const currentYear = await getCurrentAcademicYear(schoolId);

    const { confirmationText, classTeacherPromotionAllowed, powerRoleTeacherPromotionAllowed } = await req.json();
    if (confirmationText !== currentYear) {
      return NextResponse.json({ success: false, message: `Type "${currentYear}" exactly to confirm.` }, { status: 400 });
    }

    // Cloudinary isn't transactional and shouldn't hold the DB transaction
    // open while it runs -- clean up attachments first, outside any
    // session, best-effort (deleteAsset already swallows its own errors).
    const [homeworksWithAttachments, materialsWithFiles] = await Promise.all([
      Homework.find({ school: schoolId, attachmentPublicId: { $ne: "" } }).select("attachmentPublicId"),
      StudyMaterial.find({ school: schoolId, filePublicId: { $ne: "" } }).select("filePublicId"),
    ]);
    await Promise.all([
      ...homeworksWithAttachments.map((h) => deleteAsset(h.attachmentPublicId, "raw")),
      ...materialsWithFiles.map((m) => deleteAsset(m.filePublicId, "raw")),
    ]);

    const nextYear = nextAcademicYear(currentYear);
    const session = await mongoose.startSession();
    let summary: Record<string, number> = {};

    try {
      await session.withTransaction(async () => {
        // 1. Compact this year's attendance to one row per student, then
        // delete the daily records -- current year only ever holds the
        // live year's rows by construction (past years were already
        // compacted away by a prior switch), so an unscoped-by-date,
        // school-scoped query over AttendanceRecord IS "this year's" data.
        // Sequential, not Promise.all -- a ClientSession can only have one
        // operation in flight at a time; running 2 session-bound queries
        // concurrently throws a "ConflictingOperationInProgress" server error.
        const students = await Student.find({ school: schoolId }).select("class section").session(session);
        const records = await AttendanceRecord.find({ school: schoolId }).select("studentId status").session(session);
        const counts = new Map<string, { present: number; total: number }>();
        for (const rec of records) {
          const sid = String(rec.studentId);
          const entry = counts.get(sid) || { present: 0, total: 0 };
          entry.total += 1;
          if (rec.status === "present" || rec.status === "late") entry.present += 1;
          counts.set(sid, entry);
        }
        const summaryDocs = students
          .filter((s) => counts.has(String(s._id)))
          .map((s) => {
            const c = counts.get(String(s._id))!;
            return {
              school: schoolId,
              studentId: s._id,
              academicYear: currentYear,
              classAtYearEnd: s.class,
              sectionAtYearEnd: s.section,
              totalDays: c.total,
              presentDays: c.present,
              percentage: c.total > 0 ? Math.round((c.present / c.total) * 100) : 0,
            };
          });
        if (summaryDocs.length > 0) await AttendanceYearSummary.insertMany(summaryDocs, { session });
        const attendanceDeleted = await AttendanceRecord.deleteMany({ school: schoolId }, { session });

        // 2. Standalone Tests tagged with the ending year (+ legacy
        // untagged docs) and their Results.
        const standaloneExams = await Exam.find({ school: schoolId, scheduledExamId: null, academicYear: { $in: [currentYear, ""] } })
          .select("_id")
          .session(session);
        const examIds = standaloneExams.map((e) => e._id);
        const resultsDeleted =
          examIds.length > 0 ? await Result.deleteMany({ school: schoolId, exam: { $in: examIds } }, { session }) : { deletedCount: 0 };
        const examsDeleted =
          examIds.length > 0 ? await Exam.deleteMany({ _id: { $in: examIds } }, { session }) : { deletedCount: 0 };

        // 3/4/5. Flush Homework, Study Materials, Notices.
        const homeworkDeleted = await Homework.deleteMany({ school: schoolId }, { session });
        const studyMaterialsDeleted = await StudyMaterial.deleteMany({ school: schoolId }, { session });
        const noticesDeleted = await Notice.deleteMany({ school: schoolId }, { session });

        // 6. Reset the leaderboard for the new year.
        const studentsReset = await Student.updateMany(
          { school: schoolId },
          { $set: { points: 0, badges: [], streakDays: 0, lastAttendance: null } },
          { session },
        );

        // 7. Advance the stored current year + record the switch.
        await Admin.findByIdAndUpdate(
          schoolId,
          {
            $set: {
              "settings.academicYear": nextYear,
              "settings.yearSwitch.classTeacherPromotionAllowed": !!classTeacherPromotionAllowed,
              "settings.yearSwitch.powerRoleTeacherPromotionAllowed": !!powerRoleTeacherPromotionAllowed,
              "settings.yearSwitch.lastSwitchedAt": new Date(),
              "settings.yearSwitch.lastSwitchedYear": currentYear,
            },
            $push: { "settings.pastAcademicYears": { $each: [currentYear], $position: 0 } },
          },
          { session },
        );

        summary = {
          attendanceRecordsCompacted: attendanceDeleted.deletedCount,
          attendanceSummariesWritten: summaryDocs.length,
          testsDeleted: examsDeleted.deletedCount,
          testResultsDeleted: resultsDeleted.deletedCount,
          homeworkDeleted: homeworkDeleted.deletedCount,
          studyMaterialsDeleted: studyMaterialsDeleted.deletedCount,
          noticesDeleted: noticesDeleted.deletedCount,
          studentsReset: studentsReset.modifiedCount,
        };
      });
    } finally {
      await session.endSession();
    }

    // Best-effort, after the transaction has committed -- a notice failure
    // must never undo or fail the switch itself.
    await postYearSwitchNotice({
      schoolId,
      previousYear: currentYear,
      nextYear,
      classTeacherPromotionAllowed: !!classTeacherPromotionAllowed,
      powerRoleTeacherPromotionAllowed: !!powerRoleTeacherPromotionAllowed,
    });

    return NextResponse.json({
      success: true,
      message: `Switched from ${currentYear} to ${nextYear}.`,
      data: { previousYear: currentYear, currentYear: nextYear, ...summary },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to switch educational year." },
      { status: 500 },
    );
  }
}
