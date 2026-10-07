"use client";

import { Suspense } from "react";
import { Bug } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BugReportForm, MobileReportHeader } from "@/components/bugs/BugReportForm";
import { TicketsAdminShell } from "@/components/bugs/admin/TicketsAdminShell";

// Report a Bug for Super Admins (filed as "System Administrator").
export default function SuperAdminReportBugPage() {
  return (
    <TicketsAdminShell>
      <div id="bug-report-top" className="scroll-mt-28 space-y-4 lg:space-y-5">
        <Suspense fallback={<div className="h-10 lg:hidden" />}>
          <MobileReportHeader track="superadmin" subtitle="Filed as System Administrator" />
        </Suspense>
        <div className="hidden items-center gap-3 lg:flex">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-coral/10 text-coral"><Bug className="h-5 w-5" /></span>
          <div>
            <h2 className="font-heading text-lg font-bold text-foreground">Report a Bug</h2>
            <p className="text-[12.5px] text-muted-foreground">Filed as System Administrator. It appears in the ticket list like any other report.</p>
          </div>
        </div>
        <Suspense fallback={<Skeleton className="h-[520px] w-full rounded-2xl" />}>
          <BugReportForm track="superadmin" />
        </Suspense>
      </div>
    </TicketsAdminShell>
  );
}
