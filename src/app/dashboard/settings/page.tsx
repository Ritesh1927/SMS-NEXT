"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Loader2, Save, Shield } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/contexts/AuthContext";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
    academicYear: string;
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

export default function SettingsPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<SchoolProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<ProfileResponse>("/school/profile", token)
      .then((res) => setProfile(res.data))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load profile."));
  }, []);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!profile) return;
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
      <div className="flex items-center gap-2 text-sm text-[#64748B]">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading settings...
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#172554]">Settings</h1>
        <p className="text-sm text-[#64748B] mt-1">Manage your school profile and preferences.</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">
        <Section title="School Information">
          <div className="grid grid-cols-2 gap-3">
            <Field label="School Name">
              <Input value={profile.schoolName} onChange={(e) => setProfile((p) => p && { ...p, schoolName: e.target.value })} />
            </Field>
            <Field label="School Phone">
              <Input value={profile.schoolPhone} onChange={(e) => setProfile((p) => p && { ...p, schoolPhone: e.target.value })} />
            </Field>
          </div>
          <Field label="School Address">
            <Input value={profile.schoolAddress} onChange={(e) => setProfile((p) => p && { ...p, schoolAddress: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="School Email">
              <Input type="email" value={profile.schoolEmail} onChange={(e) => setProfile((p) => p && { ...p, schoolEmail: e.target.value })} />
            </Field>
            <Field label="Website">
              <Input value={profile.website} onChange={(e) => setProfile((p) => p && { ...p, website: e.target.value })} />
            </Field>
          </div>
          <Field label="Logo URL">
            <Input value={profile.logo} onChange={(e) => setProfile((p) => p && { ...p, logo: e.target.value })} placeholder="https://..." />
          </Field>
        </Section>

        <Section title="Admin Account">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Your Name">
              <Input value={profile.name} onChange={(e) => setProfile((p) => p && { ...p, name: e.target.value })} />
            </Field>
            <Field label="Your Phone">
              <Input value={profile.phone} onChange={(e) => setProfile((p) => p && { ...p, phone: e.target.value })} />
            </Field>
          </div>
        </Section>

        <Section title="Branding">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Theme Color">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={profile.themeColor}
                  onChange={(e) => setProfile((p) => p && { ...p, themeColor: e.target.value })}
                  className="h-8 w-10 rounded border border-input"
                />
                <Input value={profile.themeColor} onChange={(e) => setProfile((p) => p && { ...p, themeColor: e.target.value })} />
              </div>
            </Field>
            <Field label="Secondary Color">
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={profile.secondaryColor}
                  onChange={(e) => setProfile((p) => p && { ...p, secondaryColor: e.target.value })}
                  className="h-8 w-10 rounded border border-input"
                />
                <Input value={profile.secondaryColor} onChange={(e) => setProfile((p) => p && { ...p, secondaryColor: e.target.value })} />
              </div>
            </Field>
          </div>
        </Section>

        <Section title="Academic Settings">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Academic Year">
              <Input
                placeholder="2025-2026"
                value={profile.settings.academicYear}
                onChange={(e) => setProfile((p) => p && { ...p, settings: { ...p.settings, academicYear: e.target.value } })}
              />
            </Field>
            <Field label="Session Start Month">
              <Input
                value={profile.settings.sessionStartMonth}
                onChange={(e) => setProfile((p) => p && { ...p, settings: { ...p.settings, sessionStartMonth: e.target.value } })}
              />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Grading Scale">
              <Select
                items={[
                  { value: "percentage", label: "Percentage" },
                  { value: "gpa", label: "GPA" },
                  { value: "letter", label: "Letter" },
                ]}
                value={profile.settings.gradingScale}
                onValueChange={(v) => setProfile((p) => p && { ...p, settings: { ...p.settings, gradingScale: (v || p.settings.gradingScale) as SchoolProfile["settings"]["gradingScale"] } })}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="percentage">Percentage</SelectItem>
                  <SelectItem value="gpa">GPA</SelectItem>
                  <SelectItem value="letter">Letter</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Term Structure">
              <Select
                items={[
                  { value: "semester", label: "Semester" },
                  { value: "trimester", label: "Trimester" },
                  { value: "quarterly", label: "Quarterly" },
                ]}
                value={profile.settings.termStructure}
                onValueChange={(v) => setProfile((p) => p && { ...p, settings: { ...p.settings, termStructure: (v || p.settings.termStructure) as SchoolProfile["settings"]["termStructure"] } })}
              >
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="semester">Semester</SelectItem>
                  <SelectItem value="trimester">Trimester</SelectItem>
                  <SelectItem value="quarterly">Quarterly</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Pass Percentage">
            <Input
              type="number"
              min={0}
              max={100}
              value={profile.settings.passPercentage}
              onChange={(e) => setProfile((p) => p && { ...p, settings: { ...p.settings, passPercentage: Number(e.target.value) } })}
            />
          </Field>
        </Section>

        <Section title="Notifications">
          <div className="grid grid-cols-2 gap-2">
            {(
              [
                ["emailAlerts", "Email alerts"],
                ["smsAlerts", "SMS alerts"],
                ["attendanceAlerts", "Attendance alerts"],
                ["feeReminders", "Fee reminders"],
                ["examNotifications", "Exam notifications"],
              ] as [keyof SchoolProfile["settings"]["notifications"], string][]
            ).map(([key, label]) => (
              <label key={key} className="flex items-center gap-1.5 text-xs font-medium text-[#172554]">
                <input
                  type="checkbox"
                  checked={profile.settings.notifications[key]}
                  onChange={(e) =>
                    setProfile((p) => p && { ...p, settings: { ...p.settings, notifications: { ...p.settings.notifications, [key]: e.target.checked } } })
                  }
                />
                {label}
              </label>
            ))}
          </div>
        </Section>

        <Section title="Security">
          <div className="grid grid-cols-2 gap-3">
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
          <label className="flex items-center gap-1.5 text-xs font-medium text-[#172554]">
            <input
              type="checkbox"
              checked={profile.settings.security.twoFactorAuth}
              onChange={(e) => setProfile((p) => p && { ...p, settings: { ...p.settings, security: { ...p.settings.security, twoFactorAuth: e.target.checked } } })}
            />
            Two-factor authentication
          </label>
        </Section>

        <Section title="Late Fee Configuration">
          <label className="flex items-center gap-1.5 text-xs font-medium text-[#172554]">
            <input
              type="checkbox"
              checked={profile.settings.lateFee.enabled}
              onChange={(e) => setProfile((p) => p && { ...p, settings: { ...p.settings, lateFee: { ...p.settings.lateFee, enabled: e.target.checked } } })}
            />
            Enable late fees on overdue payments
          </label>
          {profile.settings.lateFee.enabled && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Grace Period (days)">
                <Input
                  type="number"
                  min={0}
                  value={profile.settings.lateFee.gracePeriod}
                  onChange={(e) => setProfile((p) => p && { ...p, settings: { ...p.settings, lateFee: { ...p.settings.lateFee, gracePeriod: Number(e.target.value) } } })}
                />
              </Field>
              <Field label="Late Fee Type">
                <Select
                  items={[
                    { value: "fixed", label: "Fixed Amount" },
                    { value: "percentage", label: "Percentage" },
                  ]}
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
              </Field>
            </div>
          )}
        </Section>

        <Button type="submit" className="gap-1.5 bg-[#4F46E5] hover:bg-[#4338CA]" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Settings
        </Button>
      </form>

      <form onSubmit={handleChangePassword} className="max-w-3xl mt-6">
        <Section title="Change Password">
          <Field label="Current Password">
            <Input
              type="password"
              value={oldPassword}
              onChange={(e) => setOldPassword(e.target.value)}
              placeholder="Enter current password"
              autoComplete="current-password"
            />
          </Field>
          <div className="grid grid-cols-2 gap-3">
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
          <Button type="submit" className="gap-1.5 bg-[#4F46E5] hover:bg-[#4338CA]" disabled={changingPassword}>
            {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <Shield className="h-4 w-4" />} Change Password
          </Button>
        </Section>
      </form>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-[18px] bg-white p-5 shadow-[0_0_0_1px_rgba(15,23,42,0.07)] space-y-3">
      <h2 className="text-sm font-semibold text-[#172554]">{title}</h2>
      {children}
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
