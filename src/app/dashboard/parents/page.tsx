"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Mail, Phone, Pencil, Trash2, Power, Users, UserCheck, Contact, Search, X } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { statusPillClass } from "@/lib/statusStyles";
import { PageHeader } from "@/components/PageHeader";
import { StatFilterCard } from "@/components/StatFilterCard";
import { PageLoader } from "@/components/PageLoader";

interface ChildRef {
  _id: string;
  name: string;
  studentId: string;
  class: string;
  section?: string;
}

interface ParentRow {
  _id: string;
  name: string;
  email: string;
  phone?: string;
  alternatePhone?: string;
  address?: string;
  occupation?: string;
  motherName?: string;
  motherPhone?: string;
  motherOccupation?: string;
  relation: string;
  isActive: boolean;
  students: ChildRef[];
}

interface ParentsResponse {
  success: boolean;
  count: number;
  data: ParentRow[];
}

interface ApiMessageResponse {
  success: boolean;
  message?: string;
  code?: string;
}

const EMPTY_EDIT_FORM = {
  name: "", phone: "", alternatePhone: "", address: "", occupation: "",
  motherName: "", motherPhone: "", motherOccupation: "", relation: "father",
};

const RELATION_LABELS: Record<string, string> = { father: "Father", mother: "Mother", guardian: "Guardian" };
const RELATION_STYLES: Record<string, string> = {
  father: "bg-info/10 text-blue-700",
  mother: "bg-fuchsia-50 text-fuchsia-700",
  guardian: "bg-amber-50 text-amber-700",
};

export default function ParentsPage() {
  const { user } = useAuth();
  const [parents, setParents] = useState<ParentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const [statusFilter, setStatusFilter] = useState<"" | "active" | "inactive">("");
  const [search, setSearch] = useState("");

  const [editingParent, setEditingParent] = useState<ParentRow | null>(null);
  const [editForm, setEditForm] = useState(EMPTY_EDIT_FORM);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<ParentRow | null>(null);

  const load = () => {
    const token = getToken();
    if (!token) return;
    apiGet<ParentsResponse>("/parents", token)
      .then((res) => setParents(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load parents."));
  };

  useEffect(() => {
    load();
  }, []);

  const openEdit = (p: ParentRow) => {
    setEditingParent(p);
    setEditForm({
      name: p.name,
      phone: p.phone || "",
      alternatePhone: p.alternatePhone || "",
      address: p.address || "",
      occupation: p.occupation || "",
      motherName: p.motherName || "",
      motherPhone: p.motherPhone || "",
      motherOccupation: p.motherOccupation || "",
      relation: p.relation || "father",
    });
  };

  const handleEditSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!editingParent) return;
    const token = getToken();
    if (!token) return;
    setEditSubmitting(true);
    try {
      const res = await fetch(`/api/parents/${editingParent._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(editForm),
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to update parent.");
      toast.success("Parent updated");
      setEditingParent(null);
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setEditSubmitting(false);
    }
  };

  const toggleActive = async (p: ParentRow) => {
    const token = getToken();
    if (!token) return;
    setBusyId(p._id);
    try {
      const res = await fetch(`/api/parents/${p._id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isActive: !p.isActive }),
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to update parent.");
      toast.success(p.isActive ? "Parent deactivated" : "Parent activated");
      load();
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setBusyId(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    const p = pendingDelete;
    const token = getToken();
    if (!token) return;
    setBusyId(p._id);
    try {
      const res = await fetch(`/api/parents/${p._id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete parent.");
      toast.success("Parent deleted");
      setPendingDelete(null);
      load();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Something went wrong.";
      toast.error(message.includes("active child") ? "Has active children" : "Error", { description: message });
    } finally {
      setBusyId(null);
    }
  };

  if (!user) return null;

  const allParents = parents || [];
  const counts = {
    total: allParents.length,
    active: allParents.filter((p) => p.isActive).length,
    childrenLinked: allParents.reduce((sum, p) => sum + p.students.length, 0),
  };
  const filteredParents = allParents.filter((p) => {
    if (statusFilter === "active" && !p.isActive) return false;
    if (statusFilter === "inactive" && p.isActive) return false;
    if (search) {
      const q = search.toLowerCase();
      const matchesChild = p.students.some((c) => c.name.toLowerCase().includes(q));
      if (
        !p.name.toLowerCase().includes(q) &&
        !p.email.toLowerCase().includes(q) &&
        !(p.phone || "").includes(q) &&
        !matchesChild
      ) {
        return false;
      }
    }
    return true;
  });

  return (
    <div>
      <PageHeader
        icon={Users}
        title="Parents"
        subtitle="Parent accounts are created automatically during student admission — manage them here."
        accent="blue"
        className="mb-6"
      />

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {parents && parents.length > 0 && (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
            <StatFilterCard
              icon={Users}
              color="#4F46E5"
              colorDark="#4338CA"
              value={counts.total}
              label="Total Parents"
              active={statusFilter === ""}
              onClick={() => setStatusFilter("")}
            />
            <StatFilterCard
              icon={UserCheck}
              color="#16A34A"
              colorDark="#15803D"
              value={counts.active}
              label="Active"
              sublabel={counts.total > 0 ? `${Math.round((counts.active / counts.total) * 100)}% of parents` : undefined}
              active={statusFilter === "active"}
              onClick={() => setStatusFilter(statusFilter === "active" ? "" : "active")}
            />
            <StatFilterCard
              icon={Contact}
              color="#0EA5E9"
              colorDark="#0284C7"
              value={counts.childrenLinked}
              label="Children Linked"
              sublabel="Across all families"
            />
          </div>

          <div className="flex flex-col sm:flex-row gap-3 mb-4">
            <div className="relative sm:max-w-xs w-full">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Search by name, email, phone, child..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            {statusFilter !== "" && (
              <button
                type="button"
                onClick={() => setStatusFilter("")}
                className="inline-flex items-center gap-1.5 self-start sm:self-auto rounded-full bg-primary/10 text-primary px-3 py-1.5 text-xs font-semibold hover:bg-primary/15 transition-colors"
              >
                {statusFilter === "active" ? "Active only" : "Inactive only"}
                <X className="h-3 w-3" />
              </button>
            )}
          </div>
        </>
      )}

      {error ? null : !parents ? (
        <PageLoader label="Loading parents..." />
      ) : parents.length === 0 ? (
        <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <EmptyState icon={Users} message="No parents yet. They're created automatically when you admit a student." />
        </div>
      ) : filteredParents.length === 0 ? (
        <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <EmptyState icon={Users} message="No parents match your filters." />
        </div>
      ) : (
        <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
          <div className="hidden sm:flex items-center gap-4 px-5 py-3 border-b border-border">
            <p className="flex-1 max-w-xs text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Parent</p>
            <p className="w-24 shrink-0 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Relation</p>
            <p className="w-48 shrink-0 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Contact</p>
            <p className="flex-1 min-w-0 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider">Children</p>
            <p className="w-[136px] shrink-0 text-xs font-semibold text-muted-foreground/70 uppercase tracking-wider text-right ml-auto">Actions</p>
          </div>
          {filteredParents.map((p) => (
            <div key={p._id} className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 px-5 py-4 border-b border-border last:border-0 transition-colors hover:bg-muted/40">
              <div className="flex items-center gap-3 flex-1 sm:max-w-xs min-w-0">
                <Avatar className="h-11 w-11 shrink-0 border border-border">
                  <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                    {p.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">{p.name}</p>
                    {!p.isActive && <span className={`shrink-0 ${statusPillClass("destructive")}`}>Inactive</span>}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">{p.occupation || "No occupation on file"}</p>
                  <p className="text-xs text-muted-foreground mt-0.5 sm:hidden truncate">
                    {p.email}
                    {p.phone ? ` · ${p.phone}` : ""}
                  </p>
                </div>
              </div>

              <div className="hidden sm:block w-24 shrink-0">
                <span className={`inline-block text-[11px] font-semibold px-2.5 py-1 rounded-full ${RELATION_STYLES[p.relation] || RELATION_STYLES.guardian}`}>
                  {RELATION_LABELS[p.relation] || "Guardian"}
                </span>
              </div>

              <div className="hidden sm:block w-48 shrink-0 space-y-0.5">
                <p className="text-sm text-foreground/90 truncate flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5 text-muted-foreground shrink-0" /> {p.email}
                </p>
                <p className="text-xs text-muted-foreground truncate flex items-center gap-1.5">
                  <Phone className="h-3.5 w-3.5 shrink-0" /> {p.phone || "—"}
                </p>
              </div>

              <div className="flex-1 min-w-0">
                {p.students.length === 0 ? (
                  <span className="text-xs text-muted-foreground">No children linked</span>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {p.students.map((c) => (
                      <span key={c._id} className="inline-block text-[11px] font-medium px-2 py-1 rounded-full bg-muted text-foreground/90">
                        {c.name} ({c.class}{c.section ? `-${c.section}` : ""})
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex items-center justify-end gap-1 w-[136px] shrink-0 ml-auto">
                <Button variant="ghost" size="icon-sm" onClick={() => openEdit(p)} aria-label="Edit">
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => toggleActive(p)}
                  disabled={busyId === p._id}
                  aria-label={p.isActive ? "Deactivate" : "Activate"}
                >
                  <Power className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => setPendingDelete(p)}
                  disabled={busyId === p._id}
                  aria-label="Delete"
                  className="hover:text-red-600"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!pendingDelete}
        onOpenChange={(o) => !o && setPendingDelete(null)}
        title={`Delete ${pendingDelete?.name ?? "Parent"}?`}
        description="This cannot be undone."
        confirmLabel="Delete"
        loading={busyId === pendingDelete?._id}
        onConfirm={confirmDelete}
      />

      <Dialog open={!!editingParent} onOpenChange={(o) => { if (!o) setEditingParent(null); }}>
        <DialogContent className="sm:max-w-lg rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg text-foreground">Edit Parent</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-4 mt-2">
            <div>
              <label className="text-xs font-semibold text-foreground mb-1.5 block">Relation to Student</label>
              <div className="flex gap-2">
                {(["father", "mother", "guardian"] as const).map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setEditForm((f) => ({ ...f, relation: r }))}
                    className={`flex-1 px-3 py-2 rounded-lg border-2 text-xs font-semibold transition-all ${
                      editForm.relation === r
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border bg-card text-muted-foreground hover:border-primary/30"
                    }`}
                  >
                    {RELATION_LABELS[r]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Name">
                <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
              </Field>
              <Field label="Occupation">
                <Input value={editForm.occupation} onChange={(e) => setEditForm((f) => ({ ...f, occupation: e.target.value }))} />
              </Field>
              <Field label="Phone">
                <Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value.replace(/\D/g, "").slice(0, 10) }))} inputMode="numeric" maxLength={10} />
              </Field>
              <Field label="Alternate Phone">
                <Input value={editForm.alternatePhone} onChange={(e) => setEditForm((f) => ({ ...f, alternatePhone: e.target.value.replace(/\D/g, "").slice(0, 10) }))} inputMode="numeric" maxLength={10} />
              </Field>
            </div>

            <Field label="Address">
              <Textarea value={editForm.address} onChange={(e) => setEditForm((f) => ({ ...f, address: e.target.value }))} rows={2} />
            </Field>

            <div className="pt-3 border-t border-border">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3">Other Parent / Guardian</p>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Name">
                  <Input value={editForm.motherName} onChange={(e) => setEditForm((f) => ({ ...f, motherName: e.target.value }))} />
                </Field>
                <Field label="Occupation">
                  <Input value={editForm.motherOccupation} onChange={(e) => setEditForm((f) => ({ ...f, motherOccupation: e.target.value }))} />
                </Field>
                <Field label="Phone" className="col-span-2">
                  <Input value={editForm.motherPhone} onChange={(e) => setEditForm((f) => ({ ...f, motherPhone: e.target.value.replace(/\D/g, "").slice(0, 10) }))} inputMode="numeric" maxLength={10} />
                </Field>
              </div>
            </div>

            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={editSubmitting}>
              {editSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`space-y-1 ${className || ""}`}>
      <label className="text-xs font-semibold text-foreground">{label}</label>
      {children}
    </div>
  );
}
