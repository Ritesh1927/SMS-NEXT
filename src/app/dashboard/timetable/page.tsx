"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Clock, Trash2, Settings, Plus, Zap, BookOpen, Users, Coffee, CalendarDays } from "lucide-react";
import { useAuth, getToken } from "@/contexts/AuthContext";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PageHeader } from "@/components/PageHeader";
import { StatFilterCard } from "@/components/StatFilterCard";
import { PageLoader } from "@/components/PageLoader";

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// A validated categorical palette (fixed hue order, chosen so adjacent hues
// stay distinguishable under color-vision deficiency) instead of an ad hoc
// pick of Tailwind pastels -- see the dataviz skill's reference palette.
// Every chip's fill/border/text below is derived from the same one hex via
// color-mix, so a subject's whole chip reads as one coordinated color
// instead of three separately-chosen shades.
const SUBJECT_HUES = [
  "#2a78d6", // blue
  "#eb6834", // orange
  "#1baf7a", // aqua
  "#e87ba4", // magenta
  "#4a3aa7", // violet
  "#008300", // green
  "#e34948", // red
  "#eda100", // yellow
];

function subjectColor(subject: string, all: string[]) {
  const idx = Math.max(0, all.indexOf(subject)) % SUBJECT_HUES.length;
  const hue = SUBJECT_HUES[idx];
  return {
    dot: hue,
    style: {
      backgroundColor: `color-mix(in srgb, ${hue} 10%, white)`,
      borderColor: `color-mix(in srgb, ${hue} 32%, white)`,
      color: `color-mix(in srgb, ${hue} 72%, black)`,
    } as const,
  };
}

function initials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function timeToMins(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

// "13:20" -> "1:20" -- 12-hour, no leading zero, matches how times are
// entered/edited elsewhere on this page (24-hour) while reading naturally here.
function formatTime(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const hour12 = (h || 0) % 12 || 12;
  return `${hour12}:${String(m || 0).padStart(2, "0")}`;
}

interface SchoolPeriod {
  _id: string;
  label: string;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  periodNumber: number | null;
  order: number;
}

interface ClassOption {
  _id: string;
  name: string;
  section: string;
  classTeacher?: { _id: string; name: string } | null;
}

interface TeacherOption {
  _id: string;
  name: string;
  assignedClasses?: { _id: string }[];
  primarySubject?: string;
  secondarySubject?: string;
}

interface SubjectOption {
  _id: string;
  name: string;
  code: string;
}

interface TTEntry {
  _id: string;
  classId: { _id: string; name: string; section: string } | null;
  teacherId: { _id: string; name: string } | null;
  day: string;
  periodNumber: number;
  subject: string;
}

interface Child {
  _id: string;
  name: string;
  class: string;
  section?: string;
}

function currentPeriodFrom(periods: SchoolPeriod[]): number | null {
  const now = new Date().getHours() * 60 + new Date().getMinutes();
  for (const p of periods) {
    if (!p.isBreak && p.periodNumber !== null) {
      const s = timeToMins(p.startTime);
      const e = timeToMins(p.endTime);
      if (now >= s && now < e) return p.periodNumber;
    }
  }
  return null;
}

export default function TimetablePage() {
  const { user } = useAuth();
  const isAdmin = user?.role === "schooladmin";
  const isTeacher = user?.role === "teacher";
  const isParent = user?.role === "parent";
  const today = new Date().toLocaleDateString("en-US", { weekday: "long" });

  const [periods, setPeriods] = useState<SchoolPeriod[]>([]);
  const [periodsLoading, setPeriodsLoading] = useState(true);
  const [entries, setEntries] = useState<TTEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [selectedClassId, setSelectedClassId] = useState("");
  const [teachers, setTeachers] = useState<TeacherOption[]>([]);
  const [subjectOptions, setSubjectOptions] = useState<SubjectOption[]>([]);

  const [children, setChildren] = useState<Child[]>([]);
  const [selectedChildId, setSelectedChildId] = useState("");

  const [editCell, setEditCell] = useState<{ day: string; periodNumber: number; entry?: TTEntry } | null>(null);
  const [editSubject, setEditSubject] = useState("");
  const [editTeacherId, setEditTeacherId] = useState("");
  const [selectedDays, setSelectedDays] = useState<string[]>(DAYS);
  const [saving, setSaving] = useState(false);
  const [busyTeachers, setBusyTeachers] = useState<Record<string, string>>({});

  const [manageOpen, setManageOpen] = useState(false);
  const [newLabel, setNewLabel] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");
  const [newIsBreak, setNewIsBreak] = useState(false);
  const [addingPeriod, setAddingPeriod] = useState(false);

  const [qCount, setQCount] = useState(8);
  const [qDuration, setQDuration] = useState(40);
  const [qBreakAfter, setQBreakAfter] = useState(5);
  const [qBreakMin, setQBreakMin] = useState(10);
  const [qStart, setQStart] = useState("08:00");
  const [generating, setGenerating] = useState(false);

  const currentPeriod = useMemo(() => currentPeriodFrom(periods), [periods]);

  const grid = useMemo<Record<string, Record<number, TTEntry>>>(() => {
    const g: Record<string, Record<number, TTEntry>> = {};
    entries.forEach((e) => {
      if (!g[e.day]) g[e.day] = {};
      g[e.day][e.periodNumber] = e;
    });
    return g;
  }, [entries]);

  const uniqueSubjects = useMemo(() => [...new Set(entries.map((e) => e.subject))].sort(), [entries]);

  // Only teachers actually assigned to the selected class — either via
  // Teacher.assignedClasses or by being that class's own class teacher —
  // can be scheduled into its periods. Matches the original SMS app's
  // Timetable page filter (it does the same client-side, keyed off
  // assignedClasses); a class's classTeacher is included too so the class's
  // own teacher isn't excluded just for lacking a separate assignedClasses entry.
  const selectedClass = classes.find((c) => c._id === selectedClassId) || null;
  const classTeachers = useMemo(() => {
    if (!selectedClass) return teachers;
    return teachers.filter(
      (t) =>
        t.assignedClasses?.some((c) => c._id === selectedClass._id) ||
        selectedClass.classTeacher?._id === t._id,
    );
  }, [teachers, selectedClass]);

  // Once a period's subject is picked, narrow further to teachers whose
  // primary or secondary subject actually matches it — if that leaves
  // nobody (no assigned teacher has declared this subject), fall back to
  // the full class-assigned list rather than leaving the admin stuck with
  // only "— None —".
  const subjectMatchedTeachers = editSubject
    ? classTeachers.filter((t) => t.primarySubject === editSubject || t.secondarySubject === editSubject)
    : classTeachers;
  const usingSubjectFallback = !!editSubject && subjectMatchedTeachers.length === 0 && classTeachers.length > 0;
  const filteredTeachers = usingSubjectFallback ? classTeachers : subjectMatchedTeachers;

  const loadPeriods = () => {
    const token = getToken();
    if (!token) return;
    apiGet<{ success: boolean; data: SchoolPeriod[] }>("/periods", token)
      .then((res) => setPeriods(res.data))
      .catch(() => setPeriods([]))
      .finally(() => setPeriodsLoading(false));
  };

  useEffect(() => {
    loadPeriods();
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    const token = getToken();
    if (!token) return;
    apiGet<{ success: boolean; data: ClassOption[] }>("/classes", token)
      .then((res) => {
        setClasses(res.data);
        if (res.data.length > 0) setSelectedClassId(res.data[0]._id);
      })
      .catch(() => {});
    apiGet<{ success: boolean; data: TeacherOption[] }>("/teachers", token)
      .then((res) => setTeachers(res.data))
      .catch(() => {});
  }, [isAdmin]);

  useEffect(() => {
    const token = getToken();
    const run = async () => {
      if (!selectedClassId || !token) {
        setSubjectOptions([]);
        return;
      }
      const res = await apiGet<{ success: boolean; data: SubjectOption[] }>(`/subjects/class/${selectedClassId}`, token);
      setSubjectOptions(res.data);
    };
    run().catch(() => setSubjectOptions([]));
  }, [selectedClassId]);

  useEffect(() => {
    if (!isParent) return;
    const token = getToken();
    if (!token) return;
    apiGet<{ success: boolean; data: { children: Child[] } }>("/dashboard/parent", token)
      .then((res) => {
        setChildren(res.data.children);
        if (res.data.children.length > 0) setSelectedChildId(res.data.children[0]._id);
      })
      .catch(() => {});
  }, [isParent]);

  // `showLoader` distinguishes a real navigation (class/child switch, first
  // mount -- show the full loader) from the silent refetch after saving one
  // cell (grid stays on screen; only that cell's data actually changed).
  const loadTimetable = (showLoader = true) => {
    if (showLoader) setLoading(true);
    const token = getToken();
    const run = async () => {
      if (!token || !user) return;
      let url = "";
      if (isAdmin) {
        if (!selectedClassId) return;
        url = `/timetable/class/${selectedClassId}`;
      } else if (isTeacher) {
        url = `/timetable/teacher/${user.id}`;
      } else if (isParent) {
        if (!selectedChildId) return;
        url = `/timetable/student/${selectedChildId}`;
      } else {
        return;
      }
      const res = await apiGet<{ success: boolean; data: TTEntry[] }>(url, token);
      setEntries(res.data);
    };
    run()
      .catch(() => setEntries([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- deliberate: this must flip the full loader back on for a real class/child switch, not just the first mount.
    loadTimetable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, isTeacher, isParent, selectedClassId, selectedChildId, user?.id]);

  const openEditModal = (day: string, periodNumber: number) => {
    if (!isAdmin) return;
    const entry = grid[day]?.[periodNumber];
    setEditCell({ day, periodNumber, entry });
    setEditSubject(entry?.subject ?? "");
    setEditTeacherId(entry?.teacherId?._id ?? "");
    // Editing an existing entry only ever touches that one day; a brand new
    // entry starts with every day checked so the admin unchecks the ones
    // that don't apply, instead of an all-or-one toggle.
    setSelectedDays(entry ? [day] : [...DAYS]);

    const token = getToken();
    if (!token) return;
    setBusyTeachers({});
    apiGet<{ success: boolean; data: TTEntry[] }>("/timetable/all", token)
      .then((res) => {
        const busy: Record<string, string> = {};
        res.data.forEach((e) => {
          if (e.day === day && e.periodNumber === periodNumber && e.teacherId) {
            const className = e.classId ? `${e.classId.name}-${e.classId.section}` : "another class";
            busy[e.teacherId._id] = className;
          }
        });
        setBusyTeachers(busy);
      })
      .catch(() => {});
  };

  const handleSave = async () => {
    if (!editCell || !editSubject.trim() || !selectedClassId || selectedDays.length === 0) return;
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      const daysToSave = selectedDays;
      for (const day of daysToSave) {
        await apiPost(
          "/timetable",
          {
            classId: selectedClassId,
            teacherId: editTeacherId || undefined,
            day,
            periodNumber: editCell.periodNumber,
            subject: editSubject.trim(),
          },
          token,
        );
      }
      loadTimetable(false);
      setEditCell(null);
      toast.success(daysToSave.length > 1 ? `Assigned to ${daysToSave.length} days.` : "Timetable saved.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteEntry = async () => {
    if (!editCell?.entry) return;
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/timetable/${editCell.entry._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json = await res.json();
      if (!res.ok || json.success === false) throw new Error(json.message || "Failed to delete.");
      setEntries((prev) => prev.filter((e) => e._id !== editCell.entry!._id));
      setEditCell(null);
      toast.success("Entry removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddPeriod = async () => {
    if (!newLabel.trim() || !newStart || !newEnd) {
      toast.error("Label, start time and end time are required.");
      return;
    }
    const token = getToken();
    if (!token) return;
    setAddingPeriod(true);
    try {
      await apiPost("/periods", { label: newLabel.trim(), startTime: newStart, endTime: newEnd, isBreak: newIsBreak }, token);
      setNewLabel("");
      setNewStart("");
      setNewEnd("");
      setNewIsBreak(false);
      loadPeriods();
      toast.success("Period added.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to add period.");
    } finally {
      setAddingPeriod(false);
    }
  };

  const handleDeletePeriod = async (id: string) => {
    const token = getToken();
    if (!token) return;
    try {
      const res = await fetch(`/api/periods/${id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok || json.success === false) throw new Error(json.message || "Failed to remove.");
      loadPeriods();
      toast.success("Period removed.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove period.");
    }
  };

  const handleQuickGenerate = async () => {
    if (qCount < 1 || qDuration < 10) {
      toast.error("Please enter valid values.");
      return;
    }
    const token = getToken();
    if (!token) return;
    setGenerating(true);
    try {
      const minsToTime = (mins: number) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      };
      let cursor = timeToMins(qStart);
      const toCreate: { label: string; startTime: string; endTime: string; isBreak: boolean }[] = [];
      for (let i = 1; i <= qCount; i++) {
        const end = cursor + qDuration;
        toCreate.push({ label: `Period ${i}`, startTime: minsToTime(cursor), endTime: minsToTime(end), isBreak: false });
        cursor = end;
        if (i === qBreakAfter && i < qCount) {
          toCreate.push({ label: "Break", startTime: minsToTime(cursor), endTime: minsToTime(cursor + qBreakMin), isBreak: true });
          cursor += qBreakMin;
        }
      }
      for (const p of toCreate) await apiPost("/periods", p, token);
      loadPeriods();
      toast.success(`${toCreate.length} periods generated.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate periods.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <PageHeader
          icon={Clock}
          title="Timetable"
          subtitle={isAdmin ? "View and manage class schedules" : isTeacher ? "Your weekly teaching schedule" : "Your child's class schedule"}
          accent="violet"
        />
        <div className="flex items-center gap-2">
          {isAdmin && (
            <>
              <Select
                items={classes.map((c) => ({ value: c._id, label: `${c.name}${c.section ? `-${c.section}` : ""}` }))}
                value={selectedClassId}
                onValueChange={(v) => setSelectedClassId(v || "")}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue placeholder="Select class" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c._id} value={c._id}>
                      {c.name}
                      {c.section ? `-${c.section}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setManageOpen(true)}>
                <Settings className="h-4 w-4" /> Manage Periods
              </Button>
            </>
          )}
          {isParent && children.length > 1 && (
            <Select
              items={children.map((c) => ({ value: c._id, label: c.name }))}
              value={selectedChildId}
              onValueChange={(v) => setSelectedChildId(v || "")}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Select child" />
              </SelectTrigger>
              <SelectContent>
                {children.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </div>
      </div>

      {!loading && entries.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatFilterCard icon={BookOpen} color="#8B5CF6" colorDark="#7C3AED" value={uniqueSubjects.length} label="Subjects" />
          <StatFilterCard icon={Users} color="#0EA5E9" colorDark="#0284C7" value={new Set(entries.map((e) => e.teacherId?._id).filter(Boolean)).size} label="Teachers" />
          <StatFilterCard icon={Clock} color="#F59E0B" colorDark="#D97706" value={periods.length} label="Period Rows" />
        </div>
      )}

      <div className="card-premium overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[900px] border-separate border-spacing-0">
            <thead>
              <tr className="bg-gradient-to-b from-muted/70 to-muted/30">
                <th className="sticky left-0 z-10 bg-muted/70 p-3.5 text-left text-xs font-semibold text-muted-foreground uppercase tracking-wider w-[140px] border-b border-border">
                  <div className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-primary" /> Time
                  </div>
                </th>
                {DAYS.map((day) => {
                  const isToday = day === today;
                  return (
                    <th
                      key={day}
                      className={`p-3.5 text-center text-xs font-semibold uppercase tracking-wider border-b-2 ${
                        isToday ? "text-primary border-primary bg-primary/5" : "text-muted-foreground border-border"
                      }`}
                    >
                      <div className="flex flex-col items-center gap-1">
                        <span>{day.slice(0, 3)}</span>
                        {isToday && (
                          <span className="flex items-center gap-1 text-[9px] font-bold normal-case tracking-normal text-primary">
                            <CalendarDays className="h-2.5 w-2.5" /> Today
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {periodsLoading || loading ? (
                <tr>
                  <td colSpan={7} className="p-0">
                    <PageLoader label="Loading timetable..." />
                  </td>
                </tr>
              ) : periods.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">
                    {isAdmin ? 'No periods configured. Click "Manage Periods" to add periods.' : "No periods configured yet."}
                  </td>
                </tr>
              ) : (isAdmin && !selectedClassId) || (isParent && !selectedChildId) ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-muted-foreground text-sm">
                    {isParent ? "No child linked to your account yet." : "Select a class to view its timetable."}
                  </td>
                </tr>
              ) : (
                periods.map((period) => {
                  const rowBg = period.isBreak ? "bg-amber-50/40" : "hover:bg-muted/40";
                  return (
                    <tr key={period._id} className={`${rowBg} transition-colors group`}>
                      <td
                        className={`sticky left-0 z-10 p-3 border-b border-border ${
                          period.isBreak ? "bg-amber-50/40" : "bg-card group-hover:bg-muted/40"
                        } transition-colors`}
                      >
                        <div className="text-xs font-semibold text-foreground">{period.label}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {formatTime(period.startTime)} – {formatTime(period.endTime)}
                        </div>
                      </td>
                      {period.isBreak ? (
                        <td colSpan={DAYS.length} className="p-2 border-b border-border">
                          <div className="flex items-center justify-center gap-2 py-1 text-amber-700">
                            <Coffee className="h-3.5 w-3.5" />
                            <span className="text-xs font-semibold">{period.label} · every day</span>
                          </div>
                        </td>
                      ) : (
                        DAYS.map((day) => {
                          const pNum = period.periodNumber!;
                          const entry = grid[day]?.[pNum];
                          const isToday = day === today;
                          const isCurrent = isToday && pNum === currentPeriod;
                          const subj = entry ? subjectColor(entry.subject, uniqueSubjects) : null;
                          return (
                            <td key={day} className={`p-1.5 border-b border-border ${isToday ? "bg-primary/[0.03]" : ""}`}>
                              {entry && subj ? (
                                <div
                                  onClick={() => openEditModal(day, pNum)}
                                  style={subj.style}
                                  className={`relative rounded-xl p-2.5 border text-center transition-all ${
                                    isAdmin ? "cursor-pointer hover:shadow-md hover:-translate-y-0.5" : "cursor-default"
                                  } ${isCurrent ? "ring-2 ring-primary ring-offset-1 shadow-md" : ""}`}
                                >
                                  <p className="text-xs font-semibold leading-tight">{entry.subject}</p>
                                  {entry.teacherId && (
                                    <div className="flex items-center justify-center gap-1 mt-1">
                                      <span
                                        style={{ backgroundColor: subj.style.color }}
                                        className="flex h-3.5 w-3.5 items-center justify-center rounded-full text-[7px] font-bold text-white shrink-0"
                                      >
                                        {initials(entry.teacherId.name)}
                                      </span>
                                      <p className="text-[10px] opacity-70 truncate">{entry.teacherId.name}</p>
                                    </div>
                                  )}
                                  {(isTeacher || isParent) && entry.classId && (
                                    <p className="text-[10px] opacity-60 mt-0.5">
                                      {entry.classId.name}
                                      {entry.classId.section ? `-${entry.classId.section}` : ""}
                                    </p>
                                  )}
                                  {isCurrent && (
                                    <span className="mt-1 inline-flex items-center gap-1 text-[9px] font-bold bg-primary text-white px-1.5 py-0 rounded">
                                      <span className="h-1 w-1 rounded-full bg-white animate-pulse" /> NOW
                                    </span>
                                  )}
                                </div>
                              ) : (
                                <div
                                  onClick={() => openEditModal(day, pNum)}
                                  className={`group/cell h-full min-h-[48px] flex items-center justify-center rounded-xl border border-dashed transition-colors ${
                                    isAdmin ? "cursor-pointer border-border/60 hover:border-primary/40 hover:bg-primary/5" : "border-transparent"
                                  }`}
                                >
                                  {isAdmin ? (
                                    <Plus className="h-3.5 w-3.5 text-muted-foreground/30 group-hover/cell:text-primary/60 transition-colors" />
                                  ) : (
                                    <span className="text-muted-foreground/40 text-xs">—</span>
                                  )}
                                </div>
                              )}
                            </td>
                          );
                        })
                      )}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isAdmin && (
        <Dialog open={!!editCell} onOpenChange={(open) => !open && setEditCell(null)}>
          <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="text-sm">
                {editCell?.entry ? "Edit Entry" : "Add Entry"} — {editCell?.day} · Period {editCell?.periodNumber}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-1">
              <div className="space-y-1.5">
                <Label>
                  Subject <span className="text-red-500">*</span>
                </Label>
                {subjectOptions.length > 0 ? (
                  <Select value={editSubject} onValueChange={(v) => setEditSubject(v || "")}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjectOptions.map((s) => (
                        <SelectItem key={s._id} value={s.name}>
                          {s.name} ({s.code})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input value={editSubject} onChange={(e) => setEditSubject(e.target.value)} placeholder="e.g. Mathematics" maxLength={60} />
                )}
              </div>
              <div className="space-y-1.5">
                <Label>Teacher (optional)</Label>
                <Select
                  items={[{ value: "__none__", label: "— None —" }, ...filteredTeachers.map((t) => ({ value: t._id, label: t.name }))]}
                  value={editTeacherId || "__none__"}
                  onValueChange={(v) => setEditTeacherId(!v || v === "__none__" ? "" : v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— None —</SelectItem>
                    {filteredTeachers.length === 0 && (
                      <p className="px-2 py-1.5 text-xs text-muted-foreground/70">No teacher assigned to this class.</p>
                    )}
                    {filteredTeachers.map((t) => {
                      const busyClass = busyTeachers[t._id];
                      const isBusy = !!busyClass;
                      const isCurrentTeacher = editCell?.entry?.teacherId?._id === t._id;
                      const isClassTeacher = selectedClass?.classTeacher?._id === t._id;
                      return (
                        <SelectItem key={t._id} value={t._id} disabled={isBusy && !isCurrentTeacher}>
                          {t.name}
                          {isBusy && !isCurrentTeacher ? ` — Busy (${busyClass})` : isClassTeacher ? " — Class Teacher" : ""}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                {usingSubjectFallback && (
                  <p className="text-xs text-muted-foreground/70">No assigned teacher has {editSubject} as a subject — showing everyone assigned to this class.</p>
                )}
              </div>
            </div>
            {editSubject && !editCell?.entry && (
              <div className="space-y-1.5 px-1">
                <Label className="text-sm font-normal">Apply to these days</Label>
                <div className="grid grid-cols-3 gap-x-3 gap-y-2">
                  {DAYS.map((day) => {
                    const checked = selectedDays.includes(day);
                    return (
                      <label key={day} htmlFor={`day-${day}`} className="flex items-center gap-2 text-sm cursor-pointer">
                        <input
                          id={`day-${day}`}
                          type="checkbox"
                          checked={checked}
                          onChange={(e) =>
                            setSelectedDays((prev) => (e.target.checked ? [...prev, day] : prev.filter((d) => d !== day)))
                          }
                          className="h-4 w-4"
                        />
                        {day.slice(0, 3)}
                      </label>
                    );
                  })}
                </div>
                {selectedDays.length === 0 && <p className="text-xs text-destructive">Select at least one day.</p>}
              </div>
            )}
            <DialogFooter className="flex gap-2 sm:justify-between mt-2">
              {editCell?.entry && (
                <Button variant="destructive" size="sm" onClick={handleDeleteEntry} disabled={saving} className="gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" /> Clear
                </Button>
              )}
              <div className="flex gap-2 ml-auto">
                <Button variant="outline" onClick={() => setEditCell(null)} disabled={saving}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={saving || !editSubject.trim() || selectedDays.length === 0}>
                  {saving ? "Saving…" : "Save"}
                </Button>
              </div>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}

      {isAdmin && (
        <Dialog open={manageOpen} onOpenChange={setManageOpen}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Manage Periods</DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
              {periods.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No periods yet. Add your first period below.</p>
              ) : (
                periods.map((p) => (
                  <div
                    key={p._id}
                    className={`flex items-center justify-between gap-3 px-3 py-2 rounded-lg border ${
                      p.isBreak ? "bg-muted/50 border-border" : "bg-card border-border"
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="text-xs text-muted-foreground w-5 shrink-0 font-mono text-center">{p.isBreak ? "—" : p.periodNumber}</div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{p.label}</p>
                        <p className="text-[11px] text-muted-foreground">
                          {formatTime(p.startTime)} – {formatTime(p.endTime)}
                          {p.isBreak && <span className="ml-2 text-amber-600 italic">break</span>}
                        </p>
                      </div>
                    </div>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-red-600 shrink-0" onClick={() => handleDeletePeriod(p._id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ))
              )}
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <div className="flex items-center gap-2">
                <Zap className="h-4 w-4 text-primary" />
                <p className="text-sm font-semibold text-foreground">Quick Generate</p>
              </div>
              <p className="text-xs text-muted-foreground">Auto-create all periods with correct timings in one click.</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>First Period Starts</Label>
                  <Input type="time" value={qStart} onChange={(e) => setQStart(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Number of Periods</Label>
                  <Input type="number" min={1} max={20} value={qCount} onChange={(e) => setQCount(+e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Period Duration (min)</Label>
                  <Input type="number" min={10} max={120} value={qDuration} onChange={(e) => setQDuration(+e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Break After Period</Label>
                  <Input type="number" min={0} max={qCount} value={qBreakAfter} onChange={(e) => setQBreakAfter(+e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label>Break Duration (min)</Label>
                  <Input type="number" min={0} max={60} value={qBreakMin} onChange={(e) => setQBreakMin(+e.target.value)} disabled={qBreakAfter === 0} />
                </div>
              </div>
              <Button className="w-full gap-2" onClick={handleQuickGenerate} disabled={generating || qCount < 1}>
                <Zap className="h-4 w-4" />
                {generating ? "Generating…" : "Generate Periods"}
              </Button>
            </div>

            <div className="border-t border-border pt-4 space-y-3">
              <p className="text-sm font-semibold text-foreground">Add Manually</p>
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2 space-y-1.5">
                  <Label htmlFor="p-label">Label</Label>
                  <Input id="p-label" value={newLabel} onChange={(e) => setNewLabel(e.target.value)} placeholder="e.g. Period 8, Lunch, Assembly" maxLength={40} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-start">Start Time</Label>
                  <Input id="p-start" type="time" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="p-end">End Time</Label>
                  <Input id="p-end" type="time" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <input id="p-isbreak" type="checkbox" checked={newIsBreak} onChange={(e) => setNewIsBreak(e.target.checked)} className="h-4 w-4" />
                <Label htmlFor="p-isbreak" className="cursor-pointer text-sm font-normal">
                  This is a break / lunch (not editable in timetable)
                </Label>
              </div>
              <Button className="w-full gap-2" onClick={handleAddPeriod} disabled={addingPeriod || !newLabel.trim() || !newStart || !newEnd}>
                <Plus className="h-4 w-4" />
                {addingPeriod ? "Adding…" : "Add Period"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
