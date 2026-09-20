"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Mail, Phone, Pencil, Trash2, Power, Users } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/EmptyState";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { statusPillClass } from "@/lib/statusStyles";
import { PageHeader } from "@/components/PageHeader";
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
  motherName?: string;
  motherPhone?: string;
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

const EMPTY_EDIT_FORM = { name: "", phone: "", motherName: "", motherPhone: "" };

export default function ParentsPage() {
  const { user } = useAuth();
  const [parents, setParents] = useState<ParentRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
    setEditForm({ name: p.name, phone: p.phone || "", motherName: p.motherName || "", motherPhone: p.motherPhone || "" });
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

      {error ? null : !parents ? (
        <PageLoader label="Loading parents..." />
      ) : parents.length === 0 ? (
        <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <EmptyState icon={Users} message="No parents yet. They're created automatically when you admit a student." />
        </div>
      ) : (
        <div className="rounded-[18px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
          {parents.map((p) => (
            <div key={p._id} className="flex items-center justify-between px-5 py-4 border-b border-border last:border-0 gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-foreground">{p.name}</p>
                  {!p.isActive && (
                    <span className={statusPillClass("destructive")}>Inactive</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {p.students.length === 0
                    ? "No children linked"
                    : p.students.map((c) => `${c.name} (${c.class}${c.section ? "-" + c.section : ""})`).join(", ")}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                <span className="hidden sm:flex items-center gap-1">
                  <Mail className="h-3.5 w-3.5" /> {p.email}
                </span>
                {p.phone && (
                  <span className="hidden md:flex items-center gap-1">
                    <Phone className="h-3.5 w-3.5" /> {p.phone}
                  </span>
                )}
                <div className="flex items-center gap-1">
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
        <DialogContent className="sm:max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg text-foreground">Edit Parent</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleEditSubmit} className="space-y-3 mt-2">
            <Field label="Father's Name">
              <Input value={editForm.name} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
            </Field>
            <Field label="Phone">
              <Input value={editForm.phone} onChange={(e) => setEditForm((f) => ({ ...f, phone: e.target.value }))} maxLength={10} />
            </Field>
            <Field label="Mother's Name">
              <Input value={editForm.motherName} onChange={(e) => setEditForm((f) => ({ ...f, motherName: e.target.value }))} />
            </Field>
            <Field label="Mother's Phone">
              <Input value={editForm.motherPhone} onChange={(e) => setEditForm((f) => ({ ...f, motherPhone: e.target.value }))} maxLength={10} />
            </Field>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90" disabled={editSubmitting}>
              {editSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Changes"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-foreground">{label}</label>
      {children}
    </div>
  );
}
