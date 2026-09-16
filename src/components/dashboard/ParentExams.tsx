"use client";

import { useEffect, useState } from "react";
import { CalendarClock, ChevronDown, ChevronRight, Award, Download, Loader2, BookOpen, CheckCircle2, XCircle } from "lucide-react";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";

interface Child {
  _id: string;
  name: string;
}

interface UpcomingSubject {
  _id: string;
  subject: string;
  date: string;
  totalMarks: number;
  passingMarks: number;
  duration: number | null;
}

interface UpcomingItem {
  _id: string;
  title: string;
  subject: string;
  date: string;
  endDate: string | null;
  examType: string;
  class: string;
  section?: string;
  status: string;
  totalMarks: number | null;
  passingMarks: number | null;
  duration: number | null;
  description: string;
  source: "exam" | "scheduledExam";
  subjects: UpcomingSubject[];
}

interface ResultRow {
  _id: string;
  exam: { title: string; subject: string; date: string; examType: string; totalMarks: number };
  marksObtained: number;
  totalMarks: number;
  percentage: number;
  grade: string;
  isPassed: boolean;
}

function formatCountdown(dateIso: string) {
  const now = new Date();
  const target = new Date(dateIso);
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate());
  const days = Math.round((startOfTarget.getTime() - startOfToday.getTime()) / 86400000);
  if (days < 0) return "In progress";
  if (days === 0) return "Today";
  if (days === 1) return "Tomorrow";
  if (days <= 7) return `In ${days} days`;
  return target.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ParentExams() {
  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");
  const [loadingChildren, setLoadingChildren] = useState(true);

  const [upcoming, setUpcoming] = useState<UpcomingItem[] | null>(null);
  const [results, setResults] = useState<{ results: ResultRow[]; averagePercentage: number } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<{ success: boolean; data: { children: Child[] } }>("/dashboard/parent", token)
      .then((res) => {
        setChildren(res.data.children);
        if (res.data.children.length > 0) setSelectedChildId(res.data.children[0]._id);
      })
      .catch(() => {})
      .finally(() => setLoadingChildren(false));
  }, []);

  useEffect(() => {
    if (!selectedChildId) return;
    const token = getToken();
    if (!token) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: reset + refetch whenever the selected child changes.
    setUpcoming(null);
    setResults(null);
    apiGet<{ success: boolean; data: UpcomingItem[] }>(`/exams/upcoming?studentId=${selectedChildId}`, token)
      .then((res) => setUpcoming(res.data))
      .catch(() => setUpcoming([]));
    apiGet<{ success: boolean; data: { results: ResultRow[]; averagePercentage: number } }>(`/results/student/${selectedChildId}`, token)
      .then((res) => setResults(res.data))
      .catch(() => setResults({ results: [], averagePercentage: 0 }));
  }, [selectedChildId]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportResultCard = async () => {
    if (!results || results.results.length === 0) return;
    setExporting(true);
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const child = children.find((c) => c._id === selectedChildId);
      const doc = new jsPDF();
      doc.setFontSize(16);
      doc.text("Result Card", 14, 18);
      doc.setFontSize(11);
      doc.text(child?.name || "Student", 14, 26);
      doc.text(`Average: ${results.averagePercentage}%`, 14, 33);
      autoTable(doc, {
        startY: 40,
        head: [["Exam", "Subject", "Date", "Marks", "Grade", "Result"]],
        body: results.results.map((r) => [
          r.exam?.title || "—",
          r.exam?.subject || "—",
          r.exam?.date ? new Date(r.exam.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—",
          `${r.marksObtained}/${r.totalMarks}`,
          r.grade,
          r.isPassed ? "Pass" : "Fail",
        ]),
        headStyles: { fillColor: [79, 70, 229] },
      });
      doc.save(`${(child?.name || "student").replace(/\s+/g, "_")}_result_card.pdf`);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#172554]">Exams</h1>
          <p className="text-sm text-[#64748B] mt-1">Upcoming exams and published results.</p>
        </div>
        {children.length > 1 && (
          <Select value={selectedChildId} onValueChange={(v) => setSelectedChildId(v || "")}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="Select child" /></SelectTrigger>
            <SelectContent>
              {children.map((c) => (
                <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {!loadingChildren && children.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-16 text-[#64748B]">
            <BookOpen className="h-12 w-12 mb-3 opacity-30" />
            <p className="text-sm">No child linked to your account yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="upcoming" className="space-y-4">
          <TabsList>
            <TabsTrigger value="upcoming">Upcoming</TabsTrigger>
            <TabsTrigger value="results">Results</TabsTrigger>
          </TabsList>

          <TabsContent value="upcoming">
            {!upcoming ? (
              <div className="flex items-center gap-2 text-sm text-[#64748B] py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
            ) : upcoming.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-[#64748B]">
                  <CalendarClock className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm">No upcoming exams scheduled.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-3">
                {upcoming.map((item) => {
                  const isTerm = item.source === "scheduledExam";
                  const open = expanded.has(item._id);
                  return (
                    <Card key={item._id}>
                      <CardContent className="p-0">
                        <button
                          type="button"
                          onClick={() => isTerm && toggleExpand(item._id)}
                          className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            {isTerm && (open ? <ChevronDown className="h-4 w-4 text-[#64748B] shrink-0" /> : <ChevronRight className="h-4 w-4 text-[#64748B] shrink-0" />)}
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-[#172554] truncate">{item.title}</p>
                              <p className="text-xs text-[#64748B] mt-0.5">
                                {isTerm ? `${item.subjects.length} subject${item.subjects.length === 1 ? "" : "s"}` : item.subject} ·{" "}
                                {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                {isTerm && item.endDate ? ` – ${new Date(item.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                              </p>
                            </div>
                          </div>
                          <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-[#EEF2FF] text-[#4F46E5]">
                            {formatCountdown(item.date)}
                          </span>
                        </button>
                        {isTerm && open && (
                          <div className="px-5 pb-4">
                            <div className="rounded-xl border border-[#F1F5F9] overflow-hidden">
                              {item.subjects.map((s) => (
                                <div key={s._id} className="flex items-center justify-between px-4 py-2.5 border-b border-[#F1F5F9] last:border-0">
                                  <div>
                                    <p className="text-xs font-semibold text-[#172554]">{s.subject}</p>
                                    <p className="text-[11px] text-[#64748B]">
                                      {new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                      {s.duration ? ` · ${s.duration} min` : ""}
                                    </p>
                                  </div>
                                  <span className="text-xs text-[#64748B]">{s.totalMarks} marks</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </TabsContent>

          <TabsContent value="results">
            {!results ? (
              <div className="flex items-center gap-2 text-sm text-[#64748B] py-6"><Loader2 className="h-4 w-4 animate-spin" /> Loading...</div>
            ) : results.results.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-16 text-[#64748B]">
                  <Award className="h-12 w-12 mb-3 opacity-30" />
                  <p className="text-sm">No published results yet.</p>
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="rounded-[16px] bg-white p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.07)] flex items-center gap-3">
                    <div className="h-9 w-9 rounded-full bg-[#EEF2FF] text-[#4F46E5] flex items-center justify-center shrink-0">
                      <Award className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-[#172554] leading-none">{results.averagePercentage}%</p>
                      <p className="text-xs text-[#64748B] mt-1">Average score</p>
                    </div>
                  </div>
                  <Button variant="outline" onClick={exportResultCard} disabled={exporting} className="gap-1.5">
                    {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                    Download Result Card
                  </Button>
                </div>

                <div className="rounded-[18px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
                  {results.results.map((r) => (
                    <div key={r._id} className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9] last:border-0 gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-[#172554] truncate">{r.exam?.title || "—"}</p>
                        <p className="text-xs text-[#64748B] mt-0.5">
                          {r.exam?.subject} · {r.exam?.date ? new Date(r.exam.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "—"}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-sm font-medium text-[#172554]">{r.marksObtained}/{r.totalMarks}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-[#F1F5F9] text-[#334155]">{r.grade}</span>
                        {r.isPassed ? (
                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                        ) : (
                          <XCircle className="h-4 w-4 text-red-600" />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
