import { Student } from "@/models/Student";

// Roll numbers are auto-managed, not entered by hand: every active student
// in a class+section is numbered 1..N in alphabetical order of their name.
// Call this after anything that could change who's in that roster (create,
// delete, activate/deactivate) or their name/class/section, so the roll
// numbers stay a live reflection of alphabetical order rather than a value
// set once and left stale.
export async function resequenceRollNumbers(schoolId: string, studentClass: string, section: string): Promise<void> {
  if (!studentClass) return;
  const students = await Student.find({ school: schoolId, class: studentClass, section, isActive: true })
    .collation({ locale: "en" })
    .sort({ name: 1 })
    .select("_id rollNumber");

  const ops = students
    .map((s, i) => ({ id: s._id, rollNumber: String(i + 1), changed: s.rollNumber !== String(i + 1) }))
    .filter((s) => s.changed);

  if (ops.length === 0) return;
  await Student.bulkWrite(
    ops.map((s) => ({ updateOne: { filter: { _id: s.id }, update: { $set: { rollNumber: s.rollNumber } } } })),
  );
}
