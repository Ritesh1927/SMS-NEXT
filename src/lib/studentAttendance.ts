import { AttendanceRecord } from "@/models/AttendanceRecord";
import type { Types } from "mongoose";

// All-time (present + late) / total attendance percentage per student,
// matching SMS-BACKEND's getAllStudents — one aggregate query across the
// whole school's attendance history rather than a per-student query each,
// so this stays cheap on a student list of any size.
export async function withAttendancePercent<T extends { _id: Types.ObjectId | string }>(
  schoolId: string,
  students: T[],
): Promise<(T & { attendance: number })[]> {
  if (students.length === 0) return [];

  const records = await AttendanceRecord.find({
    school: schoolId,
    studentId: { $in: students.map((s) => s._id) },
  }).select("studentId status");

  const counts = new Map<string, { present: number; total: number }>();
  for (const rec of records) {
    const sid = String(rec.studentId);
    const entry = counts.get(sid) || { present: 0, total: 0 };
    entry.total += 1;
    if (rec.status === "present" || rec.status === "late") entry.present += 1;
    counts.set(sid, entry);
  }

  return students.map((s) => {
    const entry = counts.get(String(s._id));
    const attendance = entry && entry.total > 0 ? Math.round((entry.present / entry.total) * 100) : 0;
    return { ...s, attendance };
  });
}
