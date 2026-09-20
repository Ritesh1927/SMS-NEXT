"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BookOpen, School, LayoutGrid, Plus, Pencil, Trash2, Check, X, ChevronDown, ChevronRight, Copy, Users, Link2, Loader2 } from "lucide-react";
import { getToken } from "@/contexts/AuthContext";
import { apiGet, apiPost } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/PageHeader";

interface SubjectRow {
  _id: string;
  name: string;
  code: string;
  description: string;
}

interface ClassOption {
  _id: string;
  name: string;
  section: string;
}

interface ClassWithSubjects {
  _id: string;
  name: string;
  section: string;
  assignedSubjects: SubjectRow[];
}

const EMPTY_FORM = { name: "", description: "" };

function autoCode(name: string): string {
  const words = name.trim().split(/\s+/);
  return words.length === 1 ? words[0].substring(0, 4).toUpperCase() : words.map((w) => w[0]).join("").toUpperCase().substring(0, 4);
}

export default function SubjectsPage() {
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [classes, setClasses] = useState<ClassOption[]>([]);
  const [classAssignments, setClassAssignments] = useState<ClassWithSubjects[]>([]);
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const [classesLoading, setClassesLoading] = useState(true);
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);

  const [subjectDialog, setSubjectDialog] = useState(false);
  const [editSubject, setEditSubject] = useState<SubjectRow | null>(null);
  const [subjectForm, setSubjectForm] = useState(EMPTY_FORM);
  const [nameError, setNameError] = useState("");
  const [savingSubject, setSavingSubject] = useState(false);
  const [deleteSubjectId, setDeleteSubjectId] = useState<string | null>(null);
  const [deletingSubject, setDeletingSubject] = useState(false);

  const [singleClassId, setSingleClassId] = useState("");
  const [singleSubjectIds, setSingleSubjectIds] = useState<Set<string>>(new Set());
  const [bulkClassIds, setBulkClassIds] = useState<Set<string>>(new Set());
  const [bulkSubjectIds, setBulkSubjectIds] = useState<Set<string>>(new Set());
  const [expandedClasses, setExpandedClasses] = useState<Set<string>>(new Set());
  const [assigning, setAssigning] = useState(false);

  const fetchSubjects = () => {
    const token = getToken();
    if (!token) return;
    apiGet<{ success: boolean; data: SubjectRow[] }>("/subjects", token)
      .then((res) => setSubjects(res.data))
      .catch(() => toast.error("Failed to load subjects."))
      .finally(() => setSubjectsLoading(false));
  };

  const fetchClasses = () => {
    const token = getToken();
    if (!token) return;
    apiGet<{ success: boolean; data: { _id: string; name: string; section: string }[] }>("/classes", token)
      .then((res) => setClasses(res.data.map((c) => ({ _id: c._id, name: c.name, section: c.section }))))
      .catch(() => toast.error("Failed to load classes."))
      .finally(() => setClassesLoading(false));
  };

  const fetchAssignments = () => {
    const token = getToken();
    if (!token) return;
    apiGet<{ success: boolean; data: ClassWithSubjects[] }>("/subjects/assignments", token)
      .then((res) => setClassAssignments(res.data))
      .catch(() => toast.error("Failed to load assignments."))
      .finally(() => setAssignmentsLoading(false));
  };

  useEffect(() => {
    fetchSubjects();
    fetchClasses();
    fetchAssignments();
  }, []);

  const getAssignedIds = (classId: string): string[] => classAssignments.find((c) => c._id === classId)?.assignedSubjects.map((s) => s._id) || [];
  const getAssignedSubjects = (classId: string): SubjectRow[] => classAssignments.find((c) => c._id === classId)?.assignedSubjects || [];
  const getClassById = (id: string) => classes.find((c) => c._id === id);

  const openCreateSubject = () => {
    setEditSubject(null);
    setSubjectForm(EMPTY_FORM);
    setNameError("");
    setSubjectDialog(true);
  };

  const openEditSubject = (s: SubjectRow) => {
    setEditSubject(s);
    setSubjectForm({ name: s.name, description: s.description });
    setNameError("");
    setSubjectDialog(true);
  };

  const saveSubject = async () => {
    if (!subjectForm.name.trim()) {
      setNameError("Subject name is required.");
      return;
    }
    const token = getToken();
    if (!token) return;
    setSavingSubject(true);
    try {
      if (editSubject) {
        const res = await fetch(`/api/subjects/${editSubject._id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ name: subjectForm.name, description: subjectForm.description }),
        });
        const json = await res.json();
        if (!res.ok || json.success === false) throw new Error(json.message || "Failed to save subject.");
        toast.success("Subject updated.");
      } else {
        await apiPost("/subjects", { name: subjectForm.name, description: subjectForm.description }, token);
        toast.success("Subject created.");
      }
      setSubjectDialog(false);
      fetchSubjects();
      fetchAssignments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save subject.");
    } finally {
      setSavingSubject(false);
    }
  };

  const confirmDeleteSubject = async () => {
    if (!deleteSubjectId) return;
    setDeletingSubject(true);
    const token = getToken();
    try {
      const res = await fetch(`/api/subjects/${deleteSubjectId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (!res.ok || json.success === false) throw new Error(json.message || "Failed to delete subject.");
      toast.success("Subject deleted.");
      setDeleteSubjectId(null);
      fetchSubjects();
      fetchAssignments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to delete subject.");
    } finally {
      setDeletingSubject(false);
    }
  };

  const toggleSingleSubject = (sid: string, checked: boolean) => {
    setSingleSubjectIds((prev) => {
      const next = new Set(prev);
      if (checked) next.add(sid);
      else next.delete(sid);
      return next;
    });
  };

  const assignSingle = async () => {
    if (!singleClassId) return toast.error("Please select a class.");
    if (singleSubjectIds.size === 0) return toast.error("Please select at least one subject.");
    const token = getToken();
    if (!token) return;
    setAssigning(true);
    try {
      await apiPost("/subjects/assign", { classId: singleClassId, subjectIds: Array.from(singleSubjectIds) }, token);
      toast.success("Subjects assigned.");
      setSingleSubjectIds(new Set());
      fetchAssignments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Assignment failed.");
    } finally {
      setAssigning(false);
    }
  };

  const assignBulk = async () => {
    if (bulkClassIds.size === 0) return toast.error("Please select at least one class.");
    if (bulkSubjectIds.size === 0) return toast.error("Please select at least one subject.");
    const token = getToken();
    if (!token) return;
    setAssigning(true);
    try {
      await apiPost("/subjects/bulk-assign", { classIds: Array.from(bulkClassIds), subjectIds: Array.from(bulkSubjectIds) }, token);
      toast.success(`${bulkSubjectIds.size} subject(s) assigned to ${bulkClassIds.size} class(es).`);
      setBulkClassIds(new Set());
      setBulkSubjectIds(new Set());
      fetchAssignments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Bulk assignment failed.");
    } finally {
      setAssigning(false);
    }
  };

  const removeSubjectFromClass = async (classId: string, subjectId: string) => {
    const token = getToken();
    try {
      const res = await fetch("/api/subjects/unassign", {
        method: "DELETE",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ classId, subjectId }),
      });
      const json = await res.json();
      if (!res.ok || json.success === false) throw new Error(json.message || "Failed to remove subject.");
      fetchAssignments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove subject.");
    }
  };

  const toggleExpanded = (classId: string) => {
    setExpandedClasses((prev) => {
      const next = new Set(prev);
      if (next.has(classId)) next.delete(classId);
      else next.add(classId);
      return next;
    });
  };

  const isLoading = classesLoading || subjectsLoading;

  return (
    <div className="space-y-6">
      <PageHeader icon={BookOpen} title="Subject & Class Assignment" subtitle="Manage subjects and assign them to existing classes." accent="violet" />

      <Tabs defaultValue="subjects" className="space-y-4">
        <TabsList>
          <TabsTrigger value="subjects" className="gap-1.5">
            <BookOpen className="h-4 w-4" /> Subjects
          </TabsTrigger>
          <TabsTrigger value="assign" className="gap-1.5">
            <Link2 className="h-4 w-4" /> Assign Subjects
          </TabsTrigger>
          <TabsTrigger value="summary" className="gap-1.5">
            <LayoutGrid className="h-4 w-4" /> Summary
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subjects" className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Subjects</h2>
              <p className="text-sm text-muted-foreground">{subjectsLoading ? "Loading…" : `${subjects.length} subject(s)`}</p>
            </div>
            <Button onClick={openCreateSubject} className="gap-2" disabled={subjectsLoading}>
              <Plus className="h-4 w-4" /> Add Subject
            </Button>
          </div>

          {subjectsLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Loading subjects…
              </CardContent>
            </Card>
          ) : subjects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <BookOpen className="h-12 w-12 text-muted-foreground/70/40 mb-3" />
                <p className="font-medium text-sm text-foreground">No subjects yet</p>
                <p className="text-xs text-muted-foreground mt-1">Create your first subject to get started.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Subject Name</TableHead>
                    <TableHead>Code</TableHead>
                    <TableHead className="hidden md:table-cell">Description</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {subjects.map((s) => (
                    <TableRow key={s._id}>
                      <TableCell className="font-medium text-foreground">{s.name}</TableCell>
                      <TableCell>
                        <span className="font-mono text-xs px-2 py-0.5 rounded-full bg-muted text-foreground/90">{s.code}</span>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-muted-foreground text-sm max-w-xs truncate">{s.description || "—"}</TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button variant="ghost" size="icon-sm" onClick={() => openEditSubject(s)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon-sm" className="text-red-600 hover:text-red-600" onClick={() => setDeleteSubjectId(s._id)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="assign" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <School className="h-5 w-5 text-primary" /> Single Assignment
              </CardTitle>
              <CardDescription>Select one class and assign subjects to it.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : classes.length === 0 || subjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">{classes.length === 0 ? "No classes found. Create classes from the Classes page first." : "Please create at least one subject first."}</p>
              ) : (
                <>
                  <div className="space-y-2">
                    <Label>Select Class</Label>
                    <Select
                      value={singleClassId}
                      onValueChange={(v) => {
                        setSingleClassId(v || "");
                        setSingleSubjectIds(new Set());
                      }}
                    >
                      <SelectTrigger className="max-w-sm">
                        <SelectValue placeholder="Choose a class…" />
                      </SelectTrigger>
                      <SelectContent>
                        {classes.map((c) => (
                          <SelectItem key={c._id} value={c._id}>
                            {c.name}
                            {c.section ? ` — ${c.section}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>Select Subjects to Assign</Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
                      {subjects.map((s) => {
                        const assigned = singleClassId ? getAssignedIds(singleClassId).includes(s._id) : false;
                        return (
                          <label
                            key={s._id}
                            className={`flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors ${
                              assigned ? "opacity-50 cursor-not-allowed bg-muted/50 border-border" : singleSubjectIds.has(s._id) ? "border-primary bg-primary/5 cursor-pointer" : "border-border hover:bg-muted/50 cursor-pointer"
                            }`}
                          >
                            <input type="checkbox" className="h-4 w-4" checked={singleSubjectIds.has(s._id)} disabled={assigned} onChange={(e) => toggleSingleSubject(s._id, e.target.checked)} />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate text-foreground">{s.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{s.code}</p>
                            </div>
                            {assigned && <span className="ml-auto text-[10px] shrink-0 px-1.5 py-0.5 rounded-full border border-border text-muted-foreground">assigned</span>}
                          </label>
                        );
                      })}
                    </div>
                  </div>

                  <Button onClick={assignSingle} className="gap-2" disabled={assigning || !singleClassId || singleSubjectIds.size === 0}>
                    {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Assign{singleSubjectIds.size > 0 ? ` ${singleSubjectIds.size}` : ""} Subject{singleSubjectIds.size !== 1 ? "s" : ""}
                  </Button>

                  {singleClassId && getAssignedSubjects(singleClassId).length > 0 && (
                    <div className="pt-4 border-t border-border space-y-2">
                      <p className="text-sm font-medium text-foreground">
                        Currently assigned to <span className="text-primary">{getClassById(singleClassId)?.name}</span>:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {getAssignedSubjects(singleClassId).map((subj) => (
                          <span key={subj._id} className="inline-flex items-center gap-1.5 pr-1.5 py-1 pl-2.5 rounded-full bg-muted text-foreground/90 text-xs font-medium">
                            <BookOpen className="h-3 w-3 shrink-0" />
                            {subj.name}
                            <button onClick={() => removeSubjectFromClass(singleClassId, subj._id)} className="ml-1 rounded-full hover:bg-red-100 p-0.5" aria-label={`Remove ${subj.name}`}>
                              <X className="h-3 w-3" />
                            </button>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Copy className="h-5 w-5 text-primary" /> Bulk Assignment
              </CardTitle>
              <CardDescription>Select multiple classes and subjects, then assign them all at once.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                </div>
              ) : classes.length === 0 || subjects.length === 0 ? (
                <p className="text-sm text-muted-foreground">{classes.length === 0 ? "No classes found." : "Please create at least one subject first."}</p>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Select Classes</Label>
                        <span className="text-xs text-muted-foreground">{bulkClassIds.size} selected</span>
                      </div>
                      <div className="border border-border rounded-lg divide-y divide-border max-h-56 overflow-y-auto">
                        {classes.map((c) => (
                          <label key={c._id} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer ${bulkClassIds.has(c._id) ? "bg-primary/5" : "hover:bg-muted/50"}`}>
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={bulkClassIds.has(c._id)}
                              onChange={(e) => {
                                setBulkClassIds((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(c._id);
                                  else next.delete(c._id);
                                  return next;
                                });
                              }}
                            />
                            <p className="text-sm font-medium text-foreground">
                              {c.name}
                              {c.section ? ` — ${c.section}` : ""}
                            </p>
                          </label>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Select Subjects</Label>
                        <span className="text-xs text-muted-foreground">{bulkSubjectIds.size} selected</span>
                      </div>
                      <div className="border border-border rounded-lg divide-y divide-border max-h-56 overflow-y-auto">
                        {subjects.map((s) => (
                          <label key={s._id} className={`flex items-center gap-3 px-3 py-2.5 cursor-pointer ${bulkSubjectIds.has(s._id) ? "bg-primary/5" : "hover:bg-muted/50"}`}>
                            <input
                              type="checkbox"
                              className="h-4 w-4"
                              checked={bulkSubjectIds.has(s._id)}
                              onChange={(e) => {
                                setBulkSubjectIds((prev) => {
                                  const next = new Set(prev);
                                  if (e.target.checked) next.add(s._id);
                                  else next.delete(s._id);
                                  return next;
                                });
                              }}
                            />
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate text-foreground">{s.name}</p>
                              <p className="text-xs text-muted-foreground font-mono">{s.code}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>

                  <Button onClick={assignBulk} className="gap-2" disabled={assigning || bulkClassIds.size === 0 || bulkSubjectIds.size === 0}>
                    {assigning ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                    Assign {bulkSubjectIds.size > 0 ? `${bulkSubjectIds.size} subject(s)` : "subjects"} to {bulkClassIds.size > 0 ? `${bulkClassIds.size} class(es)` : "selected classes"}
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {!isLoading && classes.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Users className="h-5 w-5 text-primary" /> Per-Class Assignment Overview
                </CardTitle>
                <CardDescription>Expand a class to view or remove its assigned subjects.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {assignmentsLoading ? (
                  <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" /> Loading assignments…
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {classes.map((c) => {
                      const assignedSubjects = getAssignedSubjects(c._id);
                      const isExpanded = expandedClasses.has(c._id);
                      return (
                        <div key={c._id}>
                          <button className="w-full flex items-center justify-between px-6 py-3.5 hover:bg-muted/50 text-left" onClick={() => toggleExpanded(c._id)}>
                            <div className="flex items-center gap-3 min-w-0">
                              <School className="h-4 w-4 text-muted-foreground shrink-0" />
                              <span className="font-medium text-sm text-foreground truncate">
                                {c.name}
                                {c.section ? ` — ${c.section}` : ""}
                              </span>
                              <span className="text-xs shrink-0 px-2 py-0.5 rounded-full border border-border text-muted-foreground">
                                {assignedSubjects.length} subject{assignedSubjects.length !== 1 ? "s" : ""}
                              </span>
                            </div>
                            {isExpanded ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" /> : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
                          </button>
                          {isExpanded && (
                            <div className="px-6 py-4 bg-muted/50 border-t border-border">
                              {assignedSubjects.length === 0 ? (
                                <p className="text-sm text-muted-foreground">No subjects assigned yet.</p>
                              ) : (
                                <div className="flex flex-wrap gap-2">
                                  {assignedSubjects.map((subj) => (
                                    <span key={subj._id} className="inline-flex items-center gap-1.5 pr-1.5 py-1 pl-2.5 rounded-full bg-card border border-border text-foreground/90 text-xs font-medium">
                                      <BookOpen className="h-3 w-3 shrink-0" />
                                      {subj.name}
                                      <span className="text-muted-foreground/70 font-mono text-[10px]">{subj.code}</span>
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          removeSubjectFromClass(c._id, subj._id);
                                        }}
                                        className="ml-0.5 rounded-full hover:bg-red-100 p-0.5"
                                        aria-label={`Remove ${subj.name}`}
                                      >
                                        <X className="h-3 w-3" />
                                      </button>
                                    </span>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="summary">
          {isLoading || assignmentsLoading ? (
            <Card>
              <CardContent className="flex items-center justify-center py-16 gap-2 text-muted-foreground text-sm">
                <Loader2 className="h-5 w-5 animate-spin" /> Loading…
              </CardContent>
            </Card>
          ) : classes.length === 0 || subjects.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-16 text-center">
                <LayoutGrid className="h-12 w-12 text-muted-foreground/70/40 mb-3" />
                <p className="font-medium text-sm text-foreground">Nothing to show yet</p>
                <p className="text-xs text-muted-foreground mt-1">{classes.length === 0 ? "No classes found." : "Create at least one subject to see the assignment matrix."}</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Assignment Matrix</CardTitle>
                <CardDescription>Rows = classes · Columns = subjects · ✓ = assigned</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="sticky left-0 bg-card z-10 min-w-[160px] border-r border-border">Class</TableHead>
                        {subjects.map((s) => (
                          <TableHead key={s._id} className="text-center min-w-[110px]">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-xs font-medium">{s.name}</span>
                              <span className="text-[10px] font-mono px-1 py-0 rounded border border-border text-muted-foreground">{s.code}</span>
                            </div>
                          </TableHead>
                        ))}
                        <TableHead className="text-center min-w-[80px]">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {classes.map((c) => {
                        const assignedSet = new Set(getAssignedIds(c._id));
                        return (
                          <TableRow key={c._id}>
                            <TableCell className="sticky left-0 bg-card border-r border-border">
                              <p className="text-sm font-medium text-foreground">{c.name}</p>
                              <p className="text-xs text-muted-foreground">{c.section ? `Sec. ${c.section}` : ""}</p>
                            </TableCell>
                            {subjects.map((s) => (
                              <TableCell key={s._id} className="text-center">
                                {assignedSet.has(s._id) ? (
                                  <div className="h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center mx-auto">
                                    <Check className="h-3.5 w-3.5 text-primary" />
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground/70/40 text-lg leading-none">—</span>
                                )}
                              </TableCell>
                            ))}
                            <TableCell className="text-center">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${assignedSet.size === subjects.length ? "bg-primary text-white" : "bg-muted text-foreground/90"}`}>
                                {assignedSet.size}/{subjects.length}
                              </span>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={subjectDialog} onOpenChange={setSubjectDialog}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editSubject ? "Edit Subject" : "Create Subject"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>
                Subject Name <span className="text-red-500">*</span>
              </Label>
              <Input placeholder="e.g. Mathematics" value={subjectForm.name} onChange={(e) => setSubjectForm((f) => ({ ...f, name: e.target.value }))} />
              {nameError && <p className="text-xs text-red-600">{nameError}</p>}
            </div>
            {editSubject ? (
              <div className="space-y-1.5">
                <Label>Subject Code</Label>
                <Input value={editSubject.code} disabled className="bg-muted/50 font-mono text-sm" />
                <p className="text-[11px] text-muted-foreground">Auto-generated code</p>
              </div>
            ) : (
              subjectForm.name.trim() && (
                <div className="space-y-1.5">
                  <Label>Subject Code (auto)</Label>
                  <Input value={autoCode(subjectForm.name)} disabled className="bg-muted/50 font-mono text-sm" />
                  <p className="text-[11px] text-muted-foreground">Auto-generated from name</p>
                </div>
              )
            )}
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea placeholder="Optional description…" value={subjectForm.description} onChange={(e) => setSubjectForm((f) => ({ ...f, description: e.target.value }))} rows={3} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubjectDialog(false)} disabled={savingSubject}>
              Cancel
            </Button>
            <Button onClick={saveSubject} disabled={savingSubject}>
              {savingSubject ? <Loader2 className="h-4 w-4 animate-spin" /> : editSubject ? "Save Changes" : "Create Subject"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteSubjectId} onOpenChange={(o) => !o && setDeleteSubjectId(null)}>
        <DialogContent className="max-w-sm max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Delete Subject</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground py-2">Are you sure? This subject will be removed from all class assignments and cannot be undone.</p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteSubjectId(null)} disabled={deletingSubject}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDeleteSubject} disabled={deletingSubject}>
              {deletingSubject ? <Loader2 className="h-4 w-4 animate-spin" /> : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
