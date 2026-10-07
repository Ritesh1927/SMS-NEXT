"use client";

import { useState } from "react";
import { ChevronDown, Clock, Fingerprint, Globe, IdCard, Laptop, MapPin, Monitor, School, Smartphone, Tag, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { ROLE_LABELS } from "@/lib/bugReports/constants";
import type { ContextDTO, ReporterDTO } from "@/lib/bugReports/types";
import { InfoGrid, TicketPanel, type InfoItem } from "./InfoGrid";

/** "Teacher ID" / "Student ID" for the roles that have one, else null. */
export function reporterIdLabel(role: string): string | null {
  if (role === "teacher") return "Teacher ID";
  if (role === "student") return "Student ID";
  return null;
}

/**
 * Who raised the ticket -- deliberately minimal: role, name, school, and
 * the Teacher/Student ID for those two roles.
 */
export function ReporterCard({ reporter, title = "Raised by" }: { reporter: ReporterDTO; title?: string }) {
  const r = reporter;
  const role = ROLE_LABELS[r.role] || r.role;
  const idLabel = reporterIdLabel(r.role);
  const items: InfoItem[] = [
    { label: `${role} name`, value: r.name, icon: User },
    { label: "School", value: r.role === "superadmin" ? "EduNivo · System Administrator" : r.schoolName, icon: School },
  ];
  if (idLabel) items.push({ label: idLabel, value: r.userCode, icon: IdCard, mono: true });

  return (
    <TicketPanel
      title={title}
      icon={User}
      action={<span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">{role}</span>}
    >
      <InfoGrid items={items} columns={1} />
    </TicketPanel>
  );
}

/**
 * Technical context for debugging (Super Admin only). Collapsed by default
 * so the ticket page stays focused on the problem itself.
 */
export function SystemInfoCard({ context }: { context: ContextDTO }) {
  const [open, setOpen] = useState(false);
  const c = context;
  const items: InfoItem[] = [
    { label: "Page URL", value: c.pageUrl, icon: Globe, wide: true, mono: true },
    { label: "Module", value: c.module, icon: Laptop },
    { label: "Page", value: c.pageName, icon: Laptop },
    { label: "Browser", value: c.browser, icon: Globe },
    { label: "Operating system", value: c.os, icon: Monitor },
    { label: "Device", value: [c.deviceType, c.screenResolution].filter(Boolean).join(" · "), icon: c.deviceType === "Mobile" ? Smartphone : Laptop },
    { label: "Installed app", value: c.standalone ? "Yes" : "No", icon: Laptop },
    { label: "Time zone", value: c.timeZone, icon: Clock },
    { label: "App version", value: c.appVersion, icon: Tag, mono: true },
    { label: "IP address", value: c.ipAddress, icon: MapPin, mono: true },
    { label: "Session ID", value: c.sessionId, icon: Fingerprint, mono: true },
  ];

  return (
    <TicketPanel
      title="System information"
      icon={Monitor}
      action={
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          {open ? "Hide" : "Show"}
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </button>
      }
    >
      {open ? (
        <InfoGrid items={items} columns={1} className="animate-in fade-in-0" />
      ) : (
        <p className="text-[12.5px] text-muted-foreground">
          {[c.browser, c.os, c.deviceType].filter(Boolean).join(" · ") || "Browser and device details"}
        </p>
      )}
    </TicketPanel>
  );
}
