"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, Plus, Loader2, Save, Trash2, Users } from "lucide-react";
import { toast } from "sonner";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ConfirmDialog } from "@/components/ConfirmDialog";
import { PageLoader } from "@/components/PageLoader";
import { EmptyState, EmptyStateCompact } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { ROLE_SECTIONS, buildEmptySections, type SectionAction } from "@/lib/roles";
import type { ISectionPermission } from "@/models/Role";

const ACTION_LABELS: Record<SectionAction, string> = { open: "Open", view: "View", create: "Create", edit: "Edit", delete: "Delete" };

interface RoleItem {
  _id: string;
  name: string;
  description: string;
  sections: Record<string, ISectionPermission>;
  staffCount: number;
}

interface ListResponse {
  success: boolean;
  data: RoleItem[];
}

const NEW_ROLE = "__new__";

export default function RolesPermissionsPage() {
  const [roles, setRoles] = useState<RoleItem[] | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [sections, setSections] = useState<Record<string, ISectionPermission>>(buildEmptySections());
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const load = useCallback(() => {
    const token = getToken();
    if (!token) return;
    apiGet<ListResponse>("/roles", token)
      .then((res) => setRoles(res.data))
      .catch(() => toast.error("Failed to load roles."));
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const selected = roles?.find((r) => r._id === selectedId) || null;

  const selectRole = (r: RoleItem) => {
    setSelectedId(r._id);
    setName(r.name);
    setDescription(r.description);
    setSections({ ...buildEmptySections(), ...r.sections });
  };

  const startNew = () => {
    setSelectedId(NEW_ROLE);
    setName("");
    setDescription("");
    setSections(buildEmptySections());
  };

  const toggleAction = (sectionKey: string, action: SectionAction) => {
    setSections((prev) => {
      const current = prev[sectionKey];
      const next = { ...current, [action]: !current[action] };
      // Can't hold a deeper action without "open" -- and turning "open"
      // off takes every deeper action (and extra) with it.
      if (action !== "open" && next[action]) next.open = true;
      if (action === "open" && !next.open) {
        next.view = false;
        next.create = false;
        next.edit = false;
        next.delete = false;
        next.extras = Object.fromEntries(Object.keys(next.extras).map((k) => [k, false]));
      }
      return { ...prev, [sectionKey]: next };
    });
  };

  const toggleExtra = (sectionKey: string, extraKey: string) => {
    setSections((prev) => {
      const current = prev[sectionKey];
      return { ...prev, [sectionKey]: { ...current, extras: { ...current.extras, [extraKey]: !current.extras[extraKey] } } };
    });
  };

  const save = async () => {
    const token = getToken();
    if (!token || !name.trim()) {
      if (!name.trim()) toast.error("Role name is required.");
      return;
    }
    setSaving(true);
    try {
      const isNew = selectedId === NEW_ROLE;
      const res = await fetch(isNew ? "/api/roles" : `/api/roles/${selectedId}`, {
        method: isNew ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ name: name.trim(), description, sections }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save.");
      toast.success(isNew ? "Role created." : "Role updated.");
      setSelectedId(json.data._id);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save role.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!selected) return;
    const token = getToken();
    if (!token) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/roles/${selected._id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to delete.");
      toast.success("Role deleted.");
      setSelectedId(null);
      load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete role.");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader icon={Shield} title="Roles & Permissions" subtitle="Create roles for non-teaching staff and control what each one can access" accent="slate" />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Role list */}
        <div className="rounded-2xl border border-border bg-card">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-foreground">Roles</h2>
            <Button size="sm" variant="outline" className="gap-1.5" onClick={startNew}>
              <Plus className="h-3.5 w-3.5" /> New Role
            </Button>
          </div>
          {!roles ? (
            <PageLoader compact label="Loading roles..." />
          ) : roles.length === 0 ? (
            <EmptyStateCompact message="No roles yet. Create one to get started." />
          ) : (
            <div className="divide-y divide-border">
              {roles.map((r) => (
                <button
                  key={r._id}
                  onClick={() => selectRole(r)}
                  className={`w-full flex items-center gap-3 px-4 py-3 hover:bg-muted/50 transition-colors text-left ${
                    selectedId === r._id ? "bg-muted border-l-[3px] border-l-primary" : ""
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{r.name}</p>
                    {r.description && <p className="text-xs text-muted-foreground truncate">{r.description}</p>}
                  </div>
                  <Badge variant="secondary" className="text-xs gap-1 shrink-0">
                    <Users className="h-3 w-3" /> {r.staffCount}
                  </Badge>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Role editor */}
        <div className="lg:col-span-2">
          {!selectedId ? (
            <div className="rounded-2xl border border-border bg-card h-full flex items-center justify-center min-h-[300px]">
              <EmptyState icon={Shield} message="Select a role, or create a new one" />
            </div>
          ) : (
            <div className="rounded-2xl border border-border bg-card">
              <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-2 flex-wrap">
                <div className="flex-1 min-w-[200px] space-y-2">
                  <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Role name, e.g. Accountant" className="font-semibold" />
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional description" rows={1} className="text-xs resize-none" />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {selectedId !== NEW_ROLE && (
                    <Button size="sm" variant="outline" className="gap-1.5 text-red-600 hover:text-red-700" onClick={() => setConfirmDelete(true)}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete
                    </Button>
                  )}
                  <Button size="sm" className="gap-1.5 bg-gradient-to-r from-primary to-accent border-0 text-white" onClick={save} disabled={saving}>
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
                  </Button>
                </div>
              </div>

              <div className="p-4 space-y-2">
                <p className="text-xs text-muted-foreground mb-2">
                  <strong>Open</strong> shows the section in the sidebar with its basic list view. View/Create/Edit/Delete each unlock one more capability within it.
                </p>
                {ROLE_SECTIONS.map((section) => {
                  const perm = sections[section.key];
                  return (
                    <div key={section.key} className="rounded-xl border border-border px-3.5 py-3">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <p className="text-sm font-semibold text-foreground">{section.label}</p>
                        <div className="flex items-center gap-3 flex-wrap">
                          {section.actions.map((action) => {
                            const locked = action !== "open" && !perm.open;
                            return (
                              <label
                                key={action}
                                className={`flex items-center gap-1.5 text-xs font-medium select-none ${
                                  locked ? "text-muted-foreground/50 cursor-not-allowed" : "text-foreground cursor-pointer"
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={perm[action]}
                                  disabled={locked}
                                  onChange={() => toggleAction(section.key, action)}
                                  className="h-3.5 w-3.5 rounded border-border accent-primary disabled:cursor-not-allowed"
                                />
                                {ACTION_LABELS[action]}
                              </label>
                            );
                          })}
                        </div>
                      </div>
                      {section.extras && (
                        <div className="mt-2.5 pt-2.5 border-t border-border/70 flex items-center gap-3 flex-wrap">
                          {section.extras.map((extra) => (
                            <label
                              key={extra.key}
                              className={`flex items-center gap-1.5 text-xs select-none ${
                                perm.open ? "text-muted-foreground cursor-pointer" : "text-muted-foreground/50 cursor-not-allowed"
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={perm.extras[extra.key] === true}
                                disabled={!perm.open}
                                onChange={() => toggleExtra(section.key, extra.key)}
                                className="h-3.5 w-3.5 rounded border-border accent-primary disabled:cursor-not-allowed"
                              />
                              {extra.label}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`Delete the "${selected?.name}" role?`}
        description="This can't be undone. Blocked automatically if any staff member still holds this role."
        confirmLabel="Delete role"
        variant="destructive"
        loading={deleting}
        onConfirm={remove}
      />
    </div>
  );
}
