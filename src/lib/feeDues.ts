import { FeeStructure, type IFeeStructure } from "@/models/FeeStructure";
import { FeePayment } from "@/models/FeePayment";
import { Student } from "@/models/Student";
import { Concession, type IConcession } from "@/models/Concession";
import { Admin } from "@/models/Admin";
import {
  generateSessionMonths,
  filterMonthsByAdmission,
  resolveFeeMonths,
  concessionAppliesToMonth,
  concessionAmount,
  isMonthUpcoming,
  dueDateForMonth,
} from "@/lib/feeEngine";

export interface FeeDueEntry {
  month: string;
  dueDate: Date | null;
  amount: number;
  // Class name of the student the entry is for — optional so existing
  // consumers stay type-compatible; used to group dues per class in
  // /api/fees/analytics (class snapshot on Reports → Overview).
  class?: string;
  // Student the entry belongs to — optional for the same compatibility
  // reason; /api/fees/analytics groups by it to rank top defaulters.
  studentId?: string;
}

export interface ComputeFeeDuesOptions {
  // Session (financial-year) start year — e.g. 2026 for an April-start
  // FY 2026-2027. Defaults to the current calendar year, which is exactly
  // what every existing caller gets today.
  year?: number;
  // Also emit entries for session months that haven't started yet — used
  // by /api/fees/analytics to show the "Upcoming" bucket on the Fees
  // dashboard. Off by default so pending totals elsewhere never include
  // not-yet-due periods.
  includeUpcoming?: boolean;
}

export async function computeFeeDues(schoolId: string, opts: ComputeFeeDuesOptions = {}): Promise<FeeDueEntry[]> {
  const [students, structures, paid, concessions, school] = await Promise.all([
    Student.find({ school: schoolId, isActive: true })
      .select("_id class admissionDate")
      .lean<{ _id: unknown; class: string; admissionDate: Date | string | null }[]>(),
    FeeStructure.find({ school: schoolId, isActive: true }).lean<IFeeStructure[]>(),
    FeePayment.find({ school: schoolId, status: "paid" })
      .select("student feeStructure month")
      .lean<{ student: unknown; feeStructure: unknown; month: string | null }[]>(),
    Concession.find({ school: schoolId }).lean<IConcession[]>(),
    Admin.findById(schoolId).select("settings"),
  ]);

  const paidKeys = new Set(paid.map((p) => `${String(p.student)}|${String(p.feeStructure)}|${p.month || "one-time"}`));
  const hasPaid = (student: unknown, fs: unknown, month: string) => paidKeys.has(`${String(student)}|${String(fs)}|${month}`);

  const conByStudent = new Map<string, IConcession[]>();
  for (const c of concessions) {
    const key = String(c.student);
    const list = conByStudent.get(key) || [];
    list.push(c);
    conByStudent.set(key, list);
  }

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const sessionMonths = generateSessionMonths(school?.settings?.sessionStartMonth || "April", opts.year ?? now.getFullYear());

  const entries: FeeDueEntry[] = [];

  for (const st of students) {
    const applicable = filterMonthsByAdmission(sessionMonths, st.admissionDate);
    const stuCons = conByStudent.get(String(st._id)) || [];
    for (const fs of structures) {
      if (fs.class !== st.class) continue;

      const headCons = stuCons.filter((c) => !c.feeStructure || String(c.feeStructure) === String(fs._id));
      let oneTimeConUsed = false;
      const netAmount = (monthKey: string) => {
        const con = headCons.find((c) => {
          if (!concessionAppliesToMonth(c, monthKey)) return false;
          if (c.duration === "one-time") {
            if (oneTimeConUsed) return false;
            oneTimeConUsed = true;
          }
          return true;
        });
        return Math.max(0, fs.amount - (con ? concessionAmount(fs.amount, con) : 0));
      };

      if (fs.frequency === "quarterly") {
        // Admission-aware: pass `applicable` (not the raw session) so a
        // student who joined mid-session never owes quarters before joining.
        const quarters = resolveFeeMonths("quarterly", applicable, sessionMonths, fs.dueDate);
        for (const q of quarters) {
          if (hasPaid(st._id, fs._id, q) || (isMonthUpcoming(fs.dueDate, q, now) && !opts.includeUpcoming)) continue;
          entries.push({ month: q, dueDate: dueDateForMonth(fs.dueDate, q), amount: netAmount(q), class: st.class, studentId: String(st._id) });
        }
      } else if (fs.frequency === "one-time") {
        if (hasPaid(st._id, fs._id, "one-time")) continue;
        entries.push({ month: "one-time", dueDate: fs.dueDate ? new Date(fs.dueDate) : null, amount: netAmount("one-time"), class: st.class, studentId: String(st._id) });
      } else if (fs.frequency === "yearly") {
        const dueMonth = fs.dueDate
          ? `${new Date(fs.dueDate).getFullYear()}-${String(new Date(fs.dueDate).getMonth() + 1).padStart(2, "0")}`
          : applicable[0] || currentMonth;
        // Admission-aware like monthly: the yearly fee only counts when its
        // month falls within the student's applicable window (after joining,
        // inside this session).
        if (!applicable.includes(dueMonth)) continue;
        if (hasPaid(st._id, fs._id, dueMonth) || (isMonthUpcoming(fs.dueDate, dueMonth, now) && !opts.includeUpcoming)) continue;
        entries.push({ month: dueMonth, dueDate: dueDateForMonth(fs.dueDate, dueMonth), amount: netAmount(dueMonth), class: st.class, studentId: String(st._id) });
      } else {
        // Monthly: every applicable month whose period has started (not
        // just the current one) counts as due until paid, so a student
        // who's fallen behind shows the whole backlog, not just this month.
        for (const monthKey of applicable) {
          if (hasPaid(st._id, fs._id, monthKey) || (isMonthUpcoming(fs.dueDate, monthKey, now) && !opts.includeUpcoming)) continue;
          entries.push({ month: monthKey, dueDate: dueDateForMonth(fs.dueDate, monthKey), amount: netAmount(monthKey), class: st.class, studentId: String(st._id) });
        }
      }
    }
  }

  return entries;
}
