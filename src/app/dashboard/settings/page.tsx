"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, Save, Shield, School, SlidersHorizontal, Bell, DollarSign, Upload } from "lucide-react";
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
import { PageHeader } from "@/components/PageHeader";

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

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<ProfileResponse>("/school/profile", token)
      .then((res) => setProfile(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load profile."));
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

  const handleChangePassword = async (e: FormEvent) => {
    e.preventDefault();
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
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading settings...
      </div>
    );
  }

  const sessionRange = getSessionRange(profile.settings.sessionStartMonth);

  return (
    <div>
      <PageHeader
        icon={SlidersHorizontal}
        title="Settings"
        subtitle="Manage your school configuration and preferences."
        accent="slate"
        actions={
          <Button form="settings-form" type="submit" className="gap-1.5" disabled={saving}>
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
          </TabsList>

          <TabsContent value="school" className="mt-4">
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
                <div className="flex items-center gap-4">
                  {profile.logo && (
                    // eslint-disable-next-line @next/next/no-img-element -- data-URI/arbitrary remote logo, not an optimizable static asset.
                    <img src={profile.logo} alt="Logo" className="h-16 w-16 rounded-lg object-cover border border-border" />
                  )}
                  <button
                    type="button"
                    onClick={() => logoInputRef.current?.click()}
                    className="flex items-center gap-2 px-4 py-2 border border-dashed border-border rounded-lg hover:bg-muted/50 transition-colors text-sm text-muted-foreground"
                  >
                    <Upload className="h-4 w-4" /> {profile.logo ? "Change Logo" : "Upload Logo"}
                  </button>
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
            <Panel icon={SlidersHorizontal} title="Academic Settings">
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
            <Panel icon={Bell} title="Notification Preferences">
              {(
                [
                  ["emailAlerts", "Email Alerts", "Receive notifications via email"],
                  ["smsAlerts", "SMS Alerts", "Receive notifications via SMS"],
                  ["attendanceAlerts", "Attendance Alerts", "Get notified when attendance is below threshold"],
                  ["feeReminders", "Fee Reminders", "Send automatic fee payment reminders"],
                  ["examNotifications", "Exam Notifications", "Notify students and parents about upcoming exams"],
                ] as [keyof SchoolProfile["settings"]["notifications"], string, string][]
              ).map(([key, label, desc]) => (
                <div key={key} className="flex items-center justify-between py-2.5 border-b border-border last:border-0">
                  <div>
                    <p className="text-sm font-medium text-foreground">{label}</p>
                    <p className="text-xs text-muted-foreground">{desc}</p>
                  </div>
                  <Switch
                    checked={profile.settings.notifications[key]}
                    onCheckedChange={(v) => setProfile((p) => p && { ...p, settings: { ...p.settings, notifications: { ...p.settings.notifications, [key]: v } } })}
                  />
                </div>
              ))}
            </Panel>
          </TabsContent>

          <TabsContent value="security" className="mt-4 space-y-4">
            <Panel icon={Shield} title="Security">
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
              <div className="flex items-center justify-between py-3 border-t border-border">
                <div>
                  <p className="text-sm font-medium text-foreground">Two-Factor Authentication</p>
                  <p className="text-xs text-muted-foreground">Add an extra layer of security</p>
                </div>
                <Switch
                  checked={profile.settings.security.twoFactorAuth}
                  onCheckedChange={(v) => setProfile((p) => p && { ...p, settings: { ...p.settings, security: { ...p.settings.security, twoFactorAuth: v } } })}
                />
              </div>
            </Panel>

            <form onSubmit={handleChangePassword}>
              <Panel icon={Shield} title="Change Password">
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
                    />
                  </Field>
                </div>
                <Button type="submit" className="gap-1.5 bg-primary hover:bg-primary/90" disabled={changingPassword}>
                  {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />} Change Password
                </Button>
              </Panel>
            </form>
          </TabsContent>

          <TabsContent value="fees" className="mt-4">
            <Panel icon={DollarSign} title="Late Fee Configuration">
              <div className="flex items-center justify-between py-3 border-b border-border">
                <div>
                  <p className="text-sm font-medium text-foreground">Enable Late Fees</p>
                  <p className="text-xs text-muted-foreground">Automatically apply late fees on overdue payments</p>
                </div>
                <Switch
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
        </Tabs>
      </form>
    </div>
  );
}

function Panel({ icon: Icon, title, children }: { icon: typeof School; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl bg-card border border-border shadow-sm p-5 sm:p-6 space-y-4">
      <h2 className="text-sm font-bold text-foreground flex items-center gap-2.5 pb-3 border-b border-border">
        <div className="icon-chip h-9 w-9 bg-primary/10 text-primary">
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
