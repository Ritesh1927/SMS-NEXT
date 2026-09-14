import { Class } from "@/models/Class";
import { Teacher } from "@/models/Teacher";

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
