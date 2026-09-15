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

  const handleDelete = async (p: ParentRow) => {
    if (!confirm(`Delete ${p.name}? This cannot be undone.`)) return;
    const token = getToken();
    if (!token) return;
    setBusyId(p._id);
    try {
      const res = await fetch(`/api/parents/${p._id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete parent.");
      toast.success("Parent deleted");
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
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#172554]">Parents</h1>
        <p className="text-sm text-[#64748B] mt-1">
          Parent accounts are created automatically during student admission — manage them here.
        </p>
      </div>

      {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

      {error ? null : !parents ? (
        <div className="flex items-center gap-2 text-sm text-[#64748B]">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading...
        </div>
      ) : parents.length === 0 ? (
        <div className="rounded-[18px] bg-white p-8 text-center shadow-[0_0_0_1px_rgba(15,23,42,0.07)]">
          <p className="text-sm text-[#64748B]">
            No parents yet. They&apos;re created automatically when you admit a student.
          </p>
        </div>
      ) : (
        <div className="rounded-[18px] bg-white shadow-[0_0_0_1px_rgba(15,23,42,0.07)] overflow-hidden">
          {parents.map((p) => (
            <div key={p._id} className="flex items-center justify-between px-5 py-4 border-b border-[#F1F5F9] last:border-0 gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold text-[#172554]">{p.name}</p>
                  {!p.isActive && (
                    <span className="text-[10px] font-semibold text-red-600 bg-red-50 px-2 py-0.5 rounded-full">
                      Inactive
                    </span>
                  )}
                </div>
                <p className="text-xs text-[#64748B] mt-0.5 flex items-center gap-1">
                  <Users className="h-3.5 w-3.5" />
                  {p.students.length === 0
                    ? "No children linked"
                    : p.students.map((c) => `${c.name} (${c.class}${c.section ? "-" + c.section : ""})`).join(", ")}
                </p>
              </div>
              <div className="flex items-center gap-4 text-xs text-[#64748B] shrink-0">
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
                    onClick={() => handleDelete(p)}
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

      <Dialog open={!!editingParent} onOpenChange={(o) => { if (!o) setEditingParent(null); }}>
        <DialogContent className="sm:max-w-md rounded-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg text-[#172554]">Edit Parent</DialogTitle>
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
            <Button type="submit" className="w-full bg-[#4F46E5] hover:bg-[#4338CA]" disabled={editSubmitting}>
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
      <label className="text-xs font-semibold text-[#172554]">{label}</label>
      {children}
    </div>
  );
}
