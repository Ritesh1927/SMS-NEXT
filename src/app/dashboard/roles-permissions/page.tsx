"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield, Plus, Loader2, Save, Trash2, Users, Pencil, X, Check, Zap,
  GraduationCap, UserRound, School, Link2, CalendarCheck, ClipboardList, BookOpen,
  CalendarClock, Library, IndianRupee, Megaphone, MessageSquare, BarChart3, Trophy, Brain,
  type LucideIcon,
} from "lucide-react";
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
import { cn } from "@/lib/utils";

const ACTION_LABELS: Record<SectionAction, string> = { open: "Open", view: "View", create: "Create", edit: "Edit", delete: "Delete" };

// Mirrors the icon each section uses in the real sidebar (AppSidebar.tsx),
// so a role's checklist visually matches what the staff member will see.
const SECTION_ICONS: Record<string, LucideIcon> = {
  students: Users,
  staff: GraduationCap,
  parents: UserRound,
  classes: School,
  subjectClass: Link2,
  attendance: CalendarCheck,
  exams: ClipboardList,
  homework: BookOpen,
  timetable: CalendarClock,
  studyMaterials: Library,
  fees: IndianRupee,
  notices: Megaphone,
  communication: MessageSquare,
  reports: BarChart3,
  leaderboard: Trophy,
  aiAssistant: Brain,
};

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
  // A registered (already-saved) role opens read-only -- editing it requires
  // an explicit click on Edit, so an admin can't change a role's access by
  // accident while just looking at it. A brand-new, not-yet-saved role is
  // always editable (there's nothing to protect yet), and saving re-locks it.
  const [editable, setEditable] = useState(false);

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
    setEditable(false);
  };

  const startNew = () => {
    setSelectedId(NEW_ROLE);
    setName("");
    setDescription("");
    setSections(buildEmptySections());
    setEditable(true);
  };

  const cancelEdit = () => {
    if (selected) selectRole(selected);
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
      setEditable(false);
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
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Role name, e.g. Accountant"
                    className="font-semibold disabled:opacity-100 disabled:cursor-default"
                    disabled={!editable}
                  />
                  <Textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Optional description"
                    rows={1}
                    className="text-xs resize-none disabled:opacity-100 disabled:cursor-default"
                    disabled={!editable}
                  />
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {!editable ? (
                    <>
                      <Button size="sm" variant="outline" className="gap-1.5 text-red-600 hover:text-red-700" onClick={() => setConfirmDelete(true)}>
                        <Trash2 className="h-3.5 w-3.5" /> Delete
                      </Button>
                      <Button size="sm" className="gap-1.5 bg-gradient-to-r from-primary to-accent border-0 text-white" onClick={() => setEditable(true)}>
                        <Pencil className="h-3.5 w-3.5" /> Edit
                      </Button>
                    </>
                  ) : (
                    <>
                      {selectedId !== NEW_ROLE && (
                        <Button size="sm" variant="outline" className="gap-1.5" onClick={cancelEdit} disabled={saving}>
                          <X className="h-3.5 w-3.5" /> Cancel
                        </Button>
                      )}
                      <Button size="sm" className="gap-1.5 bg-gradient-to-r from-primary to-accent border-0 text-white" onClick={save} disabled={saving}>
                        {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Save
                      </Button>
                    </>
                  )}
                </div>
              </div>

              <div className="p-4 space-y-3">
                <p className="text-xs text-muted-foreground mb-1">
                  <strong className="text-foreground">Open</strong> shows the section in the sidebar with its basic list view. View/Create/Edit/Delete each unlock one more capability within it.
                  {!editable && selectedId !== NEW_ROLE && <span> Click Edit above to change anything.</span>}
                </p>
                {ROLE_SECTIONS.map((section) => {
                  const perm = sections[section.key];
                  const Icon = SECTION_ICONS[section.key] || Shield;
                  return (
                    <div
                      key={section.key}
                      className={cn(
                        "rounded-[14px] bg-card shadow-[0_0_0_1px_rgba(15,23,42,0.07)] px-4 py-3.5 transition-colors",
                        perm.open && "shadow-[0_0_0_1.5px_rgba(79,70,229,0.25)] bg-primary/[0.025]",
                      )}
                    >
                      <div className="grid grid-cols-[9.5rem_1fr] items-center gap-x-3 gap-y-2.5 sm:grid-cols-[10.5rem_1fr]">
                        <div className="flex items-center gap-2.5">
                          <span
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors",
                              perm.open ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground/60",
                            )}
                          >
                            <Icon className="h-4 w-4" />
                          </span>
                          <p className="text-sm font-semibold text-foreground">{section.label}</p>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          {section.actions.map((action) => (
                            <PermissionChip
                              key={action}
                              label={ACTION_LABELS[action]}
                              checked={perm[action]}
                              locked={!editable || (action !== "open" && !perm.open)}
                              variant="action"
                              onToggle={() => toggleAction(section.key, action)}
                            />
                          ))}
                        </div>

                        {section.extras && (
                          <>
                            <div className="col-span-2 border-t border-dashed border-border" />
                            <div />
                            <div className="flex items-center gap-2 flex-wrap">
                              {section.extras.map((extra) => (
                                <PermissionChip
                                  key={extra.key}
                                  label={extra.label}
                                  checked={perm.extras[extra.key] === true}
                                  locked={!editable || !perm.open}
                                  variant="extra"
                                  onToggle={() => toggleExtra(section.key, extra.key)}
                                />
                              ))}
                            </div>
                          </>
                        )}
                      </div>
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

function PermissionChip({
  label,
  checked,
  locked,
  variant,
  onToggle,
}: {
  label: string;
  checked: boolean;
  locked: boolean;
  variant: "action" | "extra";
  onToggle: () => void;
}) {
  return (
    <label
      className={cn(
        "relative inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors select-none",
        locked
          ? "cursor-not-allowed border-transparent bg-muted/60 text-muted-foreground/40"
          : checked
            ? variant === "extra"
              ? "cursor-pointer border-amber-500 bg-amber-500 text-white shadow-sm"
              : "cursor-pointer border-primary bg-primary text-white shadow-sm"
            : "cursor-pointer border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground",
      )}
    >
      <input type="checkbox" className="sr-only" checked={checked} disabled={locked} onChange={onToggle} />
      {checked ? <Check className="h-3 w-3" /> : variant === "extra" ? <Zap className="h-3 w-3 opacity-50" /> : null}
      {label}
    </label>
  );
}
