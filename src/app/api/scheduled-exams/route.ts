import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser, getNonTeachingStaffSections, getTeacherExtraPowers, teacherPowerAllows } from "@/lib/auth-server";
import { ScheduledExam } from "@/models/ScheduledExam";
import { Exam } from "@/models/Exam";
import { Teacher } from "@/models/Teacher";
import { Class } from "@/models/Class";
import { Admin } from "@/models/Admin";
import type { IRole } from "@/models/Role";
import { getTeacherAccessibleClasses, teacherHasAccessToClass } from "@/lib/teacherClasses";
import { calcDurationMinutes } from "@/lib/examTime";
import { postExamScheduleNotice } from "@/lib/examNotice";
import { isStreamStandard } from "@/lib/streamStandards";
import { holidayRejectionMessage } from "@/lib/holidays";

const EXAM_TYPE_MAP: Record<string, string> = {
  midterm: "mid-term",
  final: "final",
  unit: "unit-test",
  annual: "final",
};

interface SubjectInput {
  subject: string;
  date: string;
  totalMarks: number;
  startTime: string;
  endTime: string;
}

// GET /api/scheduled-exams — multi-subject exam terms. Teachers only see
// terms for classes they can access (class teacher or assignedClasses),
// matching SMS-BACKEND's scheduledexam.controller scoping.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const cls = searchParams.get("class");

    const staffSections = await getNonTeachingStaffSections(auth);
    if (staffSections && !staffSections.exams?.open) {
      return NextResponse.json({ success: false, message: "You don't have permission to do this." }, { status: 403 });
    }

    const query: Record<string, unknown> = { school: auth.schoolId };
    if (auth.role === "teacher" && !staffSections) {
      const accessible = await getTeacherAccessibleClasses(auth.id, auth.schoolId);
      const orClauses: Record<string, unknown>[] = accessible.map((c) => ({ class: c.name, section: c.section }));
      // A Power Role can let a teacher create a term for a class they don't
      // otherwise have access to -- also let them see it afterward, without
      // re-deriving the full stage-matched class list for a read path.
      orClauses.push({ createdBy: auth.id });
      query.$or = orClauses;
    } else if (cls) {
      query.class = cls;
    }

    const terms = await ScheduledExam.find(query).populate("createdBy", "name teacherId").sort({ startDate: 1 });
    return NextResponse.json({ success: true, data: terms });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load exam terms." },
      { status: 500 },
    );
  }
}

// POST /api/scheduled-exams — creates the term plus one Exam record per
// subject (each Exam.scheduledExamId points back to the term), so marks
// entry/results/publish reuse the existing single-exam routes unchanged.
export async function POST(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();

    const staffSectionsForCreate = await getNonTeachingStaffSections(auth);
    if (auth.role === "teacher" && staffSectionsForCreate && !staffSectionsForCreate.exams?.create) {
      return NextResponse.json({ success: false, message: "You don't have permission to create exams." }, { status: 403 });
    }
    // A genuine teacher's authorization (blanket canCreateExam flag AND
    // class ownership, OR a Power Role's examCreate grant) needs `cls`,
    // which isn't known until the body below is parsed -- resolved together
    // with the ownership check further down, not here.

    const { title, class: cls, section: requestedSection, examType, startDate, endDate, description, subjects } = await req.json();
    if (!title || !cls || !examType || !startDate || !endDate) {
      return NextResponse.json(
        { success: false, message: "title, class, examType, startDate and endDate are required." },
        { status: 400 },
      );
    }
    if (!Array.isArray(subjects) || subjects.length === 0) {
      return NextResponse.json(
        { success: false, message: "At least one subject with date, totalMarks and duration is required." },
        { status: 400 },
      );
    }
    // Stream standards (11/12) split into genuinely different subjects per
    // section, so a term can't span the whole standard the way it can for
    // an ordinary standard -- a section must be named explicitly.
    if (isStreamStandard(cls) && !requestedSection) {
      return NextResponse.json({ success: false, message: "Please select a section for this standard." }, { status: 400 });
    }

    // No subject's exam date may fall on a declared or weekly holiday --
    // checked per subject, since each has its own date within the term.
    const holidayConfig = (await Admin.findById(auth.schoolId).select("settings.holidays").lean())?.settings?.holidays || { weeklyOffDays: [0], dates: [] };
    for (const s of subjects as SubjectInput[]) {
      const rejection = holidayRejectionMessage(s.date, holidayConfig);
      if (rejection) return NextResponse.json({ success: false, message: `${s.subject}: ${rejection}` }, { status: 400 });
    }

    if (auth.role === "teacher" && !staffSectionsForCreate) {
      const teacher = await Teacher.findById(auth.id)
        .select("permissions staffType powerRole")
        .populate<{ powerRole: IRole | null }>("powerRole");
      const hasPower = teacherPowerAllows(await getTeacherExtraPowers(auth, teacher), "examCreate", cls);
      if (!hasPower) {
        // Preserves the exact pre-existing rule: the blanket canCreateExam
        // flag is necessary but not sufficient on its own -- a teacher still
        // needs ownership of the target class too (stricter than standalone
        // Tests, which let the blanket flag bypass ownership). A granted
        // Power Role is an independent bypass of both.
        const hasBlanket = !!teacher?.permissions?.canCreateExam;
        const hasOwnership = await teacherHasAccessToClass(auth.id, auth.schoolId, cls);
        if (!(hasBlanket && hasOwnership)) {
          return NextResponse.json({ success: false, message: "You can only create exams for your classes." }, { status: 403 });
        }
      }
    }

    // An exam is created for the whole standard, not one section -- every
    // section gets its own Exam doc per subject, all sharing this one term.
    // Unless a specific section was requested (stream standards), in which
    // case the term is scoped to that one section only.
    const sectionQuery: Record<string, unknown> = { school: auth.schoolId, name: cls };
    if (requestedSection) sectionQuery.section = requestedSection;
    const sectionDocs = await Class.find(sectionQuery).select("section");
    if (sectionDocs.length === 0) {
      return NextResponse.json(
        { success: false, message: requestedSection ? `Section ${requestedSection} not found for standard ${cls}.` : `No classes found for standard ${cls}.` },
        { status: 404 },
      );
    }
    const sections = sectionDocs.map((c) => c.section);

    const term = await ScheduledExam.create({
      school: auth.schoolId,
      title,
      class: cls,
      section: requestedSection || "",
      examType,
      startDate,
      endDate,
      description: description || "",
      createdBy: auth.id,
      createdByModel: auth.role === "schooladmin" ? "Admin" : "Teacher",
    });

    const examType_ = EXAM_TYPE_MAP[examType] || "unit-test";
    const subjectExams = await Exam.insertMany(
      sections.flatMap((section) =>
        (subjects as SubjectInput[]).map((s) => ({
          school: auth.schoolId,
          title: `${title} — ${s.subject}`,
          class: cls,
          section,
          subject: s.subject,
          date: s.date,
          startTime: s.startTime || "",
          endTime: s.endTime || "",
          totalMarks: s.totalMarks,
          passingMarks: Math.round(s.totalMarks * 0.33),
          duration: s.startTime && s.endTime ? calcDurationMinutes(s.startTime, s.endTime) : null,
          examType: examType_,
          createdBy: auth.id,
          createdByModel: auth.role === "schooladmin" ? "Admin" : "Teacher",
          status: "upcoming",
          scheduledExamId: term._id,
        })),
      ),
    );

    if ((subjects as SubjectInput[]).every((s) => s.startTime && s.endTime)) {
      await postExamScheduleNotice({
        schoolId: auth.schoolId,
        cls,
        examName: title,
        rows: (subjects as SubjectInput[]).map((s) => ({ subject: s.subject, date: s.date, startTime: s.startTime, endTime: s.endTime })),
        postedBy: auth.id,
        postedByModel: auth.role === "schooladmin" ? "Admin" : "Teacher",
      });
    }

    const populated = await ScheduledExam.findById(term._id).populate("createdBy", "name teacherId");
    return NextResponse.json(
      { success: true, message: "Exam term created.", data: { ...populated!.toObject(), subjects: subjectExams } },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to create exam term." },
      { status: 500 },
    );
  }
}
