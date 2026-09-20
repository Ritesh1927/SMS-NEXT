"use client";

import { useState, useEffect } from "react";
import { Check, CalendarCheck, CalendarRange, Calendar, TrendingUp, AlertCircle, Clock, Tag, AlertTriangle } from "lucide-react";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox, ComboboxInputGroup, ComboboxInput, ComboboxContent, ComboboxEmpty, ComboboxItem } from "@/components/ui/combobox";
import { StatFilterCard } from "@/components/StatFilterCard";
import { PageLoader } from "@/components/PageLoader";

interface ClassOption { _id: string; name: string; section: string }
interface StudentOption { _id: string; name: string; class: string; section: string; studentId: string }

const fmt = (n: number) => `₹${(n || 0).toLocaleString("en-IN")}`;
const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const getMonthLabel = (month: string) => {
  if (!month || month === "one-time") return "One-Time";
  const [y, m] = month.split("-");
  return `${MONTH_NAMES[parseInt(m, 10) - 1]} ${y}`;
};

function Spinner() {
  return <PageLoader />;
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left text-xs font-medium text-muted-foreground px-4 py-3 uppercase tracking-wider">{children}</th>;
}

function EmptyRow({ cols, msg }: { cols: number; msg: string }) {
  return <tr><td colSpan={cols} className="px-4 py-10 text-center text-sm text-muted-foreground">{msg}</td></tr>;
}

interface CollectionSummaryData {
  today: { collected: number; payments: number };
  week: { collected: number; payments: number };
  month: { collected: number; payments: number };
  year: { collected: number };
  pending: number;
  overdue: number;
  lateFees: number;
  concessions: number;
}

function RptCollectionSummary() {
  const [data, setData] = useState<CollectionSummaryData | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<{ success: boolean; data: CollectionSummaryData }>("/fees/reports/collection", token)
      .then((r) => setData(r.data))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <Spinner />;
  if (!data) return <div className="text-center py-10 text-muted-foreground">Failed to load</div>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatFilterCard icon={CalendarCheck} color="#16A34A" colorDark="#15803D" value={fmt(data.today.collected)} label="Today" sublabel={`${data.today.payments} payments`} />
        <StatFilterCard icon={CalendarRange} color="#4F46E5" colorDark="#4338CA" value={fmt(data.week.collected)} label="This Week" sublabel={`${data.week.payments} payments`} />
        <StatFilterCard icon={Calendar} color="#8B5CF6" colorDark="#7C3AED" value={fmt(data.month.collected)} label="This Month" sublabel={`${data.month.payments} payments`} />
        <StatFilterCard icon={TrendingUp} color="#0EA5E9" colorDark="#0284C7" value={fmt(data.year.collected)} label="This Year" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatFilterCard icon={AlertCircle} color="#F59E0B" colorDark="#D97706" value={fmt(data.pending)} label="Total Pending" />
        <StatFilterCard icon={Clock} color="#DC2626" colorDark="#B91C1C" value={fmt(data.lateFees)} label="Late Fees Collected" />
        <StatFilterCard icon={Tag} color="#16A34A" colorDark="#15803D" value={fmt(data.concessions)} label="Concessions Given" />
        <StatFilterCard icon={AlertTriangle} color="#0EA5E9" colorDark="#0284C7" value={fmt(data.overdue)} label="Total Overdue" />
      </div>
    </div>
  );
}

interface OutstandingRow {
  _id: string; month: string;
  student: { _id: string; name: string; class: string; section: string } | null;
  total: number; daysOverdue: number; status: "overdue" | "pending";
}

function RptOutstandingDues({ classFilter, setClassFilter, classes, students }: {
  classFilter: string; setClassFilter: (v: string) => void; classes: ClassOption[]; students: StudentOption[];
}) {
  const [data, setData] = useState<OutstandingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [outstandingStudent, setOutstandingStudent] = useState("");
  const currentMonth = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`;

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: loading flag for the fetch this effect starts.
    setLoading(true);
    const qs = classFilter && classFilter !== "all" ? `?class=${encodeURIComponent(classFilter)}` : "";
    apiGet<{ success: boolean; data: OutstandingRow[] }>(`/fees/reports/outstanding${qs}`, token)
      .then((r) => setData(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [classFilter]);

  const getStatus = (inv: OutstandingRow) => {
    if (inv.month === "one-time") return inv.status === "overdue" ? "Overdue" : "Pending";
    if (inv.month > currentMonth) return "Upcoming";
    if (inv.status === "overdue") return "Overdue";
    return "Pending";
  };
  const getStatusBadge = (status: string) => {
    if (status === "Overdue") return "bg-red-100 text-red-700";
    if (status === "Pending") return "bg-yellow-100 text-yellow-700";
    return "bg-blue-100 text-blue-700";
  };

  const filtered = outstandingStudent ? data.filter((inv) => inv.student?._id === outstandingStudent) : data;
  const filteredStudentList = students.filter((s) => classFilter === "all" || `${s.class}-${s.section}` === classFilter);
  const selectedStudentObj = filteredStudentList.find((s) => s._id === outstandingStudent) || null;

  if (loading) return <Spinner />;
  return (
    <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
      <div className="p-4 border-b border-border flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-base font-semibold text-foreground">Outstanding Dues ({filtered.length})</h3>
        <div className="flex items-center gap-3">
          <Select value={classFilter} onValueChange={(v) => setClassFilter(v || "all")}>
            <SelectTrigger className="w-44"><SelectValue placeholder="All Classes" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Classes</SelectItem>
              {classes.map((c) => <SelectItem key={c._id} value={`${c.name}-${c.section}`}>Class {c.name}-{c.section}</SelectItem>)}
            </SelectContent>
          </Select>
          <Combobox<StudentOption | null>
            items={filteredStudentList}
            value={selectedStudentObj}
            onValueChange={(v) => setOutstandingStudent(v?._id || "")}
            itemToStringLabel={(s) => (s ? `${s.name} — Class ${s.class}-${s.section}` : "All Students")}
            isItemEqualToValue={(a, b) => a?._id === b?._id}
          >
            <ComboboxInputGroup className="w-64">
              <ComboboxInput placeholder="All Students" />
            </ComboboxInputGroup>
            <ComboboxContent>
              <ComboboxEmpty>No student found.</ComboboxEmpty>
              {filteredStudentList.map((s) => (
                <ComboboxItem key={s._id} value={s}>
                  <Check className={`size-4 ${outstandingStudent === s._id ? "opacity-100" : "opacity-0"}`} />
                  {s.name} (Class {s.class}-{s.section})
                </ComboboxItem>
              ))}
            </ComboboxContent>
          </Combobox>
        </div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-border bg-muted/50">
            {["Student", "Class", "Month", "Amount", "Days Overdue", "Status"].map((h) => <Th key={h}>{h}</Th>)}
          </tr></thead>
          <tbody>
            {filtered.length === 0 && <EmptyRow cols={6} msg="No outstanding dues" />}
            {filtered.map((inv) => {
              const status = getStatus(inv);
              return (
                <tr key={`${inv._id}-${inv.student?._id}`} className="border-b border-border hover:bg-muted/50">
                  <td className="px-4 py-3 text-sm font-medium text-foreground">{inv.student?.name || "—"}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{inv.student ? `Class ${inv.student.class}-${inv.student.section}` : "—"}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{inv.month === "one-time" ? "One-Time" : getMonthLabel(inv.month)}</td>
                  <td className="px-4 py-3 text-sm font-semibold">{fmt(inv.total)}</td>
                  <td className="px-4 py-3 text-sm text-red-600 font-semibold">{inv.daysOverdue > 0 ? `${inv.daysOverdue}d` : "—"}</td>
                  <td className="px-4 py-3"><Badge variant="secondary" className={`text-xs ${getStatusBadge(status)}`}>{status}</Badge></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface ClassWiseRow { className: string; collected: number; pending: number; paid: number; pendingCount: number; totalCount: number }

function RptClassWise() {
  const [data, setData] = useState<ClassWiseRow[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<{ success: boolean; data: ClassWiseRow[] }>("/fees/reports/class-wise", token)
      .then((r) => setData(r.data || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  if (loading) return <Spinner />;
  return (
    <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
      <div className="p-4 border-b border-border"><h3 className="text-base font-semibold text-foreground">Class-wise Report</h3></div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-border bg-muted/50">
            {["Class", "Total Students", "Paid", "Unpaid", "Collected", "Outstanding Amt"].map((h) => <Th key={h}>{h}</Th>)}
          </tr></thead>
          <tbody>
            {data.length === 0 && <EmptyRow cols={6} msg="No data" />}
            {data.map((c) => (
              <tr key={c.className} className="border-b border-border hover:bg-muted/50">
                <td className="px-4 py-3 text-sm font-medium text-foreground">{c.className}</td>
                <td className="px-4 py-3 text-sm text-muted-foreground">{c.totalCount}</td>
                <td className="px-4 py-3 text-sm text-green-600 font-semibold">{c.paid}</td>
                <td className="px-4 py-3 text-sm text-amber-600 font-semibold">{c.pendingCount}</td>
                <td className="px-4 py-3 text-sm font-semibold">{fmt(c.collected)}</td>
                <td className="px-4 py-3 text-sm text-red-600">{c.pending > 0 ? fmt(c.pending) : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

interface LedgerMonthRow {
  month: string; amount: number; lateFee: number; concession: number; total: number;
  paidAmount: number; balance: number; status: "paid" | "pending" | "upcoming"; receiptNo: string | null;
}
interface LedgerGroup {
  feeStructure: { _id: string; title: string; amount: number; frequency: string };
  months: LedgerMonthRow[];
  summary: { totalAmount: number; totalLateFee: number; totalConcession: number; totalPaid: number; totalBalance: number };
}
interface GrandSummary { totalAmount: number; totalLateFee: number; totalConcession: number; totalPaid: number; totalBalance: number }

function RptStudentLedger({ studentId }: { studentId: string }) {
  const [data, setData] = useState<LedgerGroup[]>([]);
  const [grandSummary, setGrandSummary] = useState<GrandSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    const token = getToken();
    if (!token) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: loading flag for the fetch this effect starts.
    setLoading(true);
    apiGet<{ success: boolean; data: LedgerGroup[]; grandSummary: GrandSummary }>(`/fees/reports/student-ledger/${studentId}`, token)
      .then((r) => { setData(r.data || []); setGrandSummary(r.grandSummary); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [studentId]);

  const getStatusBadge = (status: string) => {
    if (status === "paid") return <Badge variant="secondary" className="text-xs bg-green-100 text-green-700">Paid</Badge>;
    if (status === "pending") return <Badge variant="secondary" className="text-xs bg-yellow-100 text-yellow-700">Pending</Badge>;
    return <Badge variant="secondary" className="text-xs bg-blue-100 text-blue-700">Upcoming</Badge>;
  };
  const freqBadge = (f: string) => {
    if (f === "one-time" || f === "yearly") return <Badge variant="outline" className="text-xs ml-2">{f}</Badge>;
    return <Badge className="text-xs ml-2">{f}</Badge>;
  };

  if (loading) return <Spinner />;
  return (
    <div className="space-y-4">
      {data.length === 0 && <div className="p-10 text-center text-sm text-muted-foreground">No fee data for this student</div>}
      {data.map((group) => {
        const fs = group.feeStructure;
        const months = group.months || [];
        const summary = group.summary;
        return (
          <div key={fs._id} className="border border-border rounded-lg overflow-hidden">
            <div className="bg-muted/50 px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{fs.title}</span>
                {freqBadge(fs.frequency)}
              </div>
              <span className="text-xs text-muted-foreground">₹{fs.amount.toLocaleString("en-IN")}{fs.frequency === "one-time" || fs.frequency === "yearly" ? "" : "/month"}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-border bg-muted/50/60">
                  <Th>Month</Th><Th>Amount</Th><Th>Late Fee</Th><Th>Concession</Th><Th>Total</Th><Th>Paid</Th><Th>Balance</Th><Th>Status</Th><Th>Receipt</Th>
                </tr></thead>
                <tbody>
                  {months.map((row) => (
                    <tr key={row.month} className="border-b border-border hover:bg-muted/50/60">
                      <td className="px-4 py-2.5 text-sm">{row.month === "one-time" ? "One-Time" : getMonthLabel(row.month)}</td>
                      <td className="px-4 py-2.5 text-sm">{fmt(row.amount)}</td>
                      <td className="px-4 py-2.5 text-sm text-red-600">{row.lateFee > 0 ? `+${fmt(row.lateFee)}` : "—"}</td>
                      <td className="px-4 py-2.5 text-sm text-green-600">{row.concession > 0 ? `-${fmt(row.concession)}` : "—"}</td>
                      <td className="px-4 py-2.5 text-sm font-semibold">{fmt(row.total)}</td>
                      <td className="px-4 py-2.5 text-sm text-green-600">{row.paidAmount > 0 ? fmt(row.paidAmount) : "—"}</td>
                      <td className="px-4 py-2.5 text-sm text-red-600 font-semibold">{row.balance > 0 ? fmt(row.balance) : "—"}</td>
                      <td className="px-4 py-2.5">{getStatusBadge(row.status)}</td>
                      <td className="px-4 py-2.5 text-xs font-mono text-muted-foreground/70 max-w-[140px] truncate" title={row.receiptNo || ""}>{row.receiptNo || "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/50 font-semibold text-sm">
                    <td className="px-4 py-2.5">Total</td>
                    <td className="px-4 py-2.5">{fmt(summary.totalAmount)}</td>
                    <td className="px-4 py-2.5 text-red-600">{summary.totalLateFee > 0 ? `+${fmt(summary.totalLateFee)}` : "—"}</td>
                    <td className="px-4 py-2.5 text-green-600">{summary.totalConcession > 0 ? `-${fmt(summary.totalConcession)}` : "—"}</td>
                    <td className="px-4 py-2.5">{fmt(summary.totalAmount + summary.totalLateFee - summary.totalConcession)}</td>
                    <td className="px-4 py-2.5 text-green-600">{fmt(summary.totalPaid)}</td>
                    <td className="px-4 py-2.5 text-red-600">{summary.totalBalance > 0 ? fmt(summary.totalBalance) : "—"}</td>
                    <td className="px-4 py-2.5" colSpan={2}></td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>
        );
      })}
      {grandSummary && (
        <div className="border border-primary/20 rounded-lg bg-primary/5 p-4">
          <h4 className="text-sm font-semibold mb-3">Grand Summary</h4>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
            <div><span className="text-muted-foreground">Total Amount</span><p className="font-bold">{fmt(grandSummary.totalAmount)}</p></div>
            <div><span className="text-muted-foreground">Late Fees</span><p className="font-bold text-red-600">{fmt(grandSummary.totalLateFee)}</p></div>
            <div><span className="text-muted-foreground">Concessions</span><p className="font-bold text-green-600">{fmt(grandSummary.totalConcession)}</p></div>
            <div><span className="text-muted-foreground">Total Paid</span><p className="font-bold text-green-600">{fmt(grandSummary.totalPaid)}</p></div>
            <div><span className="text-muted-foreground">Balance</span><p className="font-bold text-red-600">{fmt(grandSummary.totalBalance)}</p></div>
          </div>
        </div>
      )}
    </div>
  );
}

const REPORT_TABS = [
  { id: "collection", label: "Collection Summary" },
  { id: "outstanding", label: "Outstanding Dues" },
  { id: "classwise", label: "Class-wise" },
  { id: "ledger", label: "Student Ledger" },
];

export default function ReportsTab({ classes, students }: { classes: ClassOption[]; students: StudentOption[] }) {
  const [rptTab, setRptTab] = useState("collection");
  const [rptClass, setRptClass] = useState("all");
  const [rptStudent, setRptStudent] = useState("");

  const filteredStudentList = students.filter((s) => rptClass === "all" || `${s.class}-${s.section}` === rptClass);
  const selectedLedgerStudent = filteredStudentList.find((s) => s._id === rptStudent) || null;

  return (
    <div className="space-y-4">
      <div className="inline-flex w-fit flex-wrap items-center justify-center gap-1 rounded-full border border-border/60 bg-muted/60 p-1.5 text-muted-foreground shadow-[inset_0_1px_2px_rgba(15,23,42,0.04)]">
        {REPORT_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setRptTab(t.id)}
            className={`relative inline-flex items-center justify-center gap-1.5 rounded-full border border-transparent px-4 py-2 text-sm font-semibold whitespace-nowrap transition-all duration-300 ${
              rptTab === t.id
                ? "bg-gradient-to-br from-primary to-accent text-white shadow-[0_4px_14px_-2px_rgba(79,70,229,0.45)]"
                : "text-muted-foreground hover:text-foreground hover:bg-card/60"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {rptTab === "collection" && <RptCollectionSummary />}
      {rptTab === "outstanding" && <RptOutstandingDues classFilter={rptClass} setClassFilter={setRptClass} classes={classes} students={students} />}
      {rptTab === "classwise" && <RptClassWise />}
      {rptTab === "ledger" && (
        <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <div className="p-4 border-b border-border flex items-center gap-3 flex-wrap">
            <h3 className="text-base font-semibold text-foreground">Student Ledger</h3>
            <Select value={rptClass} onValueChange={(v) => { setRptClass(v || "all"); setRptStudent(""); }}>
              <SelectTrigger className="w-44"><SelectValue placeholder="All Classes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Classes</SelectItem>
                {classes.map((c) => <SelectItem key={c._id} value={`${c.name}-${c.section}`}>Class {c.name}-{c.section}</SelectItem>)}
              </SelectContent>
            </Select>
            <Combobox<StudentOption | null>
              items={filteredStudentList}
              value={selectedLedgerStudent}
              onValueChange={(v) => setRptStudent(v?._id || "")}
              itemToStringLabel={(s) => (s ? `${s.name} — Class ${s.class}-${s.section}` : "")}
              isItemEqualToValue={(a, b) => a?._id === b?._id}
            >
              <ComboboxInputGroup className="w-64">
                <ComboboxInput placeholder="Select student..." />
              </ComboboxInputGroup>
              <ComboboxContent>
                <ComboboxEmpty>No student found.</ComboboxEmpty>
                {filteredStudentList.map((s) => (
                  <ComboboxItem key={s._id} value={s}>
                    <Check className={`size-4 ${rptStudent === s._id ? "opacity-100" : "opacity-0"}`} />
                    {s.name} (Class {s.class}-{s.section})
                  </ComboboxItem>
                ))}
              </ComboboxContent>
            </Combobox>
          </div>
          {rptStudent ? <RptStudentLedger studentId={rptStudent} /> : (
            <div className="p-10 text-center text-sm text-muted-foreground">Select a student to view ledger</div>
          )}
        </div>
      )}
    </div>
  );
}
