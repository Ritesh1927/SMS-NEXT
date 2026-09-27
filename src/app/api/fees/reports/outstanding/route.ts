import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { FeePayment } from "@/models/FeePayment";
import { FeeStructure, type IFeeStructure } from "@/models/FeeStructure";
import { Concession, type IConcession } from "@/models/Concession";
import { Student, type IStudent } from "@/models/Student";
import { Admin } from "@/models/Admin";
import {
  generateSessionMonths,
  filterMonthsByAdmission,
  isMonthUpcoming,
  resolveFeeMonths,
  concessionAppliesToMonth,
  concessionAmount,
} from "@/lib/feeEngine";

interface OutstandingRow {
  _id: string;
  invoiceNo: string;
  month: string;
  feeHead: string;
  frequency: string;
  student: Pick<IStudent, "name" | "class" | "section" | "studentId">;
  total: number;
  paidAmount: number;
  balance: number;
  status: "overdue" | "pending";
  dueDate: Date | string | null;
  daysOverdue: number;
}

// GET /api/fees/reports/outstanding?class=5-A — every unpaid fee-head/month
// combination for students in the school (or one class-section), for the
// "Outstanding Dues" sub-tab.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const classFilter = searchParams.get("class") || "";

    const query: Record<string, unknown> = { school: auth.schoolId, isActive: true };
    if (classFilter) {
      const [cls, sec] = classFilter.split("-");
      query.class = cls;
      if (sec) query.section = sec;
    }

    const students = await Student.find(query)
      .select("name class section studentId admissionDate")
      .lean<IStudent[]>();
    const structures = await FeeStructure.find({ school: auth.schoolId, isActive: true }).lean<IFeeStructure[]>();
    const payments = await FeePayment.find({ school: auth.schoolId }).lean<
      { student: unknown; feeStructure: unknown; status: string; month: string | null }[]
    >();
    const concessions = await Concession.find({ school: auth.schoolId }).lean<IConcession[]>();
    const school = await Admin.findById(auth.schoolId).select("settings");

    const conByStudent = new Map<string, IConcession[]>();
    for (const c of concessions) {
      const key = String(c.student);
      const list = conByStudent.get(key) || [];
      list.push(c);
      conByStudent.set(key, list);
    }

    const now = new Date();
    const sessionMonths = generateSessionMonths(school?.settings?.sessionStartMonth || "April", now.getFullYear());

    const result: OutstandingRow[] = [];

    for (const st of students) {
      const classStructs = structures.filter((s) => s.class === st.class);
      const applicableMonths = filterMonthsByAdmission(sessionMonths, st.admissionDate);
      const stuCons = conByStudent.get(String(st._id)) || [];

      for (const fs of classStructs) {
        const headCons = stuCons.filter((c) => !c.feeStructure || String(c.feeStructure) === String(fs._id));
        let oneTimeConUsed = false;
        const netFor = (monthKey: string) => {
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

        if (fs.frequency === "one-time") {
          const isPaid = payments.some(
            (p) => String(p.student) === String(st._id) && String(p.feeStructure) === String(fs._id) && p.status === "paid" && p.month === "one-time",
          );
          if (!isPaid) {
            const net = netFor("one-time");
            const daysOverdue = fs.dueDate ? Math.floor((now.getTime() - new Date(fs.dueDate).getTime()) / 86400000) : 0;
            result.push({
              _id: String(fs._id), invoiceNo: "—", month: "one-time", feeHead: fs.title, frequency: fs.frequency, student: st,
              total: net, paidAmount: 0, balance: net,
              status: daysOverdue > 0 ? "overdue" : "pending",
              dueDate: fs.dueDate, daysOverdue: Math.max(daysOverdue, 0),
            });
          }
        } else if (fs.frequency === "yearly") {
          const dueMonth = fs.dueDate
            ? `${new Date(fs.dueDate).getFullYear()}-${String(new Date(fs.dueDate).getMonth() + 1).padStart(2, "0")}`
            : applicableMonths[0] || `${now.getFullYear()}-04`;
          const isPaid = payments.some(
            (p) => String(p.student) === String(st._id) && String(p.feeStructure) === String(fs._id) && p.status === "paid" && p.month === dueMonth,
          );
          if (!isPaid && applicableMonths.includes(dueMonth) && !isMonthUpcoming(fs.dueDate, dueMonth, now)) {
            const net = netFor(dueMonth);
            const dueDate = new Date(dueMonth + "-01");
            const daysOverdue = dueDate < now ? Math.floor((now.getTime() - dueDate.getTime()) / 86400000) : 0;
            result.push({
              _id: `${fs._id}-${dueMonth}`, invoiceNo: "—", month: dueMonth, feeHead: fs.title, frequency: fs.frequency, student: st,
              total: net, paidAmount: 0, balance: net,
              status: daysOverdue > 0 ? "overdue" : "pending",
              dueDate: fs.dueDate, daysOverdue: Math.max(daysOverdue, 0),
            });
          }
        } else {
          // "monthly" passes applicableMonths through unchanged; "quarterly"
          // narrows it to the quarter-start months.
          const targetMonths = resolveFeeMonths(fs.frequency, applicableMonths, sessionMonths, fs.dueDate);
          for (const monthKey of targetMonths) {
            if (isMonthUpcoming(fs.dueDate, monthKey, now)) continue;
            const isPaid = payments.some(
              (p) => String(p.student) === String(st._id) && String(p.feeStructure) === String(fs._id) && p.status === "paid" && p.month === monthKey,
            );
            if (!isPaid) {
              const net = netFor(monthKey);
              const dueDate = new Date(monthKey + "-01");
              if (fs.dueDate) dueDate.setDate(new Date(fs.dueDate).getDate());
              const daysOverdue = dueDate < now ? Math.floor((now.getTime() - dueDate.getTime()) / 86400000) : 0;
              result.push({
                _id: `${fs._id}-${monthKey}`, invoiceNo: "—", month: monthKey, feeHead: fs.title, frequency: fs.frequency, student: st,
                total: net, paidAmount: 0, balance: net,
                status: daysOverdue > 0 ? "overdue" : "pending",
                dueDate, daysOverdue: Math.max(daysOverdue, 0),
              });
            }
          }
        }
      }
    }

    result.sort((a, b) => new Date(a.dueDate || 0).getTime() - new Date(b.dueDate || 0).getTime());
    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load outstanding dues." },
      { status: 500 },
    );
  }
}
