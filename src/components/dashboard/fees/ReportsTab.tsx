"use client";

import { useState, useEffect } from "react";
import { RefreshCw, Check } from "lucide-react";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Combobox, ComboboxInputGroup, ComboboxInput, ComboboxContent, ComboboxEmpty, ComboboxItem } from "@/components/ui/combobox";

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
  return (
    <div className="flex justify-center py-12">
      <RefreshCw className="h-6 w-6 text-[#94A3B8] animate-spin" />
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="text-left text-xs font-medium text-[#64748B] px-4 py-3 uppercase tracking-wider">{children}</th>;
}

function EmptyRow({ cols, msg }: { cols: number; msg: string }) {
  return <tr><td colSpan={cols} className="px-4 py-10 text-center text-sm text-[#64748B]">{msg}</td></tr>;
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
  if (!data) return <div className="text-center py-10 text-[#64748B]">Failed to load</div>;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-[16px] bg-white p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.07)]"><p className="text-xs text-[#64748B]">Today</p><p className="text-xl font-bold text-green-600">{fmt(data.today.collected)}</p><p className="text-xs text-[#64748B]">{data.today.payments} payments</p></div>
        <div className="rounded-[16px] bg-white p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.07)]"><p className="text-xs text-[#64748B]">This Week</p><p className="text-xl font-bold text-[#4F46E5]">{fmt(data.week.collected)}</p><p className="text-xs text-[#64748B]">{data.week.payments} payments</p></div>
        <div className="rounded-[16px] bg-white p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.07)]"><p className="text-xs text-[#64748B]">This Month</p><p className="text-xl font-bold text-[#172554]">{fmt(data.month.collected)}</p><p className="text-xs text-[#64748B]">{data.month.payments} payments</p></div>
        <div className="rounded-[16px] bg-white p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.07)]"><p className="text-xs text-[#64748B]">This Year</p><p className="text-xl font-bold text-[#172554]">{fmt(data.year.collected)}</p></div>
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="rounded-[16px] bg-white p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.07)] border-l-4 border-amber-500"><p className="text-xs text-[#64748B]">Total Pending</p><p className="text-xl font-bold text-amber-600">{fmt(data.pending)}</p></div>
        <div className="rounded-[16px] bg-white p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.07)] border-l-4 border-red-500"><p className="text-xs text-[#64748B]">Late Fees Collected</p><p className="text-xl font-bold text-red-600">{fmt(data.lateFees)}</p></div>
        <div className="rounded-[16px] bg-white p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.07)] border-l-4 border-green-500"><p className="text-xs text-[#64748B]">Concessions Given</p><p className="text-xl font-bold text-green-600">{fmt(data.concessions)}</p></div>
        <div className="rounded-[16px] bg-white p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.07)] border-l-4 border-blue-500"><p className="text-xs text-[#64748B]">Total Overdue</p><p className="text-xl font-bold text-blue-600">{fmt(data.overdue)}</p></div>
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
    <div className="rounded-[18px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
      <div className="p-4 border-b border-[#F1F5F9] flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-base font-semibold text-[#172554]">Outstanding Dues ({filtered.length})</h3>
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
          <thead><tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
            {["Student", "Class", "Month", "Amount", "Days Overdue", "Status"].map((h) => <Th key={h}>{h}</Th>)}
          </tr></thead>
          <tbody>
            {filtered.length === 0 && <EmptyRow cols={6} msg="No outstanding dues" />}
            {filtered.map((inv) => {
              const status = getStatus(inv);
              return (
                <tr key={`${inv._id}-${inv.student?._id}`} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                  <td className="px-4 py-3 text-sm font-medium text-[#172554]">{inv.student?.name || "—"}</td>
                  <td className="px-4 py-3 text-sm text-[#64748B]">{inv.student ? `Class ${inv.student.class}-${inv.student.section}` : "—"}</td>
                  <td className="px-4 py-3 text-sm text-[#64748B]">{inv.month === "one-time" ? "One-Time" : getMonthLabel(inv.month)}</td>
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
    <div className="rounded-[18px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
      <div className="p-4 border-b border-[#F1F5F9]"><h3 className="text-base font-semibold text-[#172554]">Class-wise Report</h3></div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead><tr className="border-b border-[#F1F5F9] bg-[#F8FAFC]">
            {["Class", "Total Students", "Paid", "Unpaid", "Collected", "Outstanding Amt"].map((h) => <Th key={h}>{h}</Th>)}
          </tr></thead>
          <tbody>
            {data.length === 0 && <EmptyRow cols={6} msg="No data" />}
            {data.map((c) => (
              <tr key={c.className} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]">
                <td className="px-4 py-3 text-sm font-medium text-[#172554]">{c.className}</td>
                <td className="px-4 py-3 text-sm text-[#64748B]">{c.totalCount}</td>
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
      {data.length === 0 && <div className="p-10 text-center text-sm text-[#64748B]">No fee data for this student</div>}
      {data.map((group) => {
        const fs = group.feeStructure;
        const months = group.months || [];
        const summary = group.summary;
        return (
          <div key={fs._id} className="border border-[#E2E8F0] rounded-lg overflow-hidden">
            <div className="bg-[#F8FAFC] px-4 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold">{fs.title}</span>
                {freqBadge(fs.frequency)}
              </div>
              <span className="text-xs text-[#64748B]">₹{fs.amount.toLocaleString("en-IN")}{fs.frequency === "one-time" || fs.frequency === "yearly" ? "" : "/month"}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead><tr className="border-b border-[#E2E8F0] bg-[#F8FAFC]/60">
                  <Th>Month</Th><Th>Amount</Th><Th>Late Fee</Th><Th>Concession</Th><Th>Total</Th><Th>Paid</Th><Th>Balance</Th><Th>Status</Th><Th>Receipt</Th>
                </tr></thead>
                <tbody>
                  {months.map((row) => (
                    <tr key={row.month} className="border-b border-[#F1F5F9] hover:bg-[#F8FAFC]/60">
                      <td className="px-4 py-2.5 text-sm">{row.month === "one-time" ? "One-Time" : getMonthLabel(row.month)}</td>
                      <td className="px-4 py-2.5 text-sm">{fmt(row.amount)}</td>
                      <td className="px-4 py-2.5 text-sm text-red-600">{row.lateFee > 0 ? `+${fmt(row.lateFee)}` : "—"}</td>
                      <td className="px-4 py-2.5 text-sm text-green-600">{row.concession > 0 ? `-${fmt(row.concession)}` : "—"}</td>
                      <td className="px-4 py-2.5 text-sm font-semibold">{fmt(row.total)}</td>
                      <td className="px-4 py-2.5 text-sm text-green-600">{row.paidAmount > 0 ? fmt(row.paidAmount) : "—"}</td>
                      <td className="px-4 py-2.5 text-sm text-red-600 font-semibold">{row.balance > 0 ? fmt(row.balance) : "—"}</td>
                      <td className="px-4 py-2.5">{getStatusBadge(row.status)}</td>
                      <td className="px-4 py-2.5 text-xs font-mono text-[#94A3B8] max-w-[140px] truncate" title={row.receiptNo || ""}>{row.receiptNo || "—"}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-[#F8FAFC] font-semibold text-sm">
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
        <div className="border border-[#4F46E5]/20 rounded-lg bg-[#4F46E5]/5 p-4">
          <h4 className="text-sm font-semibold mb-3">Grand Summary</h4>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-sm">
            <div><span className="text-[#64748B]">Total Amount</span><p className="font-bold">{fmt(grandSummary.totalAmount)}</p></div>
            <div><span className="text-[#64748B]">Late Fees</span><p className="font-bold text-red-600">{fmt(grandSummary.totalLateFee)}</p></div>
            <div><span className="text-[#64748B]">Concessions</span><p className="font-bold text-green-600">{fmt(grandSummary.totalConcession)}</p></div>
            <div><span className="text-[#64748B]">Total Paid</span><p className="font-bold text-green-600">{fmt(grandSummary.totalPaid)}</p></div>
            <div><span className="text-[#64748B]">Balance</span><p className="font-bold text-red-600">{fmt(grandSummary.totalBalance)}</p></div>
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
      <div className="flex gap-1 p-1 bg-[#F1F5F9] rounded-xl w-fit flex-wrap">
        {REPORT_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setRptTab(t.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${rptTab === t.id ? "bg-white text-[#4F46E5] shadow-sm" : "text-[#64748B] hover:text-[#172554]"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {rptTab === "collection" && <RptCollectionSummary />}
      {rptTab === "outstanding" && <RptOutstandingDues classFilter={rptClass} setClassFilter={setRptClass} classes={classes} students={students} />}
      {rptTab === "classwise" && <RptClassWise />}
      {rptTab === "ledger" && (
        <div className="rounded-[18px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <div className="p-4 border-b border-[#F1F5F9] flex items-center gap-3 flex-wrap">
            <h3 className="text-base font-semibold text-[#172554]">Student Ledger</h3>
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
            <div className="p-10 text-center text-sm text-[#64748B]">Select a student to view ledger</div>
          )}
        </div>
      )}
    </div>
  );
}
