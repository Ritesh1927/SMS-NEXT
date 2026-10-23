import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Class } from "@/models/Class";
import { Student } from "@/models/Student";
import { Admin } from "@/models/Admin";
import { PromotionLog } from "@/models/PromotionLog";
import { resequenceRollNumbers } from "@/lib/rollNumber";
import { canPromoteClass } from "@/lib/promotionAccess";

interface StudentDecision {
  studentId: string;
  action: "promote" | "graduate" | "exclude";
  toClass?: string;
  toSection?: string;
}

// POST /api/classes/[id]/promote — applies a reviewed promotion batch.
// Every gate is re-checked here, never trusting the preview/UI; every
// studentId is re-validated against the live roster before anything is
// written. Groups "promote" decisions by their actual destination (a 10th
// class can legitimately split across several 11th sections/streams) and
// writes one PromotionLog entry per destination group, plus one for any
// graduating group.
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { id } = await params;
    const cls = await Class.findOne({ _id: id, school: auth.schoolId }).select("name section");
    if (!cls) return NextResponse.json({ success: false, message: "Class not found." }, { status: 404 });

    if (!(await canPromoteClass(auth, auth.schoolId, cls))) {
      return NextResponse.json({ success: false, message: "You don't have permission to promote this class." }, { status: 403 });
    }

    const { students } = (await req.json()) as { students: StudentDecision[] };
    if (!Array.isArray(students) || students.length === 0) {
      return NextResponse.json({ success: false, message: "No students provided." }, { status: 400 });
    }
    const promoteEntries = students.filter((s) => s.action === "promote");
    if (promoteEntries.some((s) => !s.toClass?.trim())) {
      return NextResponse.json({ success: false, message: "Every promoted student needs a target class." }, { status: 400 });
    }

    // Re-validate against the live roster -- a student who's left this
    // class+section since the preview was loaded is silently dropped rather
    // than failing the whole batch.
    const roster = await Student.find({ school: auth.schoolId, class: cls.name, section: cls.section, isActive: true }).select("name rollNumber");
    const rosterMap = new Map(roster.map((s) => [String(s._id), s]));
    const valid = students.filter((s) => rosterMap.has(s.studentId));

    const admin = await Admin.findById(auth.schoolId).select("settings.academicYear settings.yearSwitch").lean();
    const endingYear = admin?.settings?.yearSwitch?.lastSwitchedYear || admin?.settings?.academicYear || "";

    let promotedCount = 0;
    let graduatedCount = 0;
    const excluded = valid.filter((s) => s.action === "exclude");

    // Group promotions by destination -- each distinct (toClass,toSection)
    // gets its own bulk update, roll-number resequence and log entry.
    const destinations = new Map<string, { toClass: string; toSection: string; entries: StudentDecision[] }>();
    for (const s of valid) {
      if (s.action !== "promote") continue;
      const toClass = s.toClass!.trim();
      const toSection = (s.toSection || "").trim();
      const key = `${toClass}::${toSection}`;
      if (!destinations.has(key)) destinations.set(key, { toClass, toSection, entries: [] });
      destinations.get(key)!.entries.push(s);
    }

    const now = new Date();
    const fromBreadcrumb = `${cls.name}-${cls.section}`;

    for (const { toClass, toSection, entries } of destinations.values()) {
      const ids = entries.map((e) => e.studentId);
      await Student.updateMany(
        { _id: { $in: ids }, school: auth.schoolId },
        { $set: { class: toClass, section: toSection, lastPromotedAt: now, lastPromotedFromClass: fromBreadcrumb } },
      );
      await resequenceRollNumbers(auth.schoolId, toClass, toSection);
      promotedCount += ids.length;

      await PromotionLog.create({
        school: auth.schoolId,
        academicYearEnding: endingYear,
        fromClass: cls.name,
        fromSection: cls.section,
        toClass,
        toSection,
        graduated: false,
        promotedBy: auth.id,
        promotedByModel: auth.role === "schooladmin" ? "Admin" : "Teacher",
        studentsPromoted: entries.map((e) => {
          const s = rosterMap.get(e.studentId)!;
          return { student: s._id, name: s.name, fromRollNumber: s.rollNumber, toRollNumber: "" };
        }),
        studentsExcluded: [],
      });
    }

    const graduateEntries = valid.filter((s) => s.action === "graduate");
    if (graduateEntries.length > 0) {
      const ids = graduateEntries.map((e) => e.studentId);
      await Student.updateMany(
        { _id: { $in: ids }, school: auth.schoolId },
        {
          $set: {
            isActive: false,
            isGraduated: true,
            graduatedAt: now,
            graduatedYear: endingYear,
            lastPromotedAt: now,
            lastPromotedFromClass: fromBreadcrumb,
          },
        },
      );
      graduatedCount = ids.length;

      await PromotionLog.create({
        school: auth.schoolId,
        academicYearEnding: endingYear,
        fromClass: cls.name,
        fromSection: cls.section,
        toClass: "",
        toSection: "",
        graduated: true,
        promotedBy: auth.id,
        promotedByModel: auth.role === "schooladmin" ? "Admin" : "Teacher",
        studentsPromoted: graduateEntries.map((e) => {
          const s = rosterMap.get(e.studentId)!;
          return { student: s._id, name: s.name, fromRollNumber: s.rollNumber, toRollNumber: "" };
        }),
        studentsExcluded: [],
      });
    }

    if (excluded.length > 0) {
      await PromotionLog.create({
        school: auth.schoolId,
        academicYearEnding: endingYear,
        fromClass: cls.name,
        fromSection: cls.section,
        toClass: "",
        toSection: "",
        graduated: false,
        promotedBy: auth.id,
        promotedByModel: auth.role === "schooladmin" ? "Admin" : "Teacher",
        studentsPromoted: [],
        studentsExcluded: excluded.map((e) => {
          const s = rosterMap.get(e.studentId)!;
          return { student: s._id, name: s.name, reason: "Excluded by reviewer" };
        }),
      });
    }

    // Whoever's left behind in the old section needs renumbering now that
    // the promoted/graduated students have left it.
    await resequenceRollNumbers(auth.schoolId, cls.name, cls.section);

    return NextResponse.json({
      success: true,
      message: `${promotedCount} student(s) promoted, ${graduatedCount} graduated.`,
      data: { promoted: promotedCount, graduated: graduatedCount, excluded: excluded.length },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to promote students." },
      { status: 500 },
    );
  }
}
