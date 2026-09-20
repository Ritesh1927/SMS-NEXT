import { Notice } from "@/models/Notice";

const DEFAULT_EXAM_GUIDELINES = [
  "Arrive at least 15 minutes before the scheduled start time.",
  "Bring your own stationery — sharing is not permitted during the exam.",
  "Mobile phones and other smart devices are not allowed in the exam hall.",
  "Carry your school ID card to every exam.",
  "Any form of malpractice will lead to disciplinary action.",
];

interface ExamNoticeRow {
  subject: string;
  date: string;
  startTime: string;
  endTime: string;
}

function formatDate(d: string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

// Auto-posts the "concerned parents and teachers" notice for a newly
// created Test/Exam, scoped to the class via the same targetRoles:
// ["student"] + targetClasses mechanism the Notices feature already
// filters on (parent with a child in the class, or teacher who is its
// class/subject teacher). Deliberately best-effort: a notice failure must
// never fail the exam/test creation it's a side effect of.
export async function postExamScheduleNotice(opts: {
  schoolId: string;
  cls: string;
  examName: string;
  rows: ExamNoticeRow[];
  postedBy: string;
  postedByModel: "Admin" | "Teacher";
}) {
  if (opts.rows.length === 0) return;
  try {
    const sorted = [...opts.rows].sort((a, b) => a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime));
    const startDate = sorted[0].date;
    const endDate = sorted[sorted.length - 1].date;
    const lines = [
      `The schedule for "${opts.examName}" (Class ${opts.cls}) has been published.`,
      startDate === endDate ? `Date: ${formatDate(startDate)}` : `Duration: ${formatDate(startDate)} to ${formatDate(endDate)}`,
      "",
      ...sorted.map((r) => `- ${r.subject}: ${formatDate(r.date)}, ${r.startTime}–${r.endTime}`),
    ];

    await Notice.create({
      school: opts.schoolId,
      title: `Exam Schedule: ${opts.examName}`,
      content: lines.join("\n"),
      category: "exam",
      targetRoles: ["student"],
      classScope: "custom",
      targetClasses: [opts.cls],
      examSchedule: {
        examName: opts.examName,
        startDate,
        endDate,
        guidelines: DEFAULT_EXAM_GUIDELINES,
        rows: sorted,
      },
      postedBy: opts.postedBy,
      postedByModel: opts.postedByModel,
      isUrgent: false,
      isPinned: false,
      expiryDate: null,
    });
  } catch {
    // swallow — see note above
  }
}
