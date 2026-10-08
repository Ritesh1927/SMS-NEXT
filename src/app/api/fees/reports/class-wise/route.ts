import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { FeePayment } from "@/models/FeePayment";
import { Student } from "@/models/Student";
import { Admin } from "@/models/Admin";
import { computeFeeDues } from "@/lib/feeDues";
import { generateSessionMonths } from "@/lib/feeEngine";

interface ClassRow {
  className: string;
  collected: number;
  pending: number;
  paid: number;
  pendingCount: number;
  totalCount: number;
}

// GET /api/fees/reports/class-wise — per-class collected/outstanding totals.
// Outstanding comes from the same fee-engine dues every other fees surface
// uses (structures − paid, admission-aware, full backlog up to today), so
// the numbers here always match the dashboard's Pending Fees card and the
// Fees page — the old hand-rolled loop only counted the *current* month's
// dues and silently ignored the whole unpaid backlog. Collected is the sum
// of paid amounts recorded this session, grouped by the student's class.
// Returned class-ascending (numeric-aware: Class 2 before Class 10).
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();

    const school = await Admin.findById(auth.schoolId).select("settings");
    const now = new Date();
    const sessionMonths = generateSessionMonths(school?.settings?.sessionStartMonth || "April", now.getFullYear());
    // First month of the generated session (e.g. "2026-04" → 1 Apr 2026) —
    // payments collected before it belong to a previous session.
    const [sessionStartYear, sessionStartMonth] = (sessionMonths[0] || `${now.getFullYear()}-04`).split("-").map(Number);
    const sessionStart = new Date(sessionStartYear, sessionStartMonth - 1, 1);

    const [students, dues, payments] = await Promise.all([
      Student.find({ school: auth.schoolId, isActive: true })
        .select("class")
        .lean<{ _id: unknown; class: string }[]>(),
      computeFeeDues(auth.schoolId),
      FeePayment.find({ school: auth.schoolId, status: "paid", paidDate: { $gte: sessionStart } })
        .select("student paidAmount")
        .populate("student", "class")
        .lean<{ student: { _id?: unknown; class?: string } | null; paidAmount: number }[]>(),
    ]);

    const classMap = new Map<string, ClassRow>();
    const ensure = (cls: string) => {
      const key = cls || "Unknown";
      if (!classMap.has(key)) classMap.set(key, { className: key, collected: 0, pending: 0, paid: 0, pendingCount: 0, totalCount: 0 });
      return classMap.get(key)!;
    };

    for (const s of students) ensure(s.class).totalCount++;

    // Outstanding: real dues per class + distinct student headcount.
    const pendingStudentsByClass = new Map<string, Set<string>>();
    for (const d of dues) {
      const row = ensure(d.class || "");
      row.pending += d.amount;
      const set = pendingStudentsByClass.get(row.className) || new Set<string>();
      if (d.studentId) set.add(d.studentId);
      pendingStudentsByClass.set(row.className, set);
    }
    for (const [className, ids] of pendingStudentsByClass) {
      ensure(className).pendingCount = ids.size;
    }

    // Collected: paid amounts this session, by the payer's class.
    const paidStudentIds = new Set<string>();
    for (const p of payments) {
      ensure(p.student?.class || "").collected += p.paidAmount || 0;
      if (p.student?._id) paidStudentIds.add(String(p.student._id));
    }

    // "Paid" = settled students (nothing outstanding, and at least one
    // payment recorded this session) — mirrors the old card's intent
    // without the current-month-only bias.
    const studentIdsByClass = new Map<string, Set<string>>();
    for (const s of students) {
      const key = s.class || "Unknown";
      if (!studentIdsByClass.has(key)) studentIdsByClass.set(key, new Set());
      studentIdsByClass.get(key)!.add(String(s._id));
    }
    for (const [className, ids] of studentIdsByClass) {
      const row = ensure(className);
      const pendingIds = pendingStudentsByClass.get(className) || new Set<string>();
      for (const id of ids) {
        if (!pendingIds.has(id) && paidStudentIds.has(id)) row.paid++;
      }
    }

    const data = Array.from(classMap.values()).sort((a, b) =>
      a.className.localeCompare(b.className, undefined, { numeric: true }),
    );
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load class-wise report." },
      { status: 500 },
    );
  }
}
