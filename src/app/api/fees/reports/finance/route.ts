import type { QueryFilter } from "mongoose";
import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Class } from "@/models/Class";
import { Student } from "@/models/Student";
import { FeeStructure, type IFeeStructure } from "@/models/FeeStructure";
import { FeePayment, type IFeePayment } from "@/models/FeePayment";
import { Concession, type IConcession } from "@/models/Concession";
import { Admin } from "@/models/Admin";
import { getTeacherAccessibleClasses } from "@/lib/teacherClasses";
import {
  generateSessionMonths,
  resolveFeeMonths,
  concessionAppliesToMonth,
  concessionAmount,
  calcProjectedLateFee,
  dueDateForMonth,
} from "@/lib/feeEngine";

interface FinanceHead {
  title: string;
  frequency: string;
  dueThisMonth: boolean;
  totalFee: number;
  paid: number;
  pending: number;
  lateFee: number;
  concession: number;
  dueDate: string | null;
  status: "paid" | "unpaid" | "not-due";
}

interface FinanceRow {
  _id: string;
  name: string;
  rollNumber: string;
  totalFee: number;
  paid: number;
  pending: number;
  lateFee: number;
  concession: number;
  dueDate: string | null;
  status: "paid" | "unpaid";
  heads: FinanceHead[];
}

const MONTH_KEY = /^(\d{4})-(\d{2})$/;
const monthKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

// GET /api/fees/reports/finance?month=YYYY-MM&classId=&academicYear=YYYY-YYYY
// One class x one month fee report behind Reports > Finance: per-student
// total/paid/pending/late-fee/concession rows (each with a per-fee-head
// drill-down covering every structure of the class) plus the stat-card
// aggregates. Everything is period-based for the selected month (net of
// concessions), so collected + pending always equals total fee; late fees
// are reported separately (what this month's payments actually charged +
// the school-configured projection on unpaid overdue dues) instead of
// being folded into the totals.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const month = searchParams.get("month") || "";
    const classId = searchParams.get("classId") || "";
    const academicYear = searchParams.get("academicYear") || "";

    if (!MONTH_KEY.test(month)) {
      return NextResponse.json({ success: false, message: "month (YYYY-MM) is required." }, { status: 400 });
    }
    if (!/^\d{4}-\d{4}$/.test(academicYear)) {
      return NextResponse.json({ success: false, message: "academicYear (YYYY-YYYY) is required." }, { status: 400 });
    }
    if (!classId) {
      return NextResponse.json({ success: false, message: "classId is required." }, { status: 400 });
    }

    const cls = await Class.findOne({ _id: classId, school: auth.schoolId }).lean();
    if (!cls) return NextResponse.json({ success: false, message: "Class not found." }, { status: 404 });

    // Same teacher scoping as the attendance register — the class picker
    // (/api/classes) already limits teachers to their own classes.
    if (auth.role === "teacher") {
      const accessible = await getTeacherAccessibleClasses(auth.id, auth.schoolId);
      const allowed = accessible.some((c) => c.name === cls.name && (c.section || "") === (cls.section || ""));
      if (!allowed) {
        return NextResponse.json({ success: false, message: "You do not have access to this class." }, { status: 403 });
      }
    }

    const sessionStartYear = Number(academicYear.slice(0, 4));
    const [students, structures, concessions, school] = await Promise.all([
      Student.find({ school: auth.schoolId, class: cls.name, section: cls.section, isActive: true })
        .select("name rollNumber admissionDate")
        .collation({ locale: "en" })
        .sort({ rollNumber: 1, name: 1 })
        .lean<{ _id: unknown; name: string; rollNumber?: string; admissionDate: Date | string | null }[]>(),
      FeeStructure.find({ school: auth.schoolId, isActive: true, class: cls.name, academicYear: { $in: [academicYear, ""] } })
        .lean<IFeeStructure[]>(),
      Concession.find({ school: auth.schoolId }).lean<IConcession[]>(),
      Admin.findById(auth.schoolId).select("settings"),
    ]);

    // The 12 months of the selected academic year — quarterly / yearly /
    // one-time occurrences resolve against exactly these, mirroring
    // computeFeeDues so this report agrees with the pending dues shown
    // everywhere else.
    const sessionMonths = generateSessionMonths(school?.settings?.sessionStartMonth || "April", sessionStartYear);

    // Heads that actually have an occurrence in the selected month.
    const applicable: IFeeStructure[] = [];
    const oneTimeIds: unknown[] = [];
    for (const fs of structures) {
      if (fs.frequency === "monthly") {
        if (sessionMonths.includes(month)) applicable.push(fs);
      } else if (fs.frequency === "quarterly") {
        if (resolveFeeMonths("quarterly", sessionMonths, sessionMonths, fs.dueDate).includes(month)) applicable.push(fs);
      } else if (fs.frequency === "yearly") {
        const dueMonth = fs.dueDate ? monthKeyOf(new Date(fs.dueDate)) : sessionMonths[0];
        if (dueMonth === month) applicable.push(fs);
      } else if (fs.dueDate && monthKeyOf(new Date(fs.dueDate)) === month) {
        // One-time fees only belong to the month their own due date falls in.
        applicable.push(fs);
        oneTimeIds.push(fs._id);
      }
    }
    const applicableIds = new Set(applicable.map((f) => String(f._id)));

    // Payments already made against this month's occurrences. Keyed by
    // student + fee structure (one occurrence per head per month); partial
    // payments count too — their paid amount reduces the pending balance.
    const studentIds = students.map((s) => s._id);
    const payments = await FeePayment.find({
      school: auth.schoolId,
      student: { $in: studentIds },
      status: { $in: ["paid", "partial"] },
      // Recurring occurrences for this month, plus one-time fees whose own
      // key is "one-time" (empty $in matches nothing when there are none).
      $or: [{ month }, { month: "one-time", feeStructure: { $in: oneTimeIds } }],
    } as QueryFilter<IFeePayment>)
      .select("student feeStructure paidAmount lateFee")
      .lean<{ student: unknown; feeStructure: unknown; paidAmount: number; lateFee: number }[]>();

    const payByKey = new Map<string, { paid: number; lateFee: number }>();
    for (const p of payments) {
      const key = `${String(p.student)}|${String(p.feeStructure)}`;
      const cur = payByKey.get(key) || { paid: 0, lateFee: 0 };
      cur.paid += p.paidAmount || 0;
      cur.lateFee += p.lateFee || 0;
      payByKey.set(key, cur);
    }

    const conByStudent = new Map<string, IConcession[]>();
    for (const c of concessions) {
      const key = String(c.student);
      const list = conByStudent.get(key);
      if (list) list.push(c);
      else conByStudent.set(key, [c]);
    }

    const now = new Date();
    const lateFeeConfig = school?.settings?.lateFee;

    const rows = students.map((s) => {
      const sid = String(s._id);
      let totalFee = 0;
      let collected = 0;
      let rowLateFee = 0;
      let rowConcession = 0;
      let earliestDue: Date | null = null;
      const heads: FinanceHead[] = [];

      // Fee periods that started before this student joined are never theirs.
      const admissionKey = s.admissionDate ? monthKeyOf(new Date(s.admissionDate)) : null;

      if (!admissionKey || admissionKey <= month) {
        const stuCons = conByStudent.get(sid) || [];
        for (const fs of structures) {
          // Heads without an occurrence this month still appear in the
          // drill-down so management sees every structure of the class and
          // which ones simply aren't due in the selected period.
          if (!applicableIds.has(String(fs._id))) {
            heads.push({
              title: fs.title,
              frequency: fs.frequency,
              dueThisMonth: false,
              totalFee: 0,
              paid: 0,
              pending: 0,
              lateFee: 0,
              concession: 0,
              dueDate: null,
              status: "not-due",
            });
            continue;
          }
          const occKey = fs.frequency === "one-time" ? "one-time" : month;
          const headCons = stuCons.filter((c) => !c.feeStructure || String(c.feeStructure) === String(fs._id));
          let oneTimeUsed = false;
          const con = headCons.find((c) => {
            if (!concessionAppliesToMonth(c, occKey)) return false;
            if (c.duration === "one-time") {
              if (oneTimeUsed) return false;
              oneTimeUsed = true;
            }
            return true;
          });
          const conAmt = con ? concessionAmount(fs.amount, con) : 0;
          const net = Math.max(0, fs.amount - conAmt);
          const pay = payByKey.get(`${sid}|${String(fs._id)}`);
          // Cap at the net due so paid + pending === total fee even when the
          // payment included a late fee (the late fee has its own card).
          const paidNow = pay ? Math.min(pay.paid, net) : 0;
          const due = dueDateForMonth(fs.dueDate, occKey);
          // Projected late fee only when nothing has been paid yet — the same
          // rule student-status uses for unpaid, past-due months.
          const projected = !pay && due && due < now ? calcProjectedLateFee(lateFeeConfig || {}, fs.amount, due) : 0;
          const headPending = Math.max(0, net - paidNow);
          const headLateFee = (pay?.lateFee || 0) + projected;

          totalFee += net;
          collected += paidNow;
          rowConcession += conAmt;
          rowLateFee += headLateFee;
          if (due && (!earliestDue || due < earliestDue)) earliestDue = due;
          heads.push({
            title: fs.title,
            frequency: fs.frequency,
            dueThisMonth: true,
            totalFee: net,
            paid: paidNow,
            pending: headPending,
            lateFee: headLateFee,
            concession: conAmt,
            dueDate: due ? due.toISOString() : null,
            status: headPending <= 0 ? "paid" : "unpaid",
          });
        }
        // Due-this-month heads first; not-due structures follow.
        heads.sort((a, b) => Number(b.dueThisMonth) - Number(a.dueThisMonth));
      }

      const pending = Math.max(0, totalFee - collected);
      const row: FinanceRow = {
        _id: sid,
        name: s.name,
        rollNumber: s.rollNumber || "",
        totalFee,
        paid: collected,
        pending,
        lateFee: rowLateFee,
        concession: rowConcession,
        dueDate: earliestDue ? earliestDue.toISOString() : null,
        status: pending <= 0 ? "paid" : "unpaid",
        heads,
      };
      return row;
    });

    const totalFee = rows.reduce((a, r) => a + r.totalFee, 0);
    const collected = rows.reduce((a, r) => a + r.paid, 0);
    const pending = rows.reduce((a, r) => a + r.pending, 0);
    const lateFeeTotal = rows.reduce((a, r) => a + r.lateFee, 0);
    const concessionTotal = rows.reduce((a, r) => a + r.concession, 0);
    const fullyPaid = rows.filter((r) => r.pending <= 0).length;

    return NextResponse.json({
      success: true,
      data: {
        className: `Class ${cls.name} - ${cls.section}`,
        stats: {
          totalStudents: rows.length,
          totalFee,
          collected,
          pending,
          collectionRate: totalFee > 0 ? Math.round((collected / totalFee) * 10000) / 100 : 0,
          fullyPaid,
          unpaid: rows.length - fullyPaid,
          lateFees: lateFeeTotal,
          concessions: concessionTotal,
        },
        rows,
      },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load fee report." },
      { status: 500 },
    );
  }
}
