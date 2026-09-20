"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Plus, Loader2, Pin, AlertTriangle, Pencil, Trash2, Megaphone, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PageHeader } from "@/components/PageHeader";
import { StatFilterCard } from "@/components/StatFilterCard";

type Category = "general" | "exam" | "fee" | "holiday" | "event" | "urgent" | "other";
type TargetRole = "all" | "teacher" | "student" | "parent";

interface NoticeRow {
  _id: string;
  title: string;
  content: string;
  category: Category;
  targetRoles: TargetRole[];
  isUrgent: boolean;
  isPinned: boolean;
  createdAt: string;
  postedBy?: { name: string } | null;
}

interface NoticesResponse {
  success: boolean;
  data: NoticeRow[];
}

interface ApiMessageResponse {
  success: boolean;
  message?: string;
}

const CATEGORY_STYLES: Record<Category, string> = {
  general: "bg-slate-100 text-slate-700",
  exam: "bg-purple-100 text-purple-700",
  fee: "bg-amber-100 text-amber-700",
  holiday: "bg-sky-100 text-sky-700",
  event: "bg-pink-100 text-pink-700",
  urgent: "bg-red-100 text-red-700",
  other: "bg-slate-100 text-slate-700",
};

const CATEGORY_PALETTE: Record<Category, { color: string; colorDark: string }> = {
  general: { color: "#64748B", colorDark: "#475569" },
  exam: { color: "#8B5CF6", colorDark: "#7C3AED" },
  fee: { color: "#F59E0B", colorDark: "#D97706" },
  holiday: { color: "#0EA5E9", colorDark: "#0284C7" },
  event: { color: "#EC4899", colorDark: "#DB2777" },
  urgent: { color: "#DC2626", colorDark: "#B91C1C" },
  other: { color: "#64748B", colorDark: "#475569" },
};

const ROLE_OPTIONS: { value: TargetRole; label: string }[] = [
  { value: "all", label: "Everyone" },
  { value: "teacher", label: "Teachers" },
  { value: "student", label: "Students" },
  { value: "parent", label: "Parents" },
];

const EMPTY_FORM = {
  title: "",
  content: "",
  category: "general" as Category,
  targetRoles: ["all"] as TargetRole[],
  isUrgent: false,
  isPinned: false,
};

export default function NoticesPage() {
  const { user } = useAuth();
  const [notices, setNotices] = useState<NoticeRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<NoticeRow | null>(null);
  const [filter, setFilter] = useState<"" | "pinned" | "urgent">("");

  const permissions = user?.permissions as { canPostNotice?: boolean } | undefined;
  const canPost = user?.role === "schooladmin" || permissions?.canPostNotice === true;

  const load = () => {
    const token = getToken();
    if (!token) return;
    apiGet<NoticesResponse>("/notices", token)
      .then((res) => setNotices(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load notices."));
  };

  useEffect(() => {
    load();
  }, []);

  const openAdd = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setOpen(true);
  };

  const openEdit = (n: NoticeRow) => {
    setEditingId(n._id);
    setForm({
      title: n.title, content: n.content, category: n.category,
      targetRoles: n.targetRoles.length ? n.targetRoles : ["all"],
      isUrgent: n.isUrgent, isPinned: n.isPinned,
    });
    setOpen(true);
  };

  const toggleRole = (role: TargetRole) => {
    setForm((f) => {
      if (role === "all") return { ...f, targetRoles: ["all"] };
      const withoutAll = f.targetRoles.filter((r) => r !== "all");
      const next = withoutAll.includes(role) ? withoutAll.filter((r) => r !== role) : [...withoutAll, role];
      return { ...f, targetRoles: next.length ? next : ["all"] };
    });
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const token = getToken();
    if (!token) return;
    setSubmitting(true);
    try {
      const res = await fetch(editingId ? `/api/notices/${editingId}` : "/api/notices", {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(form),
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save notice.");
      toast.success(editingId ? "Notice updated" : "Notice posted");
      setOpen(false);
      setForm(EMPTY_FORM);
      setEditingId(null);
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSubmitting(false);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const token = getToken();
    if (!token) return;
    setBusyId(pendingDelete._id);
    try {
      const res = await fetch(`/api/notices/${pendingDelete._id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete notice.");
      toast.success("Notice deleted");
      setPendingDelete(null);
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusyId(null);
    }
  };

  if (!user) return null;

  const allNotices = notices || [];
  const pinnedCount = allNotices.filter((n) => n.isPinned).length;
  const urgentCount = allNotices.filter((n) => n.isUrgent).length;
  const filteredNotices = allNotices.filter((n) => {
    if (filter === "pinned") return n.isPinned;
    if (filter === "urgent") return n.isUrgent;
    return true;
  });

  return (
    <div>
      <PageHeader
        icon={Megaphone}
        title="Notice Board"
        subtitle="School-wide announcements."
        accent="amber"
        actions={
          canPost && (
            <Button onClick={openAdd} className="gap-1.5">
              <Plus className="h-4 w-4" /> New Notice
            </Button>
          )
        }
        className="mb-6"
      />

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {notices && notices.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <StatFilterCard
              icon={Megaphone}
              color="#4F46E5"
              colorDark="#4338CA"
              value={allNotices.length}
              label="Total Notices"
              active={filter === ""}
              onClick={() => setFilter("")}
            />
            <StatFilterCard
              icon={Pin}
              color="#8B5CF6"
              colorDark="#7C3AED"
              value={pinnedCount}
              label="Pinned"
              active={filter === "pinned"}
              onClick={() => setFilter(filter === "pinned" ? "" : "pinned")}
            />
            <StatFilterCard
              icon={AlertTriangle}
              color="#DC2626"
              colorDark="#B91C1C"
              value={urgentCount}
              label="Urgent"
              active={filter === "urgent"}
              onClick={() => setFilter(filter === "urgent" ? "" : "urgent")}
            />
          </div>

          {filter !== "" && (
            <button
              type="button"
              onClick={() => setFilter("")}
              className="inline-flex items-center gap-1.5 mb-4 rounded-full bg-primary/10 text-primary px-3 py-1.5 text-xs font-semibold hover:bg-primary/15 transition-colors"
            >
              {filter === "pinned" ? "Pinned only" : "Urgent only"}
              <X className="h-3 w-3" />
            </button>
          )}
        </>
      )}

      {error ? null : !notices ? (
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-[18px]" />
          ))}
        </div>
      ) : notices.length === 0 ? (
        <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <EmptyState icon={Megaphone} message="No notices yet." />
        </div>
      ) : filteredNotices.length === 0 ? (
        <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <EmptyState icon={Megaphone} message="No notices match this filter." />
        </div>
      ) : (
        <div className="space-y-3">
          {filteredNotices.map((n) => {
            const palette = CATEGORY_PALETTE[n.category];
            return (
              <div key={n._id} className="group relative overflow-hidden rounded-[18px] bg-card p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.07)] transition-shadow hover:shadow-[0_0_0_1px_rgba(15,23,42,0.07),0_8px_20px_-12px_rgba(15,23,42,0.15)]">
                <Megaphone
                  className="pointer-events-none absolute -bottom-4 -right-4 h-20 w-20 rotate-[-12deg]"
                  style={{ color: palette.color, opacity: 0.06 }}
                />
                <div className="relative flex items-start gap-3">
                  <div
                    className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl text-white"
                    style={{ background: `linear-gradient(135deg, ${palette.color}, ${palette.colorDark})`, boxShadow: `0 6px 14px -4px ${palette.color}80` }}
                  >
                    <Megaphone className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        {n.isPinned && <Pin className="h-3.5 w-3.5 text-primary shrink-0" />}
                        {n.isUrgent && <AlertTriangle className="h-3.5 w-3.5 text-red-600 shrink-0" />}
                        <p className="text-sm font-semibold text-foreground">{n.title}</p>
                        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${CATEGORY_STYLES[n.category]}`}>
                          {n.category}
                        </span>
                      </div>
                      {canPost && (
                        <div className="flex items-center gap-1 shrink-0">
                          <Button variant="ghost" size="icon-sm" onClick={() => openEdit(n)} aria-label="Edit">
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            onClick={() => setPendingDelete(n)}
                            disabled={busyId === n._id}
                            aria-label="Delete"
                            className="hover:text-red-600"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>
                    <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{n.content}</p>
                    <p className="text-xs text-muted-foreground/70 mt-3">
                      {n.postedBy?.name ? `${n.postedBy.name} · ` : ""}
                      {new Date(n.createdAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} at{" "}
                      {new Date(n.createdAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setEditingId(null); }}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg text-foreground">{editingId ? "Edit Notice" : "New Notice"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3 mt-2">
            <Field label="Title" required>
              <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} required />
            </Field>
            <Field label="Content" required>
              <Textarea
                value={form.content}
                onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                required
                rows={4}
              />
            </Field>
            <Field label="Category">
              <Select value={form.category} onValueChange={(v) => setForm((f) => ({ ...f, category: (v || f.category) as Category }))}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["general", "exam", "fee", "holiday", "event", "urgent", "other"] as Category[]).map((c) => (
                    <SelectItem key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Visible to">
              <div className="flex flex-wrap gap-2">
                {ROLE_OPTIONS.map((r) => {
                  const active = form.targetRoles.includes(r.value);
                  return (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => toggleRole(r.value)}
                      className={`text-xs font-medium px-2.5 py-1 rounded-full border transition-colors ${
                        active
                          ? "bg-primary text-white border-primary"
                          : "bg-transparent text-muted-foreground border-border hover:border-primary"
                      }`}
                    >
                      {r.label}
                    </button>
                  );
                })}
              </div>
            </Field>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={form.isUrgent}
                  onChange={(e) => setForm((f) => ({ ...f, isUrgent: e.target.checked }))}
                />
                Urgent
              </label>
              <label className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                <input
                  type="checkbox"
                  checked={form.isPinned}
                  onChange={(e) => setForm((f) => ({ ...f, isPinned: e.target.checked }))}
                />
                Pin to top
              </label>
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={submitting}>
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : editingId ? "Save Changes" : "Post Notice"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => { if (!o) setPendingDelete(null); }}
        title="Delete Notice?"
        description={`Delete "${pendingDelete?.title ?? ""}"? This cannot be undone.`}
        confirmLabel="Delete"
        loading={busyId === pendingDelete?._id}
        onConfirm={confirmDelete}
      />
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-foreground">
        {label}
        {required && <span className="text-red-500"> *</span>}
      </label>
      {children}
    </div>
  );
}
