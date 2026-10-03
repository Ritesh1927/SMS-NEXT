"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, Save, Shield, School, SlidersHorizontal, Bell, DollarSign, Upload, Mail, MessageSquare, CalendarCheck, BookOpen, Lock, AlarmClock, Users, CalendarOff, Trash2, ChevronLeft, ChevronRight, type LucideIcon } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { PageHeader } from "@/components/PageHeader";
import { PageLoader } from "@/components/PageLoader";
import { getHolidayInfo, getEventInfo } from "@/lib/holidays";

interface SchoolProfile {
  schoolName: string;
  schoolAddress: string;
  schoolPhone: string;
  schoolEmail: string;
  website: string;
  logo: string;
  themeColor: string;
  secondaryColor: string;
  name: string;
  phone: string;
  settings: {
    sessionStartMonth: string;
    establishedYear: string;
    affiliation: string;
    gradingScale: "percentage" | "gpa" | "letter";
    termStructure: "semester" | "trimester" | "quarterly";
    passPercentage: number;
    notifications: {
      emailAlerts: boolean;
      smsAlerts: boolean;
      attendanceAlerts: boolean;
      feeReminders: boolean;
      examNotifications: boolean;
    };
    security: {
      sessionTimeout: number;
      maxLoginAttempts: number;
      twoFactorAuth: boolean;
    };
    lateFee: {
      enabled: boolean;
      gracePeriod: number;
      type: "fixed" | "percentage";
      amount: number;
      percent: number;
      maxAmount: number;
    };
    holidays: {
      weeklyOffDays: number[];
      dates: { _id?: string; date: string; name: string }[];
    };
    events: { _id?: string; date: string; name: string }[];
  };
}

interface ProfileResponse {
  success: boolean;
  data: SchoolProfile;
}

interface ApiMessageResponse {
  success: boolean;
  message?: string;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getSessionRange(sessionStartMonth: string) {
  const startIdx = MONTHS.indexOf(sessionStartMonth);
  if (startIdx < 0) return { startYear: "", endYear: "", label: "" };
  const now = new Date();
  const currentYear = now.getFullYear();
  const endMonthIdx = (startIdx + 11) % 12;
  const endYear = endMonthIdx < startIdx ? currentYear + 1 : currentYear;
  return {
    startYear: String(currentYear),
    endYear: String(endYear),
    label: `${sessionStartMonth} ${currentYear} to ${MONTHS[endMonthIdx]} ${endYear}`,
  };
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  const logoInputRef = useRef<HTMLInputElement>(null);

  const calToday = new Date();
  const [calMonth, setCalMonth] = useState(calToday.getMonth());
  const [calYear, setCalYear] = useState(calToday.getFullYear());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dialogType, setDialogType] = useState<"holiday" | "event">("holiday");
  const [dialogName, setDialogName] = useState("");

  // Only set for schools with a Super Admin-configured seat cap -- most
  // (self-signup) schools have none, and this card just doesn't render.
  const [seats, setSeats] = useState<{ used: number; total: number } | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<ProfileResponse>("/school/profile", token)
      .then((res) => setProfile(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load profile."));
    apiGet<{ success: boolean; data: { usersUsed: number | null; usersTotal: number } | null }>("/school/license", token)
      .then((res) => {
        if (res.data && res.data.usersUsed != null && res.data.usersTotal > 0) {
          setSeats({ used: res.data.usersUsed, total: res.data.usersTotal });
        }
      })
      .catch(() => {});
  }, []);

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file.");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setProfile((p) => p && { ...p, logo: reader.result as string });
    reader.readAsDataURL(file);
  };

  const calDateKey = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const changeCalMonth = (delta: number) => {
    let m = calMonth + delta;
    let y = calYear;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setCalMonth(m);
    setCalYear(y);
  };

  const toggleWeeklyOff = (day: number) => {
    setProfile((p) => {
      if (!p) return p;
      const current = p.settings.holidays.weeklyOffDays;
      const weeklyOffDays = current.includes(day) ? current.filter((d) => d !== day) : [...current, day].sort();
      return { ...p, settings: { ...p.settings, holidays: { ...p.settings.holidays, weeklyOffDays } } };
    });
  };

  // A given date holds at most one entry (either a holiday or an event, not
  // both) -- clicking an empty day shows an add form, clicking a day that
  // already has one shows it with a Remove button instead. `.slice(0, 10)`
  // normalizes both freshly-added "YYYY-MM-DD" strings and already-saved
  // ISO timestamps from the DB to the same comparable form.
  const findCalendarEntry = (p: SchoolProfile, dateStr: string): { type: "holiday" | "event"; index: number; name: string } | null => {
    const hIdx = p.settings.holidays.dates.findIndex((h) => h.date.slice(0, 10) === dateStr);
    if (hIdx !== -1) return { type: "holiday", index: hIdx, name: p.settings.holidays.dates[hIdx].name };
    const eIdx = p.settings.events.findIndex((ev) => ev.date.slice(0, 10) === dateStr);
    if (eIdx !== -1) return { type: "event", index: eIdx, name: p.settings.events[eIdx].name };
    return null;
  };

  const openDayDialog = (dateStr: string) => {
    setSelectedDate(dateStr);
    setDialogType("holiday");
    setDialogName("");
  };

  const saveCalendarEntry = () => {
    if (!selectedDate || !dialogName.trim()) {
      toast.error("Enter a name.");
      return;
    }
    setProfile((p) => {
      if (!p) return p;
      if (dialogType === "holiday") {
        const dates = [...p.settings.holidays.dates, { date: selectedDate, name: dialogName.trim() }].sort((a, b) => a.date.localeCompare(b.date));
        return { ...p, settings: { ...p.settings, holidays: { ...p.settings.holidays, dates } } };
      }
      const events = [...p.settings.events, { date: selectedDate, name: dialogName.trim() }].sort((a, b) => a.date.localeCompare(b.date));
      return { ...p, settings: { ...p.settings, events } };
    });
    setSelectedDate(null);
  };

  const removeCalendarEntry = () => {
    if (!selectedDate) return;
    setProfile((p) => {
      if (!p) return p;
      const existing = findCalendarEntry(p, selectedDate);
      if (!existing) return p;
      if (existing.type === "holiday") {
        const dates = p.settings.holidays.dates.filter((_, i) => i !== existing.index);
        return { ...p, settings: { ...p.settings, holidays: { ...p.settings.holidays, dates } } };
      }
      const events = p.settings.events.filter((_, i) => i !== existing.index);
      return { ...p, settings: { ...p.settings, events } };
    });
    setSelectedDate(null);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (profile.schoolEmail && !emailRegex.test(profile.schoolEmail)) {
      toast.error("Invalid Email", { description: "Please enter a valid school email address." });
      return;
    }
    const token = getToken();
    if (!token) return;
    setSaving(true);
    try {
      const res = await fetch("/api/school/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          schoolName: profile.schoolName,
          schoolAddress: profile.schoolAddress,
          schoolPhone: profile.schoolPhone,
          schoolEmail: profile.schoolEmail,
          website: profile.website,
          logo: profile.logo,
          themeColor: profile.themeColor,
          secondaryColor: profile.secondaryColor,
          name: profile.name,
          phone: profile.phone,
          settings: profile.settings,
        }),
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to save settings.");
      toast.success("Settings saved");
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (!oldPassword || !newPassword) {
      toast.error("Error", { description: "Enter your current and new password." });
      return;
    }
    if (newPassword.length < 6) {
      toast.error("Error", { description: "New password must be at least 6 characters." });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("Error", { description: "New password and confirmation don't match." });
      return;
    }
    const token = getToken();
    if (!token) return;
    setChangingPassword(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      const json: ApiMessageResponse = await res.json();
      if (!res.ok || !json.success) throw new Error(json.message || "Failed to change password.");
      toast.success("Password changed successfully");
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      toast.error("Error", { description: err instanceof Error ? err.message : "Something went wrong." });
    } finally {
      setChangingPassword(false);
    }
  };

  if (!user) return null;

  if (error) return <p className="text-sm text-red-600">{error}</p>;

  if (!profile) {
    return <PageLoader label="Loading settings..." />;
  }

  const sessionRange = getSessionRange(profile.settings.sessionStartMonth);

  const calFirstWeekday = new Date(calYear, calMonth, 1).getDay();
  const calDaysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const calCells: (number | null)[] = [...Array(calFirstWeekday).fill(null), ...Array.from({ length: calDaysInMonth }, (_, i) => i + 1)];
  const dialogEntry = selectedDate ? findCalendarEntry(profile, selectedDate) : null;

  return (
    <div>
      <PageHeader
        icon={SlidersHorizontal}
        title="Settings"
        subtitle="Manage your school configuration and preferences."
        accent="slate"
        actions={
          <Button form="settings-form" type="submit" className="gap-1.5 max-lg:h-11 max-lg:rounded-2xl max-lg:px-5 max-lg:shadow-lg max-lg:shadow-primary/25" disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Changes
          </Button>
        }
        className="mb-6"
      />

      <form id="settings-form" onSubmit={handleSubmit}>
        <Tabs defaultValue="school" className="space-y-4">
          <TabsList>
            <TabsTrigger value="school" className="gap-1.5"><School className="h-3.5 w-3.5" /> School Profile</TabsTrigger>
            <TabsTrigger value="academic" className="gap-1.5"><SlidersHorizontal className="h-3.5 w-3.5" /> Academic</TabsTrigger>
            <TabsTrigger value="notifications" className="gap-1.5"><Bell className="h-3.5 w-3.5" /> Notifications</TabsTrigger>
            <TabsTrigger value="security" className="gap-1.5"><Shield className="h-3.5 w-3.5" /> Security</TabsTrigger>
            <TabsTrigger value="fees" className="gap-1.5"><DollarSign className="h-3.5 w-3.5" /> Fees</TabsTrigger>
            <TabsTrigger value="holidays" className="gap-1.5"><CalendarOff className="h-3.5 w-3.5" /> Holidays</TabsTrigger>
          </TabsList>

          <TabsContent value="school" className="mt-4 space-y-4">
            {seats && (
              <Panel icon={Users} title="Plan Users" tint="blue">
                <div className="flex items-center justify-between gap-3">
                  <p className="text-sm text-muted-foreground">
                    <span className={`text-lg font-bold ${seats.used >= seats.total ? "text-destructive" : "text-foreground"}`}>{seats.used}</span>
                    <span className="text-muted-foreground"> / {seats.total} users on your plan</span>
                  </p>
                  {seats.used >= seats.total && (
                    <span className="text-xs font-medium text-destructive">Limit reached — contact the platform admin to add more.</span>
                  )}
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div
                    className={`h-full rounded-full ${seats.used >= seats.total ? "bg-destructive" : seats.used / seats.total >= 0.8 ? "bg-warning" : "bg-success"}`}
                    style={{ width: `${Math.min(100, Math.round((seats.used / seats.total) * 100))}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground">Counts your admin account, teaching &amp; non-teaching staff, and students. Parent accounts don&apos;t count toward this limit.</p>
              </Panel>
            )}
            <Panel icon={School} title="School Information">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Your Name">
                  <Input value={profile.name} onChange={(e) => setProfile((p) => p && { ...p, name: e.target.value })} placeholder="Admin's full name" />
                </Field>
                <Field label="School Name">
                  <Input value={profile.schoolName} onChange={(e) => setProfile((p) => p && { ...p, schoolName: e.target.value })} />
                </Field>
                <Field label="Email">
                  <Input type="email" value={profile.schoolEmail} onChange={(e) => setProfile((p) => p && { ...p, schoolEmail: e.target.value })} />
                </Field>
                <Field label="Phone">
                  <Input
                    value={profile.schoolPhone}
                    onChange={(e) => setProfile((p) => p && { ...p, schoolPhone: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="9876543210"
                  />
                </Field>
                <Field label="Address">
                  <Input value={profile.schoolAddress} onChange={(e) => setProfile((p) => p && { ...p, schoolAddress: e.target.value })} />
                </Field>
                <Field label="Website">
                  <Input value={profile.website} onChange={(e) => setProfile((p) => p && { ...p, website: e.target.value })} placeholder="https://..." />
                </Field>
              </div>

              <Field label="School Logo">
                <div className="flex items-center gap-4 rounded-xl border border-dashed border-border bg-muted/20 p-4 max-lg:gap-3.5 max-lg:rounded-2xl max-lg:border-2 max-lg:bg-muted/30 max-lg:p-3.5">
                  {profile.logo ? (
                    // eslint-disable-next-line @next/next/no-img-element -- data-URI/arbitrary remote logo, not an optimizable static asset.
                    <img src={profile.logo} alt="Logo" className="h-16 w-16 rounded-xl object-cover border border-border shadow-sm shrink-0 max-lg:h-14 max-lg:w-14 max-lg:rounded-2xl max-lg:shadow-md" />
                  ) : (
                    <div className="icon-chip h-16 w-16 shrink-0 bg-primary/10 text-primary max-lg:h-14 max-lg:w-14 max-lg:rounded-2xl max-lg:bg-gradient-to-br max-lg:from-primary max-lg:to-accent max-lg:text-white max-lg:shadow-md">
                      <School className="h-6 w-6" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => logoInputRef.current?.click()}
                      className="inline-flex items-center gap-2 rounded-lg bg-gradient-to-r from-primary to-accent px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90 transition-opacity max-lg:rounded-xl max-lg:px-3.5 max-lg:py-2.5 max-lg:shadow-md max-lg:shadow-primary/25 max-lg:active:scale-95"
                    >
                      <Upload className="h-4 w-4" /> {profile.logo ? "Change Logo" : "Upload Logo"}
                    </button>
                    <p className="mt-1.5 text-xs text-muted-foreground">PNG or JPG, square image recommended.</p>
                  </div>
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                </div>
              </Field>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Primary Theme Color">
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={profile.themeColor}
                      onChange={(e) => setProfile((p) => p && { ...p, themeColor: e.target.value })}
                      className="h-10 w-10 rounded-lg border border-border cursor-pointer"
                    />
                    <Input value={profile.themeColor} onChange={(e) => setProfile((p) => p && { ...p, themeColor: e.target.value })} className="font-mono" />
                  </div>
                </Field>
                <Field label="Secondary Color">
                  <div className="flex items-center gap-3">
                    <input
                      type="color"
                      value={profile.secondaryColor}
                      onChange={(e) => setProfile((p) => p && { ...p, secondaryColor: e.target.value })}
                      className="h-10 w-10 rounded-lg border border-border cursor-pointer"
                    />
                    <Input value={profile.secondaryColor} onChange={(e) => setProfile((p) => p && { ...p, secondaryColor: e.target.value })} className="font-mono" />
                  </div>
                </Field>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full" style={{ background: profile.themeColor }} />
                <div className="h-6 w-6 rounded-full" style={{ background: profile.secondaryColor }} />
                <span className="text-xs text-muted-foreground">Preview</span>
              </div>
            </Panel>
          </TabsContent>

          <TabsContent value="academic" className="mt-4">
            <Panel icon={SlidersHorizontal} title="Academic Settings" tint="violet">
              {sessionRange.label && (
                <div className="px-4 py-2.5 rounded-lg text-white text-sm font-semibold bg-gradient-to-br from-primary to-accent">
                  {sessionRange.label}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Session Start Month">
                  <Select
                    value={profile.settings.sessionStartMonth}
                    onValueChange={(v) => setProfile((p) => p && { ...p, settings: { ...p.settings, sessionStartMonth: v || p.settings.sessionStartMonth } })}
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {MONTHS.map((m) => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Current Year (Auto)">
                  <Input value={sessionRange.startYear && sessionRange.endYear ? `${sessionRange.startYear}-${sessionRange.endYear}` : ""} disabled className="bg-muted/50 font-mono" />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Established Year">
                  <Input
                    value={profile.settings.establishedYear}
                    onChange={(e) => setProfile((p) => p && { ...p, settings: { ...p.settings, establishedYear: e.target.value.replace(/\D/g, "").slice(0, 4) } })}
                    placeholder="e.g. 2010"
                    maxLength={4}
                  />
                </Field>
                <Field label="Affiliation">
                  <Input
                    value={profile.settings.affiliation}
                    onChange={(e) => setProfile((p) => p && { ...p, settings: { ...p.settings, affiliation: e.target.value } })}
                    placeholder="CBSE / ICSE / State Board"
                  />
                </Field>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Field label="Grading Scale">
                  <Select
                    value={profile.settings.gradingScale}
                    onValueChange={(v) => setProfile((p) => p && { ...p, settings: { ...p.settings, gradingScale: (v || p.settings.gradingScale) as SchoolProfile["settings"]["gradingScale"] } })}
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="percentage">Percentage (0-100%)</SelectItem>
                      <SelectItem value="gpa">GPA (0-4.0)</SelectItem>
                      <SelectItem value="letter">Letter Grade (A-F)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Term Structure">
                  <Select
                    value={profile.settings.termStructure}
                    onValueChange={(v) => setProfile((p) => p && { ...p, settings: { ...p.settings, termStructure: (v || p.settings.termStructure) as SchoolProfile["settings"]["termStructure"] } })}
                  >
                    <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="semester">Semester (2 terms)</SelectItem>
                      <SelectItem value="trimester">Trimester (3 terms)</SelectItem>
                      <SelectItem value="quarterly">Quarterly (4 terms)</SelectItem>
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Pass Percentage">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    value={profile.settings.passPercentage}
                    onChange={(e) => setProfile((p) => p && { ...p, settings: { ...p.settings, passPercentage: Number(e.target.value) } })}
                  />
                </Field>
              </div>
            </Panel>
          </TabsContent>

          <TabsContent value="notifications" className="mt-4">
            <Panel icon={Bell} title="Notification Preferences" tint="rose">
              {(
                [
                  ["emailAlerts", Mail, "bg-blue-500/10 text-blue-600", "Email Alerts", "Receive notifications via email"],
                  ["smsAlerts", MessageSquare, "bg-emerald-500/10 text-emerald-600", "SMS Alerts", "Receive notifications via SMS"],
                  ["attendanceAlerts", CalendarCheck, "bg-amber-500/10 text-amber-600", "Attendance Alerts", "Get notified when attendance is below threshold"],
                  ["feeReminders", DollarSign, "bg-rose-500/10 text-rose-600", "Fee Reminders", "Send automatic fee payment reminders"],
                  ["examNotifications", BookOpen, "bg-violet-500/10 text-violet-600", "Exam Notifications", "Notify students and parents about upcoming exams"],
                ] as [keyof SchoolProfile["settings"]["notifications"], LucideIcon, string, string, string][]
              ).map(([key, icon, colorClass, label, desc]) => (
                <ToggleRow
                  key={key}
                  icon={icon}
                  colorClass={colorClass}
                  label={label}
                  description={desc}
                  checked={profile.settings.notifications[key]}
                  onCheckedChange={(v) => setProfile((p) => p && { ...p, settings: { ...p.settings, notifications: { ...p.settings.notifications, [key]: v } } })}
                />
              ))}
            </Panel>
          </TabsContent>

          <TabsContent value="security" className="mt-4 space-y-4">
            <Panel icon={Shield} title="Security" tint="slate">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Session Timeout (minutes)">
                  <Input
                    type="number"
                    min={5}
                    value={profile.settings.security.sessionTimeout}
                    onChange={(e) => setProfile((p) => p && { ...p, settings: { ...p.settings, security: { ...p.settings.security, sessionTimeout: Number(e.target.value) } } })}
                  />
                </Field>
                <Field label="Max Login Attempts">
                  <Input
                    type="number"
                    min={1}
                    value={profile.settings.security.maxLoginAttempts}
                    onChange={(e) => setProfile((p) => p && { ...p, settings: { ...p.settings, security: { ...p.settings.security, maxLoginAttempts: Number(e.target.value) } } })}
                  />
                </Field>
              </div>
              <div className="pt-1 border-t border-border">
                <ToggleRow
                  icon={Lock}
                  colorClass="bg-indigo-500/10 text-indigo-600"
                  label="Two-Factor Authentication"
                  description="Add an extra layer of security"
                  checked={profile.settings.security.twoFactorAuth}
                  onCheckedChange={(v) => setProfile((p) => p && { ...p, settings: { ...p.settings, security: { ...p.settings.security, twoFactorAuth: v } } })}
                />
              </div>
            </Panel>

            <Panel icon={Shield} title="Change Password" tint="primary">
              <Field label="Current Password">
                <Input
                  type="password"
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                />
              </Field>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="New Password">
                  <Input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Min 6 characters"
                    autoComplete="new-password"
                  />
                </Field>
                <Field label="Confirm New Password">
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    autoComplete="new-password"
                    onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleChangePassword())}
                  />
                </Field>
              </div>
              <Button type="button" onClick={handleChangePassword} className="gap-1.5 bg-primary hover:bg-primary/90 max-lg:h-11 max-lg:w-full max-lg:rounded-2xl max-lg:shadow-lg max-lg:shadow-primary/25" disabled={changingPassword}>
                {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />} Change Password
              </Button>
            </Panel>
          </TabsContent>

          <TabsContent value="fees" className="mt-4">
            <Panel icon={DollarSign} title="Late Fee Configuration" tint="amber">
              <div className="pb-1 border-b border-border">
                <ToggleRow
                  icon={AlarmClock}
                  colorClass="bg-orange-500/10 text-orange-600"
                  label="Enable Late Fees"
                  description="Automatically apply late fees on overdue payments"
                  checked={profile.settings.lateFee.enabled}
                  onCheckedChange={(v) => setProfile((p) => p && { ...p, settings: { ...p.settings, lateFee: { ...p.settings.lateFee, enabled: v } } })}
                />
              </div>
              {profile.settings.lateFee.enabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <Field label="Grace Period (days)">
                    <Input
                      type="number"
                      min={0}
                      value={profile.settings.lateFee.gracePeriod}
                      onChange={(e) => setProfile((p) => p && { ...p, settings: { ...p.settings, lateFee: { ...p.settings.lateFee, gracePeriod: Number(e.target.value) } } })}
                    />
                    <p className="text-xs text-muted-foreground/70 mt-1">Days after due date before late fee applies</p>
                  </Field>
                  <Field label="Late Fee Type">
                    <Select
                      value={profile.settings.lateFee.type}
                      onValueChange={(v) => setProfile((p) => p && { ...p, settings: { ...p.settings, lateFee: { ...p.settings.lateFee, type: (v || p.settings.lateFee.type) as SchoolProfile["settings"]["lateFee"]["type"] } } })}
                    >
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="fixed">Fixed Amount</SelectItem>
                        <SelectItem value="percentage">Percentage</SelectItem>
                      </SelectContent>
                    </Select>
                  </Field>
                  {profile.settings.lateFee.type === "fixed" ? (
                    <Field label="Late Fee Amount (₹)">
                      <Input
                        type="number"
                        min={0}
                        value={profile.settings.lateFee.amount}
                        onChange={(e) => setProfile((p) => p && { ...p, settings: { ...p.settings, lateFee: { ...p.settings.lateFee, amount: Number(e.target.value) } } })}
                      />
                      <p className="text-xs text-muted-foreground/70 mt-1">Charged per day after grace period</p>
                    </Field>
                  ) : (
                    <Field label="Late Fee Percentage (%)">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        value={profile.settings.lateFee.percent}
                        onChange={(e) => setProfile((p) => p && { ...p, settings: { ...p.settings, lateFee: { ...p.settings.lateFee, percent: Number(e.target.value) } } })}
                      />
                      <p className="text-xs text-muted-foreground/70 mt-1">Percent of fee charged per day after grace period</p>
                    </Field>
                  )}
                  <Field label="Maximum Late Fee (₹)">
                    <Input
                      type="number"
                      min={0}
                      value={profile.settings.lateFee.maxAmount}
                      onChange={(e) => setProfile((p) => p && { ...p, settings: { ...p.settings, lateFee: { ...p.settings.lateFee, maxAmount: Number(e.target.value) } } })}
                    />
                    <p className="text-xs text-muted-foreground/70 mt-1">Cap on late fee amount</p>
                  </Field>
                </div>
              )}
            </Panel>
          </TabsContent>

          <TabsContent value="holidays" className="mt-4 space-y-4">
            <Panel icon={CalendarOff} title="Weekly Off Days" tint="slate">
              <p className="text-xs text-muted-foreground mb-3">Select the days of the week that are regular holidays for your school (e.g. Sunday only, or Saturday &amp; Sunday).</p>
              <div className="flex flex-wrap gap-2">
                {WEEKDAY_LABELS.map((label, day) => {
                  const selected = profile.settings.holidays.weeklyOffDays.includes(day);
                  return (
                    <button
                      key={day}
                      type="button"
                      onClick={() => toggleWeeklyOff(day)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border ${selected ? "bg-primary text-white border-transparent" : "border-border text-muted-foreground hover:border-primary hover:text-primary"}`}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </Panel>

            <Panel icon={CalendarOff} title="School Calendar" tint="slate">
              <p className="text-xs text-muted-foreground mb-3">Click a date to declare it a holiday or an event. Attendance cannot be marked on holiday dates; events are informational only.</p>
              <div className="flex items-center justify-between mb-3">
                <button type="button" onClick={() => changeCalMonth(-1)} className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted" aria-label="Previous month">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <p className="text-sm font-semibold text-foreground">{MONTHS[calMonth]} {calYear}</p>
                <button type="button" onClick={() => changeCalMonth(1)} className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted" aria-label="Next month">
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEKDAY_LABELS.map((d) => (
                  <p key={d} className="text-center text-[11px] font-medium text-muted-foreground/70">{d}</p>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1 mb-4">
                {calCells.map((day, i) => {
                  if (!day) return <div key={i} />;
                  const dateStr = calDateKey(calYear, calMonth, day);
                  const holiday = getHolidayInfo(new Date(calYear, calMonth, day), profile.settings.holidays);
                  const event = !holiday ? getEventInfo(new Date(calYear, calMonth, day), profile.settings.events) : null;
                  const cellStyle =
                    holiday?.type === "custom"
                      ? "bg-violet-100 text-violet-700 font-semibold hover:bg-violet-200"
                      : holiday?.type === "weekly"
                        ? "bg-slate-200 text-slate-600 font-semibold hover:bg-slate-300"
                        : event
                          ? "bg-sky-100 text-sky-700 font-semibold hover:bg-sky-200"
                          : "text-foreground hover:bg-muted";
                  return (
                    <button
                      key={i}
                      type="button"
                      onClick={() => openDayDialog(dateStr)}
                      title={holiday?.name || event?.name}
                      className={`h-9 rounded-lg flex items-center justify-center text-sm transition-colors ${cellStyle}`}
                    >
                      {day}
                    </button>
                  );
                })}
              </div>
              <div className="flex items-center gap-3 text-[11px] text-muted-foreground flex-wrap">
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-400" /> Weekly Off</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet-500" /> Holiday</span>
                <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-500" /> Event</span>
              </div>
            </Panel>
          </TabsContent>
        </Tabs>
      </form>

      <Dialog open={!!selectedDate} onOpenChange={(o) => { if (!o) setSelectedDate(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {selectedDate && new Date(selectedDate).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" })}
            </DialogTitle>
          </DialogHeader>

          {dialogEntry ? (
            <div className="py-2">
              <p className="text-xs text-muted-foreground mb-1">{dialogEntry.type === "holiday" ? "Holiday" : "Event"}</p>
              <p className="text-sm font-medium text-foreground">{dialogEntry.name}</p>
            </div>
          ) : (
            <div className="space-y-3 py-2">
              <div className="flex gap-2">
                {(["holiday", "event"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDialogType(t)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border capitalize ${dialogType === t ? "bg-primary text-white border-transparent" : "border-border text-muted-foreground hover:border-primary hover:text-primary"}`}
                  >
                    {t}
                  </button>
                ))}
              </div>
              <Input
                placeholder={dialogType === "holiday" ? "Holiday name (e.g. Diwali)" : "Event name (e.g. Annual Sports Day)"}
                value={dialogName}
                onChange={(e) => setDialogName(e.target.value)}
                maxLength={100}
                autoFocus
              />
            </div>
          )}

          <DialogFooter className="gap-2">
            {dialogEntry ? (
              <Button type="button" variant="destructive" onClick={removeCalendarEntry} className="gap-1.5">
                <Trash2 className="h-4 w-4" /> Remove
              </Button>
            ) : (
              <Button type="button" onClick={saveCalendarEntry}>Save</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Gradient tints for the Panel icon chip -- max-lg:* only, so this is a
// mobile-only upgrade (flat bg-primary/10 chip stays exactly as-is on
// desktop, ≥768px). Each utility is spelled out in full so Tailwind's
// static analysis can find it; a template string built from a bare color
// name wouldn't get picked up at build time.
const PANEL_TINTS = {
  primary: "max-lg:from-primary max-lg:to-accent",
  blue: "max-lg:from-sky-500 max-lg:to-blue-500",
  violet: "max-lg:from-violet-500 max-lg:to-purple-500",
  amber: "max-lg:from-amber-500 max-lg:to-orange-500",
  rose: "max-lg:from-rose-500 max-lg:to-pink-500",
  slate: "max-lg:from-slate-700 max-lg:to-slate-900",
} as const;

function Panel({
  icon: Icon,
  title,
  children,
  tint = "primary",
}: {
  icon: typeof School;
  title: string;
  children: React.ReactNode;
  tint?: keyof typeof PANEL_TINTS;
}) {
  return (
    <div className="rounded-2xl bg-card border border-border shadow-sm p-5 sm:p-6 space-y-4 max-lg:rounded-[26px] max-lg:border-border/60 max-lg:shadow-[0_2px_16px_rgba(15,23,42,0.06)]">
      <h2 className="text-sm font-bold text-foreground flex items-center gap-2.5 pb-3 border-b border-border">
        <div
          className={`icon-chip h-9 w-9 bg-primary/10 text-primary max-lg:h-10 max-lg:w-10 max-lg:rounded-2xl max-lg:bg-gradient-to-br max-lg:text-white max-lg:shadow-md max-lg:shadow-black/10 ${PANEL_TINTS[tint]}`}
        >
          <Icon className="h-4 w-4" />
        </div>
        {title}
      </h2>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function ToggleRow({
  icon: Icon, colorClass, label, description, checked, onCheckedChange,
}: { icon: LucideIcon; colorClass: string; label: string; description: string; checked: boolean; onCheckedChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-4 -mx-2 rounded-xl px-2 py-2.5 transition-colors hover:bg-muted/40 max-lg:rounded-2xl max-lg:py-3 max-lg:active:bg-muted/50">
      <div className="flex items-center gap-3 min-w-0">
        <div className={`icon-chip h-9 w-9 shrink-0 max-lg:h-10 max-lg:w-10 max-lg:rounded-2xl max-lg:shadow-sm ${colorClass}`}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}
