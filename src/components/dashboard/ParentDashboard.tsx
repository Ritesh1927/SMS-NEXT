"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import {
  Award, BookOpen, Calendar, CalendarCheck, CalendarClock, ChevronRight, ClipboardList,
  IndianRupee, Megaphone, MessageSquare, Wallet, Zap,
} from "lucide-react";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { DashboardHero } from "./DashboardHero";
import { PageLoader } from "@/components/PageLoader";
import { Badge } from "@/components/ui/badge";

interface Child {
  _id: string;
  name: string;
  studentId: string;
  class: string;
  section?: string;
  rollNumber?: string;
  admissionNo?: string;
  photo?: string;
  isActive: boolean;
}

interface ParentDashboardData {
  parent: { name: string; email: string; phone?: string; relation: string };
  children: Child[];
}

interface ParentDashboardResponse {
  success: boolean;
  data: ParentDashboardData;
}

interface AttRecord { _id: string; date: string; status: string; class: string }
interface AttSummary { total: number; present: number; absent: number; late: number; percentage: number }
interface AttResp { success: boolean; data: { records: AttRecord[]; summary: AttSummary } }

interface ResultRow { exam?: { title: string; subject: string } | null; marksObtained: number; totalMarks: number; grade: string; isAbsent: boolean }
interface ResultsResp { success: boolean; data: { results: ResultRow[]; averagePercentage: number } }

interface ExamRow { _id: string; title: string; subject: string; date: string; class: string; section: string; status: string }
interface ExamsResp { success: boolean; data: ExamRow[] }

interface HomeworkItem { _id: string; title: string; subject: string; dueDate: string; submission: { status: string; marks: number | null } | null }
interface HomeworkResp { success: boolean; data: HomeworkItem[] }

interface FeeMonth { month: string; paid: boolean; amount: number; paidAmount: number; lateFee: number; concession: number }
interface FeeHead { _id: string; title: string; amount: number; frequency: string; months: FeeMonth[] }
interface FeeStatusResp { success: boolean; data: { feeHeads: FeeHead[] } }

interface TtEntry { _id: string; day: string; periodNumber: number; subject: string; startTime: string; endTime: string; teacherId?: { name: string } | null }
interface TtResp { success: boolean; data: TtEntry[] }

interface NoticeRow { _id: string; title: string; content: string; createdAt: string; isUrgent?: boolean }
interface NoticesResp { success: boolean; data: NoticeRow[] }

interface OverviewData {
  att: AttSummary | null;
  recentAtt: AttRecord[];
  attDelta: number | null;
  avgScore: number | null;
  avgCount: number;
  exams: ExamRow[];
  hwPendingCount: number;
  pendingHw: HomeworkItem[];
  fees: { paid: number; pending: number; total: number; pct: number } | null;
  timetable: TtEntry[];
  notices: NoticeRow[];
}

const CHILD_KEY = "sms_next_parent_selectedChild";
const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;
const DAY_TABS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const CARD = "rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)]";

function fmtShortDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function fmtFullDate(d: string) {
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function Empty({ text }: { text: string }) {
  return <p className="text-xs text-muted-foreground py-5 text-center">{text}</p>;
}

function Panel({ title, icon, href, children }: { title: string; icon: ReactNode; href?: string; children: ReactNode }) {
  return (
    <div className={`${CARD} p-5 flex flex-col`}>
      <div className="flex items-center justify-between mb-3 gap-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">{icon}{title}</h3>
        {href && (
          <Link href={href} className="text-xs font-medium text-primary hover:underline whitespace-nowrap">
            View All
          </Link>
        )}
      </div>
      <div className="flex-1">{children}</div>
    </div>
  );
}

export function ParentDashboard() {
  const [data, setData] = useState<ParentDashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [childIdx, setChildIdx] = useState(() => {
    if (typeof window === "undefined") return 0;
    const saved = Number(localStorage.getItem(CHILD_KEY) || 0);
    return Number.isFinite(saved) && saved >= 0 ? saved : 0;
  });

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<ParentDashboardResponse>("/dashboard/parent", token)
      .then((res) => setData(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load dashboard."));
  }, []);

  if (error) return <p className="text-sm text-red-600">{error}</p>;

  if (!data) {
    return <PageLoader label="Loading dashboard..." />;
  }

  const { children } = data;
  const activeIdx = children.length > 0 ? Math.min(childIdx, children.length - 1) : 0;
  const child = children.length > 0 ? children[activeIdx] : null;

  return (
    <div className="space-y-6">
      <DashboardHero
        name={data.parent.name}
        subtitle={
          children.length === 0
            ? "No children linked to your account yet."
            : `Here's how ${children.length === 1 ? children[0].name : `your ${children.length} children`} ${children.length === 1 ? "is" : "are"} doing today.`
        }
      />

      {children.length === 0 ? (
        <div className="rounded-[18px] bg-card p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <p className="text-sm text-muted-foreground">Contact your school admin if this seems wrong.</p>
        </div>
      ) : (
        <>
          {children.length > 1 && (
            <div className="flex items-center gap-3 flex-wrap">
              {children.map((c, i) => (
                <button
                  key={c._id}
                  type="button"
                  onClick={() => {
                    setChildIdx(i);
                    if (typeof window !== "undefined") localStorage.setItem(CHILD_KEY, String(i));
                  }}
                  className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${i === activeIdx ? "border-primary bg-primary/5" : "border-border bg-card hover:bg-muted/50"}`}
                >
                  <div className="h-8 w-8 shrink-0 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center overflow-hidden">
                    {c.photo ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.photo} alt={c.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-white text-xs font-bold">{c.name.charAt(0).toUpperCase()}</span>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-sm font-semibold text-foreground">{c.name}</p>
                    <p className="text-xs text-muted-foreground">Class {c.class}{c.section ? `-${c.section}` : ""}</p>
                  </div>
                  {!c.isActive && (
                    <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">Inactive</span>
                  )}
                </button>
              ))}
            </div>
          )}

          {child && <ChildOverview key={child._id} child={child} />}
        </>
      )}
    </div>
  );
}

function ChildOverview({ child }: { child: Child }) {
  const [d, setD] = useState<OverviewData | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const token = getToken();
      if (!token) return;
      const now = new Date();
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const [attR, prevR, resR, exR, hwR, feeR, ttR, ntR] = await Promise.all([
        apiGet<AttResp>(`/attendance/student/${child._id}?month=${now.getMonth() + 1}&year=${now.getFullYear()}`, token).catch(() => null),
        apiGet<AttResp>(`/attendance/student/${child._id}?month=${prev.getMonth() + 1}&year=${prev.getFullYear()}`, token).catch(() => null),
        apiGet<ResultsResp>(`/results/student/${child._id}`, token).catch(() => null),
        apiGet<ExamsResp>(`/exams?class=${encodeURIComponent(child.class)}`, token).catch(() => null),
        apiGet<HomeworkResp>(`/homework/student/${child._id}`, token).catch(() => null),
        apiGet<FeeStatusResp>(`/fees/student-status/${child._id}`, token).catch(() => null),
        apiGet<TtResp>(`/timetable/student/${child._id}`, token).catch(() => null),
        apiGet<NoticesResp>("/notices", token).catch(() => null),
      ]);
      if (cancelled) return;

      const att = attR?.data.summary ?? null;
      const recentAtt = (attR?.data.records ?? []).slice(0, 5);
      const prevSummary = prevR?.data.summary ?? null;
      const attDelta = att && prevSummary && prevSummary.total > 0 ? att.percentage - prevSummary.percentage : null;

      const results = resR?.data ?? null;
      const avgScore = results && results.results.length > 0 ? results.averagePercentage : null;

      const nowTs = Date.now();
      const exams = (exR?.data ?? [])
        .filter((e) => (!e.section || e.section === child.section) && new Date(e.date).getTime() >= nowTs && e.status !== "cancelled")
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
        .slice(0, 4);

      const pendingAll = (hwR?.data ?? [])
        .filter((h) => !h.submission)
        .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

      let fees: OverviewData["fees"] = null;
      if (feeR) {
        let paid = 0;
        let pending = 0;
        for (const fh of feeR.data.feeHeads) {
          for (const m of fh.months) {
            if (m.paid) paid += m.paidAmount || m.amount;
            else pending += Math.max(0, m.amount - (m.concession || 0));
          }
        }
        const total = paid + pending;
        fees = { paid, pending, total, pct: total > 0 ? Math.round((paid / total) * 100) : 0 };
      }

      setD({
        att,
        recentAtt,
        attDelta,
        avgScore,
        avgCount: results?.results.length ?? 0,
        exams,
        hwPendingCount: pendingAll.length,
        pendingHw: pendingAll.slice(0, 4),
        fees,
        timetable: ttR?.data ?? [],
        notices: (ntR?.data ?? []).slice(0, 3),
      });
    })();
    return () => {
      cancelled = true;
    };
  }, [child._id, child.class, child.section]);

  if (!d) return <PageLoader label="Loading overview..." />;

  const fees = d.fees;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        <Link href="/dashboard/attendance" className={`${CARD} p-5 flex items-start justify-between gap-3 transition hover:border-primary/40 group`}>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-green-100 text-green-600 flex items-center justify-center">
              <CalendarCheck className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Attendance</p>
              <p className="text-2xl font-bold mt-0.5 text-foreground">{d.att && d.att.total > 0 ? `${d.att.percentage}%` : "—"}</p>
              <p className="text-xs text-muted-foreground">This Month</p>
              {d.attDelta !== null && (
                <p className={`text-xs font-medium mt-1 ${d.attDelta >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {d.attDelta >= 0 ? "↑" : "↓"} {Math.abs(d.attDelta)}% vs last month
                </p>
              )}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
        </Link>

        <Link href="/dashboard/fees" className={`${CARD} p-5 flex items-start justify-between gap-3 transition hover:border-primary/40 group`}>
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-purple-100 text-purple-600 flex items-center justify-center">
              <Wallet className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-muted-foreground">Fees</p>
              <p className="text-2xl font-bold mt-0.5 text-foreground">{fees ? `₹${fees.pending.toLocaleString("en-IN")}` : "—"}</p>
              <p className="text-xs text-muted-foreground">{fees && fees.pending === 0 ? "All paid" : "Pending"}</p>
              {fees && fees.pending > 0 && (
                <span className="inline-flex items-center gap-1 mt-2 rounded-full bg-primary text-primary-foreground px-3 py-1 text-xs font-semibold">
                  Pay Now <ChevronRight className="h-3 w-3" />
                </span>
              )}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
        </Link>

        <Link href="/dashboard/exams" className={`${CARD} p-5 flex items-start justify-between gap-3 transition hover:border-primary/40 group`}>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-blue-100 text-blue-600 flex items-center justify-center">
              <Award className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Exams</p>
              <p className="text-2xl font-bold mt-0.5 text-foreground">{d.avgScore !== null ? `${d.avgScore}%` : "—"}</p>
              <p className="text-xs text-muted-foreground">{d.avgCount > 0 ? "Average Score" : "No results yet"}</p>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
        </Link>

        <Link href="/dashboard/homework" className={`${CARD} p-5 flex items-start justify-between gap-3 transition hover:border-primary/40 group`}>
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-amber-100 text-amber-600 flex items-center justify-center">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">Homework</p>
              <p className="text-2xl font-bold mt-0.5 text-foreground">{d.hwPendingCount}</p>
              <p className={`text-xs ${d.hwPendingCount === 0 ? "text-green-600 font-medium" : "text-muted-foreground"}`}>
                {d.hwPendingCount === 0 ? "All submitted" : "Pending"}
              </p>
              {d.hwPendingCount > 0 && (
                <span className="inline-flex items-center gap-1 mt-2 rounded-full bg-amber-100 text-amber-700 px-3 py-1 text-xs font-semibold">
                  View Details <ChevronRight className="h-3 w-3" />
                </span>
              )}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary shrink-0" />
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Panel title="Recent Attendance" icon={<Calendar className="h-4 w-4 text-blue-500" />} href="/dashboard/attendance">
          {d.recentAtt.length === 0 ? (
            <Empty text="No records this month." />
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                <span>Date</span>
                <span className="flex gap-6"><span>Status</span><span className="w-10 text-right">Class</span></span>
              </div>
              {d.recentAtt.map((r) => (
                <div key={r._id} className="flex items-center justify-between text-xs">
                  <span className="text-foreground">{fmtFullDate(r.date)}</span>
                  <span className="flex items-center gap-4">
                    <Badge
                      className={`border-0 ${r.status === "present" ? "bg-green-100 text-green-700" : r.status === "late" ? "bg-amber-100 text-amber-700" : "bg-red-100 text-red-700"} capitalize`}
                    >
                      {r.status}
                    </Badge>
                    <span className="w-10 text-right text-muted-foreground">{r.class || "—"}</span>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Upcoming Exams" icon={<ClipboardList className="h-4 w-4 text-pink-500" />} href="/dashboard/exams">
          {d.exams.length === 0 ? (
            <Empty text="No upcoming exams." />
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                <span>Subject</span>
                <span className="flex gap-4"><span>Date</span><span className="w-16 text-right">Status</span></span>
              </div>
              {d.exams.map((e) => (
                <div key={e._id} className="flex items-center justify-between text-xs gap-2">
                  <span className="text-foreground truncate">{e.subject}</span>
                  <span className="flex items-center gap-3 shrink-0">
                    <span className="text-muted-foreground">{fmtShortDate(e.date)}</span>
                    <Badge className="bg-indigo-100 text-indigo-700 border-0 w-16 justify-center">Upcoming</Badge>
                  </span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Upcoming Homework" icon={<BookOpen className="h-4 w-4 text-blue-500" />} href="/dashboard/homework">
          {d.pendingHw.length === 0 ? (
            <Empty text={d.hwPendingCount === 0 ? "All homework submitted." : "No upcoming homework."} />
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] font-medium text-muted-foreground">
                <span>Subject</span>
                <span>Due Date</span>
              </div>
              {d.pendingHw.map((hw) => (
                <div key={hw._id} className="flex items-center justify-between text-xs gap-2">
                  <span className="text-foreground truncate">
                    <span className="font-medium">{hw.subject}</span>
                    <span className="text-muted-foreground"> — {hw.title}</span>
                  </span>
                  <span className="text-muted-foreground shrink-0">{fmtShortDate(hw.dueDate)}</span>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Quick Actions" icon={<Zap className="h-4 w-4 text-purple-500" />}>
          <div className="space-y-2">
            {[
              { label: "View Attendance", href: "/dashboard/attendance", Icon: CalendarCheck, cls: "bg-green-100 text-green-600" },
              { label: "Pay Fees", href: "/dashboard/fees", Icon: IndianRupee, cls: "bg-purple-100 text-purple-600" },
              { label: "Check Homework", href: "/dashboard/homework", Icon: BookOpen, cls: "bg-amber-100 text-amber-600" },
              { label: "View Time Table", href: "/dashboard/timetable", Icon: CalendarClock, cls: "bg-blue-100 text-blue-600" },
            ].map(({ label, href, Icon, cls }) => (
              <Link
                key={label}
                href={href}
                className="flex items-center justify-between gap-2 p-2.5 rounded-lg border border-border hover:border-primary/50 transition-all"
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  <span className={`h-7 w-7 shrink-0 rounded-lg flex items-center justify-center ${cls}`}>
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  <span className="text-xs font-medium text-foreground truncate">{label}</span>
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              </Link>
            ))}
          </div>
        </Panel>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <Panel title="Fee Summary" icon={<IndianRupee className="h-4 w-4 text-orange-500" />} href="/dashboard/fees">
          {!fees ? (
            <Empty text="Fee data unavailable." />
          ) : (
            <div>
              <div className="grid grid-cols-3 gap-2 text-center">
                <div>
                  <p className="text-[11px] text-muted-foreground">Total Fees</p>
                  <p className="text-sm font-bold text-foreground mt-0.5">₹{fees.total.toLocaleString("en-IN")}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Paid</p>
                  <p className="text-sm font-bold text-green-600 mt-0.5">₹{fees.paid.toLocaleString("en-IN")}</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">Pending</p>
                  <p className="text-sm font-bold text-orange-600 mt-0.5">₹{fees.pending.toLocaleString("en-IN")}</p>
                </div>
              </div>
              <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                <div className="h-full rounded-full bg-green-500 transition-all" style={{ width: `${fees.pct}%` }} />
              </div>
              <p className="text-[11px] text-muted-foreground mt-1.5 text-right">{fees.pct}% paid</p>
            </div>
          )}
        </Panel>

        <TimetablePanel entries={d.timetable} />

        <Panel title="Latest Notifications" icon={<Megaphone className="h-4 w-4 text-orange-500" />} href="/dashboard/notices">
          {d.notices.length === 0 ? (
            <Empty text="No notices yet." />
          ) : (
            <div className="space-y-3">
              {d.notices.map((n) => (
                <div key={n._id} className="flex items-start gap-2.5">
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.isUrgent ? "bg-red-500" : "bg-amber-500"}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-xs font-semibold text-foreground truncate">{n.title}</p>
                      <span className="text-[10px] text-muted-foreground shrink-0">{fmtShortDate(n.createdAt)}</span>
                    </div>
                    <p className="text-[11px] text-muted-foreground truncate">{n.content}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Stay Connected" icon={<MessageSquare className="h-4 w-4 text-purple-500" />}>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Get the latest updates, notices and school announcements.
          </p>
          <Link
            href="/dashboard/notices"
            className="mt-4 flex items-center justify-center gap-2 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground px-4 py-2.5 text-xs font-semibold transition-colors"
          >
            View Notices <Megaphone className="h-3.5 w-3.5" />
          </Link>
        </Panel>
      </div>
    </div>
  );
}

function TimetablePanel({ entries }: { entries: TtEntry[] }) {
  const todayIdx = new Date().getDay();
  const defaultDay = todayIdx >= 1 && todayIdx <= 6 ? DAYS[todayIdx - 1] : "Monday";
  const [day, setDay] = useState<string>(defaultDay);

  const periods = entries
    .filter((e) => e.day === day)
    .sort((a, b) => a.periodNumber - b.periodNumber)
    .slice(0, 4);

  return (
    <Panel title="Class Timetable" icon={<CalendarClock className="h-4 w-4 text-blue-500" />} href="/dashboard/timetable">
      <div className="flex items-center gap-1.5 mb-3 flex-wrap">
        {DAYS.map((full, i) => (
          <button
            key={full}
            type="button"
            onClick={() => setDay(full)}
            className={`px-2.5 py-1 rounded-full text-[11px] font-semibold transition-colors ${day === full ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-muted/70"}`}
          >
            {DAY_TABS[i]}
          </button>
        ))}
      </div>
      {periods.length === 0 ? (
        <Empty text="No classes scheduled." />
      ) : (
        <div className="space-y-2">
          {periods.map((p) => (
            <div key={p._id} className="flex items-center gap-3 text-xs">
              <span className="h-6 w-6 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-[11px] font-bold">
                {p.periodNumber}
              </span>
              <span className="flex-1 min-w-0">
                <span className="font-medium text-foreground block truncate">{p.subject}</span>
              </span>
              <span className="text-muted-foreground shrink-0">{p.startTime}{p.endTime ? ` – ${p.endTime}` : ""}</span>
            </div>
          ))}
        </div>
      )}
    </Panel>
  );
}
