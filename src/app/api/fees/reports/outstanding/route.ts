import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { FeePayment } from "@/models/FeePayment";
import { FeeStructure, type IFeeStructure } from "@/models/FeeStructure";
import { Student, type IStudent } from "@/models/Student";
import { Admin } from "@/models/Admin";
import { generateSessionMonths, filterMonthsByAdmission } from "@/lib/feeEngine";

interface OutstandingRow {
  _id: string;
  invoiceNo: string;
  month: string;
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
    const school = await Admin.findById(auth.schoolId).select("settings");

    const now = new Date();
    const sessionMonths = generateSessionMonths(school?.settings?.sessionStartMonth || "April", now.getFullYear());

    const result: OutstandingRow[] = [];

    for (const st of students) {
      const classStructs = structures.filter((s) => s.class === st.class);
      const applicableMonths = filterMonthsByAdmission(sessionMonths, st.admissionDate);

      for (const fs of classStructs) {
        if (fs.frequency === "one-time") {
          const isPaid = payments.some(
            (p) => String(p.student) === String(st._id) && String(p.feeStructure) === String(fs._id) && p.status === "paid" && p.month === "one-time",
          );
          if (!isPaid) {
            const daysOverdue = fs.dueDate ? Math.floor((now.getTime() - new Date(fs.dueDate).getTime()) / 86400000) : 0;
            result.push({
              _id: String(fs._id), invoiceNo: "—", month: "one-time", student: st,
              total: fs.amount, paidAmount: 0, balance: fs.amount,
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
          if (!isPaid && applicableMonths.includes(dueMonth)) {
            const dueDate = new Date(dueMonth + "-01");
            const daysOverdue = dueDate < now ? Math.floor((now.getTime() - dueDate.getTime()) / 86400000) : 0;
            result.push({
              _id: `${fs._id}-${dueMonth}`, invoiceNo: "—", month: dueMonth, student: st,
              total: fs.amount, paidAmount: 0, balance: fs.amount,
              status: daysOverdue > 0 ? "overdue" : "pending",
              dueDate: fs.dueDate, daysOverdue: Math.max(daysOverdue, 0),
            });
          }
        } else {
          for (const monthKey of applicableMonths) {
            const isPaid = payments.some(
              (p) => String(p.student) === String(st._id) && String(p.feeStructure) === String(fs._id) && p.status === "paid" && p.month === monthKey,
            );
            if (!isPaid) {
              const dueDate = new Date(monthKey + "-01");
              if (fs.dueDate) dueDate.setDate(new Date(fs.dueDate).getDate());
              const daysOverdue = dueDate < now ? Math.floor((now.getTime() - dueDate.getTime()) / 86400000) : 0;
              result.push({
                _id: `${fs._id}-${monthKey}`, invoiceNo: "—", month: monthKey, student: st,
                total: fs.amount, paidAmount: 0, balance: fs.amount,
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
