"use client";

import { useEffect, useState } from "react";
import { CalendarClock, ChevronDown, ChevronRight, Award, Download, Loader2, BookOpen, CheckCircle2, XCircle } from "lucide-react";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/EmptyState";
import { PageLoader } from "@/components/PageLoader";
import { downloadReportCard, type ReportCardData } from "@/lib/reportCard";

interface Child {
  _id: string;
  name: string;
  studentId?: string;
  class?: string;
  section?: string;
  rollNumber?: string;
}

interface SchoolBranding {
  schoolName?: string;
  schoolAddress?: string;
  schoolPhone?: string;
  schoolEmail?: string;
  logo?: string;
  themeColor?: string;
  secondaryColor?: string;
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
  isAbsent: boolean;
  remarks?: string;
}

interface ResultGroup {
  groupId: string;
  title: string;
  date: string;
  isTerm: boolean;
  rows: ResultRow[];
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
  const [results, setResults] = useState<{ groups: ResultGroup[]; averagePercentage: number } | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [exportingId, setExportingId] = useState<string | null>(null);
  const [branding, setBranding] = useState<SchoolBranding>({});

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
    apiGet<{ success: boolean; data: SchoolBranding }>("/school/branding", token)
      .then((res) => setBranding(res.data))
      .catch(() => {});
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
    apiGet<{ success: boolean; data: { groups: ResultGroup[]; averagePercentage: number } }>(`/results/student/${selectedChildId}`, token)
      .then((res) => setResults(res.data))
      .catch(() => setResults({ groups: [], averagePercentage: 0 }));
  }, [selectedChildId]);

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const exportResultCard = async (group: ResultGroup) => {
    setExportingId(group.groupId);
    try {
      const child = children.find((c) => c._id === selectedChildId);
      const attempted = group.rows.filter((r) => !r.isAbsent);
      const groupAverage = attempted.length > 0 ? Math.round(attempted.reduce((s, r) => s + r.percentage, 0) / attempted.length) : 0;
      const dates = group.rows.map((r) => r.exam?.date).filter(Boolean) as string[];
      const fmt = (d: string) => new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
      const examDateRange = dates.length
        ? dates.every((d) => d === dates[0])
          ? fmt(dates[0])
          : `${fmt(dates.reduce((a, b) => (a < b ? a : b)))} – ${fmt(dates.reduce((a, b) => (a > b ? a : b)))}`
        : undefined;

      const data: ReportCardData = {
        school: branding,
        studentName: child?.name || "Student",
        studentClass: child?.class || "",
        studentSection: child?.section,
        studentId: child?.studentId,
        rollNumber: child?.rollNumber,
        examTitle: group.title,
        examDateRange,
        generatedDate: new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
        averagePercentage: groupAverage,
        rows: group.rows.map((r) => ({
          subject: r.exam?.subject || "—",
          date: r.exam?.date ? fmt(r.exam.date) : "—",
          totalMarks: r.totalMarks,
          marksObtained: r.marksObtained,
          percentage: r.percentage,
          grade: r.grade,
          remarks: r.remarks,
          isAbsent: r.isAbsent,
          isPassed: r.isPassed,
        })),
      };
      downloadReportCard(data, `${(child?.name || "student").replace(/\s+/g, "_")}_${group.title.replace(/\s+/g, "_")}_report_card.pdf`);
    } finally {
      setExportingId(null);
    }
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Exams</h1>
          <p className="text-sm text-muted-foreground mt-1">Upcoming exams and published results.</p>
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
          <CardContent className="py-4">
            <EmptyState icon={BookOpen} message="No child linked to your account yet." />
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
              <PageLoader label="Loading exams..." />
            ) : upcoming.length === 0 ? (
              <Card>
                <CardContent className="py-4">
                  <EmptyState icon={CalendarClock} message="No upcoming exams scheduled." />
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
                            {isTerm && (open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />)}
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {isTerm ? `${item.subjects.length} subject${item.subjects.length === 1 ? "" : "s"}` : item.subject} ·{" "}
                                {new Date(item.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                {isTerm && item.endDate ? ` – ${new Date(item.endDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}` : ""}
                              </p>
                            </div>
                          </div>
                          <span className="shrink-0 text-xs font-semibold px-2.5 py-1 rounded-full bg-primary/10 text-primary">
                            {formatCountdown(item.date)}
                          </span>
                        </button>
                        {isTerm && open && (
                          <div className="px-5 pb-4">
                            <div className="rounded-xl border border-border overflow-hidden">
                              {item.subjects.map((s) => (
                                <div key={s._id} className="flex items-center justify-between px-4 py-2.5 border-b border-border last:border-0">
                                  <div>
                                    <p className="text-xs font-semibold text-foreground">{s.subject}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                      {new Date(s.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                                      {s.duration ? ` · ${s.duration} min` : ""}
                                    </p>
                                  </div>
                                  <span className="text-xs text-muted-foreground">{s.totalMarks} marks</span>
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
              <PageLoader label="Loading results..." />
            ) : results.groups.length === 0 ? (
              <Card>
                <CardContent className="py-4">
                  <EmptyState icon={Award} message="No published results yet." />
                </CardContent>
              </Card>
            ) : (
              <div className="space-y-4">
                <div className="rounded-[16px] bg-card p-4 shadow-[0_0_0_1px_rgba(15,23,42,0.07)] flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Award className="h-4 w-4" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-foreground leading-none">{results.averagePercentage}%</p>
                    <p className="text-xs text-muted-foreground mt-1">Average score</p>
                  </div>
                </div>

                <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
                  {results.groups.map((g) => {
                    const open = expanded.has(g.groupId);
                    const attempted = g.rows.filter((r) => !r.isAbsent);
                    const groupAverage = attempted.length > 0 ? Math.round(attempted.reduce((s, r) => s + r.percentage, 0) / attempted.length) : 0;
                    return (
                      <div key={g.groupId} className="border-b border-border last:border-0">
                        <div className="flex items-center justify-between gap-4 px-5 py-4">
                          <button
                            type="button"
                            onClick={() => toggleExpand(g.groupId)}
                            className="flex items-center gap-2 min-w-0 text-left flex-1"
                          >
                            {open ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-foreground truncate">{g.title}</p>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                {g.rows.length} subject{g.rows.length === 1 ? "" : "s"} · {new Date(g.date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                              </p>
                            </div>
                          </button>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-sm font-medium text-foreground">{groupAverage}% avg</span>
                            <Button
                              variant="outline" size="sm"
                              onClick={() => exportResultCard(g)}
                              disabled={exportingId === g.groupId}
                              className="gap-1.5"
                            >
                              {exportingId === g.groupId ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                              Download Report Card
                            </Button>
                          </div>
                        </div>
                        {open && (
                          <div className="px-5 pb-4">
                            <div className="rounded-xl border border-border overflow-hidden">
                              {g.rows.map((r) => (
                                <div key={r._id} className="flex items-center justify-between px-4 py-2.5 border-b border-border last:border-0 gap-3">
                                  <div className="min-w-0">
                                    <p className="text-xs font-semibold text-foreground">{r.exam?.subject}</p>
                                    <p className="text-[11px] text-muted-foreground">
                                      {r.exam?.date ? new Date(r.exam.date).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "—"}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    {r.isAbsent ? (
                                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">Absent</span>
                                    ) : (
                                      <>
                                        <span className="text-sm font-medium text-foreground">{r.marksObtained}/{r.totalMarks}</span>
                                        <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-muted text-foreground/90">{r.grade}</span>
                                        {r.isPassed ? (
                                          <CheckCircle2 className="h-4 w-4 text-green-600" />
                                        ) : (
                                          <XCircle className="h-4 w-4 text-red-600" />
                                        )}
                                      </>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
