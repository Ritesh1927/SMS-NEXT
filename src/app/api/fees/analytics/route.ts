import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { FeePayment } from "@/models/FeePayment";
import { Student } from "@/models/Student";
import { Admin } from "@/models/Admin";
import { computeFeeDues, type FeeDueEntry } from "@/lib/feeDues";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const monthKeyOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

// GET /api/fees/analytics — admin-only, for the Fees page's Dashboard tab.
//
// No query params → legacy behaviour (calendar year Jan–Dec, all-time
// class-wise, dues for the current session only) — Reports → Overview
// depends on this exact shape, so it must never change.
//
// ?fy=2026-2027 → financial-year mode for the redesigned Fees dashboard:
// the window comes from the school's settings.sessionStartMonth (April by
// default → Apr 1 2026 – Mar 31 2027), collected stats are scoped to that
// window, dues are computed for that session (admission-aware) split into
// due-so-far / overdue / upcoming, plus class counts, expected totals and
// the top-5 defaulters.
//
// "Pending" is computed from computeFeeDues (every FeeStructure x student
// combination that's actually due and unpaid), not by scanning existing
// FeePayment rows -- a month nobody has ever tried to pay yet has no
// FeePayment doc at all, so scanning payments would silently miss it, and
// computeFeeDues already excludes not-yet-due (upcoming) periods so this
// agrees with the Pending Fee Records list instead of double-counting.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const schoolId = new mongoose.Types.ObjectId(auth.schoolId);
    const fyRaw = new URL(req.url).searchParams.get("fy");
    const isFy = fyRaw !== null;

    const schoolDoc = await Admin.findById(schoolId)
      .select("settings.sessionStartMonth")
      .lean<{ settings?: { sessionStartMonth?: string } }>();
    const sessionStartMonth = schoolDoc?.settings?.sessionStartMonth || "April";
    let startIdx = MONTH_NAMES.indexOf(sessionStartMonth);
    if (startIdx < 0) startIdx = 3;

    const now = new Date();
    const curYear = now.getFullYear();
    const curStartYear = now.getMonth() >= startIdx ? curYear : curYear - 1;
    const fyStartYear = isFy ? parseInt(fyRaw!.slice(0, 4), 10) || curStartYear : curStartYear;

    const winStart = isFy ? new Date(fyStartYear, startIdx, 1) : new Date(curYear, 0, 1);
    const winEnd = isFy ? new Date(fyStartYear, startIdx + 12, 0, 23, 59, 59, 999) : new Date(curYear, 11, 31, 23, 59, 59, 999);
    const nowInWindow = now >= winStart && now <= winEnd;

    // 12 month buckets: legacy = Jan..Dec of this calendar year; FY mode =
    // session order (Apr..Mar for an April session).
    const buckets: { key: string; label: string; monthNo: number }[] = [];
    if (isFy) {
      for (let i = 0; i < 12; i++) {
        const m = (startIdx + i) % 12;
        const y = m >= startIdx ? fyStartYear : fyStartYear + 1;
        buckets.push({ key: `${y}-${String(m + 1).padStart(2, "0")}`, label: MONTHS[m], monthNo: m + 1 });
      }
    } else {
      for (let m = 0; m < 12; m++) buckets.push({ key: `${curYear}-${String(m + 1).padStart(2, "0")}`, label: MONTHS[m], monthNo: m + 1 });
    }
    const bucketKeys = new Set(buckets.map((b) => b.key));

    const [monthlyCollected, yearPayments, classWiseRaw, dues, studentCounts] = await Promise.all([
      FeePayment.aggregate([
        { $match: { school: schoolId, status: "paid", paidDate: { $gte: winStart, $lte: winEnd } } },
        { $group: { _id: { $month: "$paidDate" }, total: { $sum: "$paidAmount" } } },
      ]),
      FeePayment.find({ school: schoolId, status: "paid", paidDate: { $gte: winStart, $lte: winEnd } }).select(
        "amount paidAmount lateFee concession",
      ),
      FeePayment.aggregate([
        // Legacy (no fy) keeps the original all-time class-wise view; FY
        // mode scopes collected to the window. The $lookup/$group below is
        // identical either way.
        ...(isFy ? [{ $match: { school: schoolId, status: "paid", paidDate: { $gte: winStart, $lte: winEnd } } }] : [{ $match: { school: schoolId, status: "paid" } }]),
        { $lookup: { from: "students", localField: "student", foreignField: "_id", as: "s" } },
        { $unwind: "$s" },
        { $group: { _id: "$s.class", collected: { $sum: "$paidAmount" } } },
        { $sort: { _id: 1 } },
      ]),
      computeFeeDues(String(auth.schoolId), isFy ? { year: fyStartYear, includeUpcoming: true } : {}),
      isFy
        ? Student.aggregate([
            { $match: { school: schoolId, isActive: true } },
            { $group: { _id: "$class", count: { $sum: 1 } } },
          ])
        : Promise.resolve([] as { _id: string; count: number }[]),
    ]);

    const collectedByMonth = new Map<number, number>(monthlyCollected.map((m: { _id: number; total: number }) => [m._id, m.total]));

    // Split dues: "upcoming" = session months after the current one (or a
    // one-time fee whose due date is still in a future month). Due-so-far
    // is everything else — admission-aware (July joiner never owes Apr–Jun).
    const curKey = monthKeyOf(now);
    const isUpcomingEntry = (e: FeeDueEntry) => {
      if (e.month === "one-time") return e.dueDate ? monthKeyOf(e.dueDate) > curKey : false;
      return e.month > curKey;
    };
    // Recurring entries only ever carry session months, so they're already
    // inside the FY window; a one-time fee belongs to whichever FY its own
    // due date falls in — keep it out of windows it doesn't belong to (a
    // Sep-2026 admission fee must not inflate FY 2025-2026's pending).
    const inWindow = (e: FeeDueEntry) => {
      if (e.month !== "one-time") return true;
      if (!e.dueDate) return true;
      return e.dueDate >= winStart && e.dueDate <= winEnd;
    };
    const windowDues = isFy ? dues.filter(inWindow) : dues;
    const dueNow = isFy ? windowDues.filter((e) => !isUpcomingEntry(e)) : dues;
    const upcomingEntries = isFy ? windowDues.filter(isUpcomingEntry) : [];

    // Overdue = due-so-far whose month is already behind the current one.
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const isOverdueEntry = (e: FeeDueEntry) => {
      if (e.month === "one-time") return e.dueDate ? new Date(e.dueDate.getFullYear(), e.dueDate.getMonth(), 1) < monthStart : false;
      return e.month < curKey;
    };

    const sum = (list: FeeDueEntry[]) => list.reduce((s, e) => s + e.amount, 0);

    // Monthly pending buckets — string keys ("2026-10") in FY mode,
    // month numbers (1–12) in legacy mode, matching how they're read back.
    const pendingByKey = new Map<string | number, number>();
    if (isFy) {
      for (const e of dues) {
        const key = e.month === "one-time" ? (e.dueDate ? monthKeyOf(e.dueDate) : null) : e.month;
        if (!key || !bucketKeys.has(key)) continue;
        pendingByKey.set(key, (pendingByKey.get(key) || 0) + e.amount);
      }
    } else {
      // Legacy: bucket by the due date's calendar month within this year.
      for (const e of dues) {
        if (!e.dueDate) continue;
        const dt = new Date(e.dueDate);
        if (dt.getFullYear() !== curYear) continue;
        const key = dt.getMonth() + 1;
        pendingByKey.set(key, (pendingByKey.get(key) || 0) + e.amount);
      }
    }

    const data = buckets.map((b) => {
      const collected = Math.round(collectedByMonth.get(b.monthNo) || 0);
      const pending = Math.round(pendingByKey.get(isFy ? b.key : b.monthNo) || 0);
      return { month: b.label, collected, pending, total: collected + pending };
    });

    const totalCollected = yearPayments.reduce((s: number, p: { paidAmount: number }) => s + p.paidAmount, 0);
    const totalLateFees = yearPayments.reduce((s: number, p: { lateFee?: number }) => s + (p.lateFee || 0), 0);
    const totalConcessions = yearPayments.reduce((s: number, p: { concession?: number }) => s + (p.concession || 0), 0);
    const dueNowTotal = Math.round(sum(dueNow));
    const upcomingTotal = Math.round(sum(upcomingEntries));
    const overdueTotal = Math.round(sum(dueNow.filter(isOverdueEntry)));
    const totalPending = isFy ? dueNowTotal : Math.round(sum(dues));
    const expected = totalCollected + totalPending + upcomingTotal;
    const thisMonthCollected = nowInWindow ? collectedByMonth.get(now.getMonth() + 1) || 0 : 0;
    const pendingStudents = new Set(dueNow.map((e) => e.studentId).filter(Boolean)).size;
    const collectedPct = expected > 0 ? Math.round((totalCollected / expected) * 100) : 0;
    const pendingPct = expected > 0 ? Math.round((totalPending / expected) * 100) : 0;

    // Outstanding dues grouped by the student's class — pairs with classWise
    // (collected) for the per-class snapshot table on Reports → Overview.
    const pendingByClassMap = new Map<string, { pending: number; students: Set<string> }>();
    for (const e of dueNow) {
      const cls = e.class || "";
      const cur = pendingByClassMap.get(cls) || { pending: 0, students: new Set<string>() };
      cur.pending += e.amount;
      if (e.studentId) cur.students.add(e.studentId);
      pendingByClassMap.set(cls, cur);
    }
    const pendingByClass = [...pendingByClassMap].map(([cls, v]) => ({ class: cls, pending: Math.round(v.pending) }));

    // FY class-wise: collected + pending + headcounts in one row (legacy
    // keeps the original {class, collected} all-time shape for Reports).
    let classWise: { class: string; collected: number; pending?: number; students?: number; pendingStudents?: number }[];
    if (isFy) {
      const collectedByClass = new Map<string, number>(classWiseRaw.map((c: { _id: string; collected: number }) => [String(c._id), c.collected]));
      const studentsByClass = new Map<string, number>(studentCounts.map((s: { _id: string; count: number }) => [String(s._id), s.count]));
      const allClasses = new Set([...studentsByClass.keys(), ...collectedByClass.keys(), ...pendingByClassMap.keys()]);
      classWise = [...allClasses].map((cls) => ({
        class: cls,
        collected: Math.round(collectedByClass.get(cls) || 0),
        pending: Math.round(pendingByClassMap.get(cls)?.pending || 0),
        students: studentsByClass.get(cls) || 0,
        pendingStudents: pendingByClassMap.get(cls)?.students.size || 0,
      })).sort((a, b) => a.class.localeCompare(b.class, undefined, { numeric: true, sensitivity: "base" }));
    } else {
      classWise = classWiseRaw.map((c: { _id: string; collected: number }) => ({ class: String(c._id), collected: Math.round(c.collected) }));
    }

    // Top 5 defaulters: students with the highest due-so-far amounts.
    let topStudents: { studentId: string; name: string; class: string; pending: number; months: number }[] = [];
    if (isFy) {
      const byStudent = new Map<string, { amount: number; count: number }>();
      for (const e of dueNow) {
        if (!e.studentId) continue;
        const cur = byStudent.get(e.studentId) || { amount: 0, count: 0 };
        cur.amount += e.amount;
        cur.count += 1;
        byStudent.set(e.studentId, cur);
      }
      const ranked = [...byStudent].sort((a, b) => b[1].amount - a[1].amount).slice(0, 5);
      const docs = ranked.length
        ? await Student.find({ _id: { $in: ranked.map(([id]) => id) } }).select("name class").lean<{ _id: unknown; name: string; class: string }[]>()
        : [];
      const info = new Map(docs.map((d) => [String(d._id), d]));
      topStudents = ranked
        .map(([id, v]) => ({
          studentId: id,
          name: info.get(id)?.name || "—",
          class: info.get(id)?.class || "—",
          pending: Math.round(v.amount),
          months: v.count,
        }))
        .filter((s) => s.name !== "—");
    }

    return NextResponse.json({
      success: true,
      data,
      classWise,
      pendingByClass,
      summary: {
        totalCollected: Math.round(totalCollected),
        totalPending,
        totalLateFees: Math.round(totalLateFees),
        totalConcessions: Math.round(totalConcessions),
        ...(isFy
          ? {
              expected: Math.round(expected),
              overdue: overdueTotal,
              upcoming: upcomingTotal,
              thisMonthCollected: Math.round(thisMonthCollected),
              pendingStudents,
              collectedPct,
              pendingPct,
            }
          : {}),
      },
      ...(isFy ? { topStudents } : {}),
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load fee analytics." },
      { status: 500 },
    );
  }
}
