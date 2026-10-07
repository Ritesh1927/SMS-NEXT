"use client";

import { Suspense } from "react";
import { Bug } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { BugReportForm, MobileReportHeader } from "@/components/bugs/BugReportForm";
import { AdminPageHeader } from "@/components/super-admin/ui";

// Report a Bug for Super Admins (filed as "System Administrator").
export default function SuperAdminReportBugPage() {
  return (
    <div id="bug-report-top" className="scroll-mt-28 space-y-4 lg:space-y-0">
      <Suspense fallback={<div className="h-10 lg:hidden" />}>
        <MobileReportHeader track="superadmin" subtitle="Filed as System Administrator" />
      </Suspense>
      <div className="hidden lg:block">
        <AdminPageHeader
          icon={Bug}
          title="Report a Bug"
          description="Filed as System Administrator. It appears in the ticket list like any other report."
        />
      </div>
      <Suspense fallback={<Skeleton className="h-[520px] w-full rounded-2xl" />}>
        <BugReportForm track="superadmin" />
      </Suspense>
    </div>
  );
}
