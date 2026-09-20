import { Class } from "@/models/Class";
import { Teacher } from "@/models/Teacher";
import { TimetableEntry } from "@/models/TimetableEntry";
import { escapeRegex } from "@/lib/helpers";

// A teacher can act on a class if they're its Class.classTeacher OR it's in
// their assignedClasses — same two-path access SMS-BACKEND's
// teacherHasAccessToClass/getTeacherAccessibleClasses use. Shared here since
// homework, study materials and (via /api/classes) the timetable/library
// upload pickers all need the same check.
export async function getTeacherAccessibleClasses(teacherId: string, schoolId: string) {
  const [classTeacherClasses, teacher] = await Promise.all([
    Class.find({ classTeacher: teacherId, school: schoolId }).select("name section").lean(),
    Teacher.findById(teacherId).populate<{ assignedClasses: { name: string; section: string }[] }>(
      "assignedClasses",
      "name section",
    ),
  ]);
  const merged = [...classTeacherClasses, ...(teacher?.assignedClasses || [])];
  const unique = new Map<string, { name: string; section: string }>();
  for (const c of merged) unique.set(c.name, { name: c.name, section: c.section || "" });
  return [...unique.values()];
}

export async function teacherHasAccessToClass(teacherId: string, schoolId: string, className: string) {
  const accessible = await getTeacherAccessibleClasses(teacherId, schoolId);
  return accessible.some((c) => c.name === className);
}

// Narrower than teacherHasAccessToClass: true only when this teacher is the
// class's actual classTeacher, not merely a subject teacher assigned to it
// via assignedClasses. Used to let class teachers act on their own class by
// default (e.g. assigning homework) without needing a separate permission
// grant, while subject-only teachers still need one.
export async function isClassTeacherOf(teacherId: string, schoolId: string, className: string) {
  const cls = await Class.findOne({ classTeacher: teacherId, school: schoolId, name: className }).select("_id").lean();
  return !!cls;
}

// True when this teacher has at least one timetable period putting them in
// front of this exact class+section for this exact subject -- lets a
// subject teacher enter/publish marks for their own subject without needing
// the separate, manually-granted canEnterMarks permission. Subject names are
// matched case-insensitively since they're free-text on both TimetableEntry
// and Exam rather than a shared reference.
export async function isSubjectTeacherOf(
  teacherId: string,
  schoolId: string,
  className: string,
  section: string,
  subject: string,
) {
  const cls = await Class.findOne({ school: schoolId, name: className, section: section || "" }).select("_id").lean();
  if (!cls) return false;
  const entry = await TimetableEntry.findOne({
    school: schoolId,
    teacherId,
    classId: cls._id,
    subject: { $regex: `^${escapeRegex(subject)}$`, $options: "i" },
  })
    .select("_id")
    .lean();
  return !!entry;
}
