"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Power, Users, UserCheck, UserX, Search, TrendingUp, ArrowUpRight, X, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import { statusPillClass } from "@/lib/statusStyles";

interface StudentRow {
  _id: string;
  name: string;
  studentId: string;
  class: string;
  section?: string;
  rollNumber?: string;
  admissionNo?: string;
  phone?: string;
  photo?: string;
  isActive: boolean;
  attendance: number;
  parent?: { name: string; email: string; phone?: string } | null;
}

interface StudentsResponse {
  success: boolean;
  count: number;
  data: StudentRow[];
}

interface ClassOption {
  _id: string;
  name: string;
  section: string;
}

interface ClassesResponse {
  success: boolean;
  data: ClassOption[];
}

interface ApiMessageResponse {
  success: boolean;
  message?: string;
}

export default function StudentsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [students, setStudents] = useState<StudentRow[] | null>(null);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [classFilter, setClassFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [pendingDelete, setPendingDelete] = useState<StudentRow | null>(null);

  // Teachers get a read-only view scoped to their own classes — matches
  // SMS-BACKEND, where the student create/update/delete routes are
  // schooladmin-only at the router level (no teacher-facing path exists at
  // all, regardless of their canEditStudent/canDeleteStudent flags).
  const isTeacher = user?.role === "teacher";

  const load = () => {
    const token = getToken();
    if (!token) return;
    apiGet<StudentsResponse>(isTeacher ? "/teachers/my-students" : "/students", token)
      .then((res) => setStudents(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load students."));
    apiGet<ClassesResponse>("/classes", token)
      .then((res) => setClasses(res.data))
      .catch(() => {});
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isTeacher]);

  const toggleActive = async (s: StudentRow) => {
    const token = getToken();
    if (!token) return;
    setBusyId(s._id);
    try {
      const res = await fetch(`/api/students/${s._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive: !s.isActive }),
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to update student.");
      toast.success(s.isActive ? "Student deactivated" : "Student activated");
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const s = pendingDelete;
    const token = getToken();
    if (!token) return;
    setBusyId(s._id);
    try {
      const res = await fetch(`/api/students/${s._id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete student.");
      toast.success("Student deleted");
      setPendingDelete(null);
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusyId(null);
    }
  };

  if (!user) return null;

  const allStudents = students || [];
  const counts = {
    total: allStudents.length,
    active: allStudents.filter((s) => s.isActive).length,
    inactive: allStudents.filter((s) => !s.isActive).length,
  };
  const withAttendance = allStudents.filter((s) => s.attendance > 0);
  const avgAttendance = withAttendance.length
    ? Math.round(withAttendance.reduce((sum, s) => sum + s.attendance, 0) / withAttendance.length)
    : null;

  const filteredStudents = (students || []).filter((s) => {
    if (classFilter && s.class !== classFilter) return false;
    if (statusFilter === "active" && !s.isActive) return false;
    if (statusFilter === "inactive" && s.isActive) return false;
    if (search) {
      const q = search.toLowerCase();
      if (
        !s.name.toLowerCase().includes(q) &&
        !s.studentId.toLowerCase().includes(q) &&
        !(s.rollNumber || "").toLowerCase().includes(q)
      ) {
        return false;
      }
    }
    return true;
  });

  const attendanceTone = (pct: number): "success" | "warning" | "destructive" =>
    pct >= 90 ? "success" : pct >= 75 ? "warning" : "destructive";
  const ATTENDANCE_BAR: Record<"success" | "warning" | "destructive", string> = {
    success: "bg-success",
    warning: "bg-warning",
    destructive: "bg-destructive",
  };
  const ATTENDANCE_TEXT: Record<"success" | "warning" | "destructive", string> = {
    success: "text-success",
    warning: "text-warning",
    destructive: "text-destructive",
  };

  return (
    <div>
      <PageHeader
        icon={Users}
        title="Students"
        subtitle={isTeacher ? "Students in your classes." : "Manage student admissions and records."}
        accent="blue"
        actions={
          !isTeacher && (
            <Button onClick={() => router.push("/dashboard/students/new")} className="gap-1.5">
              <Plus className="h-4 w-4" /> Add Student
            </Button>
          )
        }
        className="mb-6"
      />

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {students && students.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <StatFilterCard
              icon={Users}
              color="#4F46E5"
              colorDark="#4338CA"
              value={counts.total}
              label="Total Students"
              sublabel={classes.length > 0 ? `Across ${classes.length} class${classes.length === 1 ? "" : "es"}` : undefined}
              active={statusFilter === "all"}
              onClick={() => setStatusFilter("all")}
            />
            <StatFilterCard
              icon={UserCheck}
              color="#16A34A"
              colorDark="#15803D"
              value={counts.active}
              label="Active"
              sublabel={counts.total > 0 ? `${Math.round((counts.active / counts.total) * 100)}% of total` : undefined}
              active={statusFilter === "active"}
              onClick={() => setStatusFilter(statusFilter === "active" ? "all" : "active")}
            />
            <StatFilterCard
              icon={UserX}
              color="#DC2626"
              colorDark="#B91C1C"
              value={counts.inactive}
              label="Inactive"
              sublabel={counts.inactive === 0 ? "All accounts active" : "Needs review"}
              active={statusFilter === "inactive"}
              onClick={() => setStatusFilter(statusFilter === "inactive" ? "all" : "inactive")}
            />
            <StatFilterCard
              icon={TrendingUp}
              color="#0EA5E9"
              colorDark="#0284C7"
              value={avgAttendance != null ? `${avgAttendance}%` : "—"}
              label="Avg. Attendance"
              sublabel={`Across ${withAttendance.length} marked student${withAttendance.length === 1 ? "" : "s"}`}
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative sm:max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by name or roll number..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Select value={classFilter} onValueChange={(v) => setClassFilter(v || "")}>
              <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder="All Classes" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Classes</SelectItem>
                {classes.map((c) => (
                  <SelectItem key={c._id} value={c.name}>Class {c.name}-{c.section}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {statusFilter !== "all" && (
              <button
                type="button"
                onClick={() => setStatusFilter("all")}
                className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full bg-primary/10 text-primary px-3 py-1.5 text-xs font-semibold hover:bg-primary/15 transition-colors"
              >
                {statusFilter === "active" ? "Active only" : "Inactive only"}
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </>
      )}

      {error ? null : !students ? (
        <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
          <div className="hidden sm:flex items-center gap-4 px-5 py-3 border-b border-border">
            <p className="flex-1 max-w-sm text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Student</p>
            <p className="w-28 shrink-0 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Class</p>
            <p className="w-16 shrink-0 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Roll No.</p>
            <p className="w-32 shrink-0 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Attendance</p>
            <p className="w-[104px] shrink-0 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider text-right ml-auto">Actions</p>
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-0">
              <div className="flex items-center gap-3 flex-1 max-w-sm min-w-0">
                <Skeleton className="h-11 w-11 rounded-full shrink-0" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
              <div className="hidden sm:block w-28 shrink-0"><Skeleton className="h-4 w-16" /></div>
              <div className="hidden sm:block w-16 shrink-0"><Skeleton className="h-4 w-8" /></div>
              <div className="hidden sm:block w-32 shrink-0"><Skeleton className="h-4 w-20" /></div>
              <div className="w-[104px] shrink-0" />
            </div>
          ))}
        </div>
      ) : students.length === 0 ? (
        <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <EmptyState
            icon={Users}
            message={isTeacher ? "No students in your classes yet." : "No students yet. Add your first admission to get started."}
          />
        </div>
      ) : filteredStudents.length === 0 ? (
        <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <EmptyState icon={Users} message="No students match your filters." />
        </div>
      ) : (
        <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
          <div className="hidden sm:flex items-center gap-4 px-5 py-3 border-b border-border">
            <p className="flex-1 max-w-sm text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Student</p>
            <p className="w-28 shrink-0 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Class</p>
            <p className="w-16 shrink-0 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Roll No.</p>
            <p className="w-32 shrink-0 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Attendance</p>
            <p className="w-[104px] shrink-0 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider text-right ml-auto">Actions</p>
          </div>
          {filteredStudents.map((s) => (
            <div key={s._id} className="flex items-center gap-4 px-5 py-4 border-b border-border last:border-0 transition-colors hover:bg-muted/40">
              <div className="flex items-center gap-3 flex-1 max-w-sm min-w-0">
                <Avatar className={`h-11 w-11 shrink-0 border-2 ${s.isActive ? "border-success/30" : "border-destructive/30"}`}>
                  <AvatarImage src={s.photo} alt={s.name} />
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {s.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                    {!s.isActive && (
                      <span className={`shrink-0 ${statusPillClass("destructive")}`}>Inactive</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{s.studentId}</p>
                  {s.parent?.email && <p className="text-xs text-muted-foreground/70 truncate">{s.parent.email}</p>}
                  <p className="text-xs text-muted-foreground mt-0.5 sm:hidden">
                    Class {s.class}
                    {s.section ? `-${s.section}` : ""} · Roll {s.rollNumber || "—"}
                  </p>
                </div>
              </div>

              <div className="hidden sm:block w-28 shrink-0">
                <p className="text-sm text-foreground/90 truncate">
                  Class {s.class}
                  {s.section ? `-${s.section}` : ""}
                </p>
              </div>
              <div className="hidden sm:block w-16 shrink-0">
                <p className="text-sm text-foreground/90">{s.rollNumber || "—"}</p>
              </div>
              <div className="hidden sm:flex items-center gap-2 w-32 shrink-0">
                {s.attendance > 0 ? (
                  <>
                    <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden shrink-0">
                      <div className={`h-full rounded-full ${ATTENDANCE_BAR[attendanceTone(s.attendance)]}`} style={{ width: `${s.attendance}%` }} />
                    </div>
                    <span className={`text-xs font-medium ${ATTENDANCE_TEXT[attendanceTone(s.attendance)]}`}>{s.attendance}%</span>
                  </>
                ) : (
                  <span className="text-xs text-muted-foreground/70">—</span>
                )}
              </div>

              <div className="flex items-center justify-end gap-1 w-[104px] shrink-0 ml-auto">
                {!isTeacher && (
                  <>
                    <Button variant="ghost" size="icon-sm" onClick={() => router.push(`/dashboard/students/${s._id}/edit`)} aria-label="Edit">
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => toggleActive(s)}
                      disabled={busyId === s._id}
                      aria-label={s.isActive ? "Deactivate" : "Activate"}
                    >
                      <Power className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setPendingDelete(s)}
                      disabled={busyId === s._id}
                      aria-label="Delete"
                      className="hover:text-red-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.name ?? "Student"}?`}
        description="This cannot be undone."
        confirmLabel="Delete"
        loading={busyId === pendingDelete?._id}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function StatFilterCard({
  icon: Icon,
  color,
  colorDark,
  value,
  label,
  sublabel,
  active = false,
  onClick,
}: {
  icon: LucideIcon;
  color: string;
  colorDark: string;
  value: number | string;
  label: string;
  sublabel?: string;
  active?: boolean;
  onClick?: () => void;
}) {
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={`group relative text-left overflow-hidden rounded-[18px] bg-card p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.07),0_1px_2px_rgba(15,23,42,0.04),0_12px_24px_-16px_rgba(15,23,42,0.12)] transition-all duration-300 ${onClick ? "hover:-translate-y-1 cursor-pointer" : ""}`}
      style={{
        background: active
          ? `linear-gradient(160deg, ${color}14, ${color}05 55%, transparent)`
          : undefined,
        boxShadow: active ? `0 0 0 1.5px ${color}, 0 12px 24px -14px ${color}66` : undefined,
      }}
    >
      <Icon
        className="pointer-events-none absolute -bottom-4 -right-4 h-24 w-24 rotate-[-12deg] transition-transform duration-500 group-hover:rotate-0 group-hover:scale-110"
        style={{ color, opacity: 0.07 }}
      />
      <div className="relative flex items-center justify-between">
        <div
          className="flex h-11 w-11 items-center justify-center rounded-2xl transition-transform duration-300 group-hover:scale-110"
          style={{ background: `linear-gradient(135deg, ${color}, ${colorDark})`, boxShadow: `0 8px 18px -6px ${color}80, inset 0 1px 0 rgba(255,255,255,0.25)` }}
        >
          <Icon className="h-5 w-5 text-white" />
        </div>
        {onClick && (
          <ArrowUpRight
            className={active ? "h-4 w-4 transition-colors" : "h-4 w-4 text-muted-foreground/50 transition-colors group-hover:text-foreground"}
            style={active ? { color } : undefined}
          />
        )}
      </div>
      <p className="relative mt-4 text-[28px] font-bold leading-none text-foreground">{value}</p>
      <p className="relative mt-1.5 text-sm font-medium text-muted-foreground">{label}</p>
      {sublabel && <p className="relative mt-2 text-xs text-muted-foreground">{sublabel}</p>}
      <div
        className="absolute inset-x-0 bottom-0 h-[3px] scale-x-0 transition-transform duration-300 group-hover:scale-x-100"
        style={{ background: `linear-gradient(90deg, ${color}, ${colorDark})`, transformOrigin: "left" }}
      />
    </Wrapper>
  );
}
