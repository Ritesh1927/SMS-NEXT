"use client";

import { Suspense } from "react";
import Link from "next/link";
import { Bug, History } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { BugReportForm, MobileReportHeader } from "@/components/bugs/BugReportForm";

// Report a Bug -- full page for every school role. Opened from the floating
// tab (which passes ?from=<page the bug happened on>) or My Reported Bugs.
// One wrapper so the layout's space-y-6 doesn't put gaps between the header
// pieces; spacing inside is tighter on phones.
export default function ReportBugPage() {
  return (
    <div id="bug-report-top" className="scroll-mt-24 space-y-4 lg:space-y-6">
      <Suspense fallback={<div className="h-10 lg:hidden" />}>
        <MobileReportHeader track="school" subtitle="Tell us what went wrong" />
      </Suspense>
      <div className="hidden lg:block">
        <PageHeader
          icon={Bug}
          title="Report a Bug"
          subtitle="Tell us what went wrong. Your account and device details are attached automatically."
          accent="coral"
          actions={
            <Button variant="outline" className="rounded-xl" nativeButton={false} render={<Link href="/dashboard/my-bugs" />}>
              <History /> My reports
            </Button>
          }
        />
      </div>
      <Suspense fallback={<Skeleton className="h-[520px] w-full rounded-2xl" />}>
        <BugReportForm track="school" />
      </Suspense>
    </div>
  );
}
