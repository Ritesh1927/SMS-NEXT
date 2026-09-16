import { Class } from "@/models/Class";
import { Student } from "@/models/Student";

// A parent may only message the class teacher(s) of their own children (a
// parent with kids in different classes can have more than one), plus the
// school admin. This resolves "class teacher(s) of these children" via
// Class.classTeacher (matched by class+section), the same source of truth
// the chat contacts list and the rest of the app already use.
export async function getClassTeacherIdsForChildren(
  children: { class: string; section?: string }[],
  schoolId: string,
): Promise<Set<string>> {
  if (children.length === 0) return new Set();
  const classDocs = await Class.find({
    school: schoolId,
    $or: children.map((c) => ({ name: c.class, section: c.section || "" })),
  })
    .select("classTeacher")
    .lean();
  return new Set(classDocs.filter((c) => c.classTeacher).map((c) => String(c.classTeacher)));
}

// The inverse check for a teacher messaging a parent: is this parent one of
// the parents of a student in a class where `teacherId` is THE class
// teacher (not merely subject-assigned via assignedClasses)?
export async function isParentOfTeachersClassStudent(
  teacherId: string,
  parentId: string,
  schoolId: string,
): Promise<boolean> {
  const classes = await Class.find({ school: schoolId, classTeacher: teacherId }).select("name section").lean();
  if (classes.length === 0) return false;
  const match = await Student.exists({
    school: schoolId,
    parent: parentId,
    $or: classes.map((c) => ({ class: c.name, section: c.section || "" })),
  });
  return !!match;
}
