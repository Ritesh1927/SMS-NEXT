"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Sparkles, MessageCircle, ClipboardList, Megaphone, TrendingUp, FileText, DollarSign, Calendar,
  Send, Copy, Check, Loader2, Plus, Trash2,
} from "lucide-react";
import { useAuth, getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

// Lightweight markdown-ish renderer for AI responses — bold/italic/inline
// code/line breaks, ported from SMS-FRONTEND's AiPage.tsx (dropped its
// table/numbered-list/bullet regex passes since none of the prompts here
// produce those shapes).
function renderMarkdown(text: string): string {
  if (!text) return "";
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.*?)\*/g, "<em>$1</em>")
    .replace(/`(.*?)`/g, '<code class="bg-[#F1F5F9] px-1.5 py-0.5 rounded text-xs font-mono">$1</code>')
    .replace(/\n/g, "<br/>");
}

type Tool = "insights" | "reportcard" | "feeletter" | "quiz" | "notice" | "eventplanner";

interface ToolDef {
  id: Tool;
  label: string;
  icon: typeof MessageCircle;
  roles: string[];
}

const TOOLS: ToolDef[] = [
  { id: "insights", label: "School Insights", icon: TrendingUp, roles: ["schooladmin"] },
  { id: "reportcard", label: "Report Card Comments", icon: FileText, roles: ["schooladmin"] },
  { id: "feeletter", label: "Fee Reminder Letter", icon: DollarSign, roles: ["schooladmin"] },
  { id: "quiz", label: "Quiz Generator", icon: ClipboardList, roles: ["teacher"] },
  { id: "eventplanner", label: "Event Planner", icon: Calendar, roles: ["schooladmin", "teacher"] },
  { id: "notice", label: "Notice Generator", icon: Megaphone, roles: ["schooladmin", "teacher"] },
];

interface QuizQuestion {
  question: string;
  options: string[];
  correct?: string;
  explanation?: string;
}

interface ChatTurn {
  role: "user" | "ai";
  text: string;
}

interface RcSubject {
  id: string;
  name: string;
  marks: string;
  total: string;
}

function CopyButton({ text, copied, onCopy }: { text: string; copied: boolean; onCopy: (text: string) => void }) {
  return (
    <Button variant="ghost" size="sm" className="gap-1.5 text-xs" onClick={() => onCopy(text)}>
      {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
      {copied ? "Copied!" : "Copy"}
    </Button>
  );
}

async function aiPost(question: string, subject = "general", extra: Record<string, unknown> = {}): Promise<string> {
  const token = getToken();
  const res = await fetch("/api/ai/study-assistant", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
    body: JSON.stringify({ question, subject, ...extra }),
  });
  const json = await res.json();
  if (!res.ok || json.success === false) throw new Error(json.message || "AI request failed.");
  return json.answer || "";
}

export default function AiPage() {
  const { user } = useAuth();
  const visibleTools = TOOLS.filter((t) => t.roles.includes(user?.role || ""));
  const [selectedTool, setSelectedTool] = useState<Tool | null>(null);
  const activeTool = selectedTool && visibleTools.some((t) => t.id === selectedTool) ? selectedTool : (visibleTools[0]?.id ?? null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  // ── School Insights ──────────────────────────────────────
  const [insightMessages, setInsightMessages] = useState<ChatTurn[]>([]);
  const [insightInput, setInsightInput] = useState("");
  const [schoolStats, setSchoolStats] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (activeTool !== "insights" || schoolStats !== null) return;
    const token = getToken();
    if (!token) return;
    apiGet<{ success: boolean; data: Record<string, unknown> }>("/ai/school-context", token)
      .then((res) => setSchoolStats(res.data))
      .catch(() => setSchoolStats(null));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTool]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [insightMessages]);

  const insightContext = (stats: Record<string, unknown> | null): string => {
    if (!stats) return "";
    const s = stats as {
      currentMonth?: string;
      totalStudents?: number;
      totalTeachers?: number;
      totalCollected?: number;
      totalPending?: number;
      allStudents?: { name: string; class: string; section: string; studentId: string }[];
      allTeachers?: { name: string; designation: string; subjects: string[] }[];
      classSummary?: {
        class: string;
        students: number;
        studentNames: string[];
        attendancePct: number | null;
        pendingFees: number;
        pendingFeeStudentNames: string[];
        avgMarks: number | null;
      }[];
      pendingFeeStudents?: { name: string; class: string; section: string; amount: number; items: string[] }[];
      lowAttendanceStudents?: { name: string; class: string; pct: number }[];
    };
    let ctx = `=== LIVE SCHOOL DATABASE — ${s.currentMonth ?? "This Month"} ===\n\n`;
    ctx += `OVERVIEW:\n`;
    ctx += `• Total Students: ${s.totalStudents ?? 0}\n`;
    ctx += `• Total Teachers: ${s.totalTeachers ?? 0}\n`;
    ctx += `• Total Fee Collected: ₹${(s.totalCollected ?? 0).toLocaleString()}\n`;
    ctx += `• Total Fee Pending: ₹${(s.totalPending ?? 0).toLocaleString()}\n\n`;

    if (s.allStudents?.length) {
      ctx += `ALL STUDENTS:\n`;
      s.allStudents.forEach((st) => {
        ctx += `• ${st.name} — Class: ${st.class}${st.section ? "-" + st.section : ""}${st.studentId ? ` (ID: ${st.studentId})` : ""}\n`;
      });
      ctx += "\n";
    }
    if (s.allTeachers?.length) {
      ctx += `ALL TEACHERS:\n`;
      s.allTeachers.forEach((t) => {
        ctx += `• ${t.name} — ${t.designation}${t.subjects?.length ? ` | Subjects: ${t.subjects.join(", ")}` : ""}\n`;
      });
      ctx += "\n";
    }
    if (s.classSummary?.length) {
      ctx += `CLASS-WISE DETAILS:\n`;
      s.classSummary.forEach((c) => {
        ctx += `Class ${c.class} (${c.students} students: ${c.studentNames.join(", ")})\n`;
        if (c.attendancePct !== null) ctx += `  → Attendance this month: ${c.attendancePct}%\n`;
        ctx += c.pendingFees > 0
          ? `  → Pending Fees: ₹${c.pendingFees.toLocaleString()} — Students with dues: ${c.pendingFeeStudentNames.join(", ")}\n`
          : `  → Pending Fees: None (all paid)\n`;
        if (c.avgMarks !== null) ctx += `  → Average Marks: ${c.avgMarks}%\n`;
      });
      ctx += "\n";
    }
    if (s.pendingFeeStudents?.length) {
      ctx += `FEE PENDING — STUDENT-WISE:\n`;
      s.pendingFeeStudents.forEach((p) => {
        ctx += `• ${p.name} (${p.class}${p.section ? "-" + p.section : ""}): ₹${p.amount.toLocaleString()} pending${p.items.length ? ` [${p.items.join(", ")}]` : ""}\n`;
      });
      ctx += "\n";
    } else {
      ctx += `FEE PENDING: No pending fees found.\n\n`;
    }
    if (s.lowAttendanceStudents?.length) {
      ctx += `LOW ATTENDANCE STUDENTS (below 75%):\n`;
      s.lowAttendanceStudents.forEach((st) => {
        ctx += `• ${st.name} (${st.class}): ${st.pct}% attendance\n`;
      });
      ctx += "\n";
    }
    ctx += `=== END OF SCHOOL DATA ===\n\nUsing the exact data above, answer the following question. If the data contains the answer, state it directly with names and amounts. Do not say data is unavailable if it is listed above.\n\nQuestion: `;
    return ctx;
  };

  const handleInsightSend = async (preset?: string) => {
    const msg = (preset ?? insightInput).trim();
    if (!msg) return;
    setInsightInput("");
    setInsightMessages((p) => [...p, { role: "user", text: msg }]);
    setLoading(true);
    try {
      const history = insightMessages.map((m) => ({ role: m.role === "ai" ? "assistant" : "user", content: m.text }));
      const reply = await aiPost(msg, "school management", { schoolContext: insightContext(schoolStats), conversationHistory: history });
      setInsightMessages((p) => [...p, { role: "ai", text: reply || "How can I help you?" }]);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "AI failed to respond.");
    } finally {
      setLoading(false);
    }
  };

  // ── Report Card ──────────────────────────────────────────
  const [rcStudent, setRcStudent] = useState("");
  const [rcClass, setRcClass] = useState("");
  const [rcAttendance, setRcAttendance] = useState("");
  const [rcBehavior, setRcBehavior] = useState("good");
  const [rcSubjects, setRcSubjects] = useState<RcSubject[]>([{ id: "1", name: "", marks: "", total: "100" }]);
  const [rcComment, setRcComment] = useState("");

  const addRcSubject = () => setRcSubjects((p) => [...p, { id: Date.now().toString(), name: "", marks: "", total: "100" }]);
  const removeRcSubject = (id: string) => setRcSubjects((p) => p.filter((s) => s.id !== id));
  const updateRcSubject = (id: string, field: keyof RcSubject, val: string) =>
    setRcSubjects((p) => p.map((s) => (s.id === id ? { ...s, [field]: val } : s)));

  const handleReportCard = async () => {
    if (!rcStudent.trim()) return toast.error("Enter student name.");
    const filled = rcSubjects.filter((s) => s.name.trim() && s.marks.trim());
    if (filled.length === 0) return toast.error("Add at least one subject with marks.");
    setLoading(true);
    setRcComment("");
    try {
      const subjectLine = filled.map((s) => `${s.name}: ${s.marks}/${s.total}`).join(", ");
      const behaviorLabels: Record<string, string> = {
        excellent: "excellent behavior and discipline",
        good: "good conduct and attitude",
        average: "satisfactory conduct",
        needsImprovement: "behavior that needs improvement",
      };
      const prompt = `Write a professional report card comment for a school student.

Student: ${rcStudent}
Class: ${rcClass || "Not specified"}
Attendance: ${rcAttendance ? rcAttendance + "%" : "Not specified"}
Conduct: ${behaviorLabels[rcBehavior] || "good"}
Subject Performance: ${subjectLine}

Write a warm, professional 3–4 sentence comment that:
1. Summarises overall academic performance
2. Highlights specific strengths (reference subjects where appropriate)
3. Notes areas for improvement constructively
4. Ends with encouragement

Reply with only the comment text — no heading, no formatting marks.`;
      setRcComment(await aiPost(prompt, "education"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate comment.");
    } finally {
      setLoading(false);
    }
  };

  // ── Fee Letter ────────────────────────────────────────────
  const [flParent, setFlParent] = useState("");
  const [flStudent, setFlStudent] = useState("");
  const [flClass, setFlClass] = useState("");
  const [flAmount, setFlAmount] = useState("");
  const [flDueDate, setFlDueDate] = useState("");
  const [flTone, setFlTone] = useState("polite");
  const [flLetter, setFlLetter] = useState("");

  const handleFeeLetter = async () => {
    if (!flParent.trim() || !flStudent.trim() || !flAmount.trim()) return toast.error("Enter parent name, student name and amount.");
    setLoading(true);
    setFlLetter("");
    try {
      const toneMap: Record<string, string> = {
        polite: "polite and understanding",
        firm: "firm and assertive",
        final: "urgent — this is a final notice before escalation",
      };
      const prompt = `Draft a professional school fee reminder letter.

Parent Name: ${flParent}
Student Name: ${flStudent}
Class: ${flClass || "Not specified"}
Amount Due: ₹${flAmount}
Due Date: ${flDueDate || "at the earliest"}
Tone: ${toneMap[flTone] || "polite"}

The letter must:
• Be from the School Administration
• Be formal and professional
• Clearly state the outstanding amount and due date
• Include a request for prompt payment
• For firm/final tone — mention consequences (late fee, admission hold)
• End with [School Name], [Principal Name], [Contact] as placeholders

Write only the complete letter — no extra commentary.`;
      setFlLetter(await aiPost(prompt, "school administration"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate letter.");
    } finally {
      setLoading(false);
    }
  };

  // ── Quiz ──────────────────────────────────────────────────
  const [quizSubject, setQuizSubject] = useState("");
  const [quizTopic, setQuizTopic] = useState("");
  const [quizClass, setQuizClass] = useState("");
  const [quizCount, setQuizCount] = useState("5");
  const [quizResult, setQuizResult] = useState<QuizQuestion[]>([]);

  const handleGenerateQuiz = async () => {
    if (!quizSubject.trim() || !quizTopic.trim()) return toast.error("Fill in subject and topic.");
    setLoading(true);
    setQuizResult([]);
    const token = getToken();
    try {
      const res = await fetch("/api/ai/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject: quizSubject, topic: quizTopic, class: quizClass, count: parseInt(quizCount, 10) }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) throw new Error(json.message || "Failed to generate quiz.");
      setQuizResult(Array.isArray(json.questions) ? json.questions : []);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate quiz.");
    } finally {
      setLoading(false);
    }
  };

  // ── Notice ────────────────────────────────────────────────
  const [noticeType, setNoticeType] = useState("");
  const [noticeDetails, setNoticeDetails] = useState("");
  const [noticeResult, setNoticeResult] = useState("");

  const handleGenerateNotice = async () => {
    if (!noticeType.trim() || !noticeDetails.trim()) return toast.error("Fill in type and details.");
    setLoading(true);
    setNoticeResult("");
    const token = getToken();
    try {
      const res = await fetch("/api/ai/generate-notice", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ topic: noticeType, details: noticeDetails }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) throw new Error(json.message || "Failed to generate notice.");
      setNoticeResult(json.notice || "");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate notice.");
    } finally {
      setLoading(false);
    }
  };

  // ── Event Planner ─────────────────────────────────────────
  const [epName, setEpName] = useState("");
  const [epType, setEpType] = useState("");
  const [epDate, setEpDate] = useState("");
  const [epParticipants, setEpParticipants] = useState("");
  const [epBudget, setEpBudget] = useState("");
  const [epPlan, setEpPlan] = useState("");

  const handleEventPlan = async () => {
    if (!epName.trim() || !epType.trim()) return toast.error("Enter event name and type.");
    setLoading(true);
    setEpPlan("");
    try {
      const prompt = `Create a detailed school event plan.

Event Name: ${epName}
Event Type: ${epType}
Date: ${epDate || "To be confirmed"}
Expected Participants: ${epParticipants || "Not specified"}
Estimated Budget: ${epBudget ? "₹" + epBudget : "Not specified"}

Provide a structured plan with:
1. Event Objectives
2. Full Day Timeline (hour-by-hour schedule)
3. Resources & Materials Required
4. Roles & Responsibilities
5. Budget Breakdown (if budget provided)
6. Pre-Event Checklist
7. Post-Event Actions

Format with clear headings and bullet points.`;
      setEpPlan(await aiPost(prompt, "event planning"));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate event plan.");
    } finally {
      setLoading(false);
    }
  };

  if (!user || visibleTools.length === 0) {
    return <p className="text-sm text-[#64748B]">No AI tools available for your role.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#172554] flex items-center gap-2">
          AI Assistant <Sparkles className="h-5 w-5 text-[#2563EB]" />
        </h1>
        <p className="text-sm text-[#64748B]">AI-powered tools to help you run the school.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-2">
          {visibleTools.map((tool) => {
            const isActive = activeTool === tool.id;
            return (
              <button
                key={tool.id}
                onClick={() => setSelectedTool(tool.id)}
                className={`w-full text-left rounded-xl p-3.5 border transition-all flex items-center gap-3 ${
                  isActive ? "border-[#2563EB] bg-[#2563EB]/5" : "border-[#E2E8F0] bg-white hover:bg-[#F8FAFC]"
                }`}
              >
                <div className={`h-8 w-8 rounded-lg flex items-center justify-center shrink-0 ${isActive ? "bg-[#2563EB]" : "bg-[#2563EB]/10"}`}>
                  <tool.icon className={`h-4 w-4 ${isActive ? "text-white" : "text-[#2563EB]"}`} />
                </div>
                <span className={`text-sm font-medium ${isActive ? "text-[#2563EB]" : "text-[#172554]"}`}>{tool.label}</span>
              </button>
            );
          })}
        </div>

        <div className="lg:col-span-2">
          {activeTool === "insights" && (
            <Card className="flex flex-col h-[600px]">
              <CardHeader className="pb-3 border-b border-[#E2E8F0] shrink-0">
                <CardTitle className="text-sm">School Insights</CardTitle>
                <p className="text-xs text-[#64748B]">Ask about students, fees, attendance or results — grounded in your live data.</p>
              </CardHeader>
              <CardContent className="flex-1 overflow-y-auto p-4 space-y-3">
                {insightMessages.length === 0 && (
                  <div className="flex flex-wrap gap-2">
                    {["How is overall student performance?", "Which classes have low attendance?", "Give me a fee collection summary."].map((p) => (
                      <button
                        key={p}
                        onClick={() => handleInsightSend(p)}
                        className="text-xs px-3 py-1.5 rounded-full border border-[#E2E8F0] text-[#64748B] hover:border-[#2563EB]/40 hover:text-[#2563EB]"
                      >
                        {p}
                      </button>
                    ))}
                  </div>
                )}
                {insightMessages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[85%] rounded-xl px-3.5 py-2.5 text-sm ${
                        m.role === "user" ? "bg-[#2563EB] text-white" : "bg-[#F8FAFC] text-[#172554]"
                      }`}
                      dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }}
                    />
                  </div>
                ))}
                {loading && (
                  <div className="flex justify-start">
                    <Loader2 className="h-4 w-4 animate-spin text-[#2563EB]" />
                  </div>
                )}
                <div ref={endRef} />
              </CardContent>
              <div className="p-3 border-t border-[#E2E8F0] flex gap-2 shrink-0">
                <Input
                  value={insightInput}
                  onChange={(e) => setInsightInput(e.target.value)}
                  placeholder="Ask about your school…"
                  onKeyDown={(e) => e.key === "Enter" && handleInsightSend()}
                  disabled={loading}
                />
                <Button onClick={() => handleInsightSend()} disabled={loading || !insightInput.trim()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </Card>
          )}

          {activeTool === "reportcard" && (
            <Card>
              <CardHeader className="border-b border-[#E2E8F0]">
                <CardTitle className="text-sm">Report Card Comments</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Student name" value={rcStudent} onChange={(e) => setRcStudent(e.target.value)} />
                  <Input placeholder="Class (e.g. 8-A)" value={rcClass} onChange={(e) => setRcClass(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Attendance %" value={rcAttendance} onChange={(e) => setRcAttendance(e.target.value)} />
                  <Select value={rcBehavior} onValueChange={(v) => setRcBehavior(v || "good")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="excellent">Excellent</SelectItem>
                      <SelectItem value="good">Good</SelectItem>
                      <SelectItem value="average">Average</SelectItem>
                      <SelectItem value="needsImprovement">Needs Improvement</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  {rcSubjects.map((s) => (
                    <div key={s.id} className="flex gap-2">
                      <Input placeholder="Subject" value={s.name} onChange={(e) => updateRcSubject(s.id, "name", e.target.value)} className="flex-1" />
                      <Input placeholder="Marks" value={s.marks} onChange={(e) => updateRcSubject(s.id, "marks", e.target.value)} className="w-20" />
                      <Input placeholder="Total" value={s.total} onChange={(e) => updateRcSubject(s.id, "total", e.target.value)} className="w-20" />
                      {rcSubjects.length > 1 && (
                        <Button variant="ghost" size="icon" onClick={() => removeRcSubject(s.id)}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      )}
                    </div>
                  ))}
                  <Button variant="outline" size="sm" className="gap-1.5" onClick={addRcSubject}>
                    <Plus className="h-3.5 w-3.5" /> Add Subject
                  </Button>
                </div>
                <Button onClick={handleReportCard} disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Generate Comment
                </Button>
                {rcComment && (
                  <div className="rounded-lg border border-[#E2E8F0] p-4 bg-[#F8FAFC] space-y-2">
                    <p className="text-sm text-[#172554]" dangerouslySetInnerHTML={{ __html: renderMarkdown(rcComment) }} />
                    <CopyButton text={rcComment} copied={copied} onCopy={handleCopy} />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTool === "feeletter" && (
            <Card>
              <CardHeader className="border-b border-[#E2E8F0]">
                <CardTitle className="text-sm">Fee Reminder Letter</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Parent name" value={flParent} onChange={(e) => setFlParent(e.target.value)} />
                  <Input placeholder="Student name" value={flStudent} onChange={(e) => setFlStudent(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Class" value={flClass} onChange={(e) => setFlClass(e.target.value)} />
                  <Input placeholder="Amount due (₹)" value={flAmount} onChange={(e) => setFlAmount(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input type="date" value={flDueDate} onChange={(e) => setFlDueDate(e.target.value)} />
                  <Select value={flTone} onValueChange={(v) => setFlTone(v || "polite")}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="polite">Polite</SelectItem>
                      <SelectItem value="firm">Firm</SelectItem>
                      <SelectItem value="final">Final Notice</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={handleFeeLetter} disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Generate Letter
                </Button>
                {flLetter && (
                  <div className="rounded-lg border border-[#E2E8F0] p-4 bg-[#F8FAFC] space-y-2">
                    <p className="text-sm text-[#172554] whitespace-pre-wrap">{flLetter}</p>
                    <CopyButton text={flLetter} copied={copied} onCopy={handleCopy} />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTool === "quiz" && (
            <Card>
              <CardHeader className="border-b border-[#E2E8F0]">
                <CardTitle className="text-sm">Quiz Generator</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Subject" value={quizSubject} onChange={(e) => setQuizSubject(e.target.value)} />
                  <Input placeholder="Topic" value={quizTopic} onChange={(e) => setQuizTopic(e.target.value)} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Class (optional)" value={quizClass} onChange={(e) => setQuizClass(e.target.value)} />
                  <Input type="number" min={1} max={20} placeholder="Number of questions" value={quizCount} onChange={(e) => setQuizCount(e.target.value)} />
                </div>
                <Button onClick={handleGenerateQuiz} disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Generate Quiz
                </Button>
                {quizResult.length > 0 && (
                  <div className="space-y-3">
                    {quizResult.map((q, i) => (
                      <div key={i} className="rounded-lg border border-[#E2E8F0] p-3">
                        <p className="text-sm font-medium text-[#172554]">
                          {i + 1}. {q.question}
                        </p>
                        <div className="mt-2 space-y-1">
                          {(q.options || []).map((o, j) => (
                            <p key={j} className={`text-xs px-2 py-1 rounded ${o.startsWith(q.correct || "") ? "bg-green-50 text-green-700" : "text-[#64748B]"}`}>
                              {o}
                            </p>
                          ))}
                        </div>
                        {q.explanation && <p className="text-xs text-[#64748B] mt-2 italic">{q.explanation}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTool === "notice" && (
            <Card>
              <CardHeader className="border-b border-[#E2E8F0]">
                <CardTitle className="text-sm">Notice Generator</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <Input placeholder="Notice topic (e.g. Diwali Holiday)" value={noticeType} onChange={(e) => setNoticeType(e.target.value)} />
                <Textarea placeholder="Key details to include…" value={noticeDetails} onChange={(e) => setNoticeDetails(e.target.value)} className="min-h-[100px]" />
                <Button onClick={handleGenerateNotice} disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Generate Notice
                </Button>
                {noticeResult && (
                  <div className="rounded-lg border border-[#E2E8F0] p-4 bg-[#F8FAFC] space-y-2">
                    <p className="text-sm text-[#172554] whitespace-pre-wrap">{noticeResult}</p>
                    <CopyButton text={noticeResult} copied={copied} onCopy={handleCopy} />
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {activeTool === "eventplanner" && (
            <Card>
              <CardHeader className="border-b border-[#E2E8F0]">
                <CardTitle className="text-sm">Event Planner</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="Event name" value={epName} onChange={(e) => setEpName(e.target.value)} />
                  <Input placeholder="Event type (e.g. Sports Day)" value={epType} onChange={(e) => setEpType(e.target.value)} />
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <Input type="date" value={epDate} onChange={(e) => setEpDate(e.target.value)} />
                  <Input placeholder="Participants" value={epParticipants} onChange={(e) => setEpParticipants(e.target.value)} />
                  <Input placeholder="Budget (₹)" value={epBudget} onChange={(e) => setEpBudget(e.target.value)} />
                </div>
                <Button onClick={handleEventPlan} disabled={loading} className="gap-2">
                  {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                  Generate Plan
                </Button>
                {epPlan && (
                  <div className="rounded-lg border border-[#E2E8F0] p-4 bg-[#F8FAFC] space-y-2">
                    <p className="text-sm text-[#172554]" dangerouslySetInnerHTML={{ __html: renderMarkdown(epPlan) }} />
                    <CopyButton text={epPlan} copied={copied} onCopy={handleCopy} />
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
