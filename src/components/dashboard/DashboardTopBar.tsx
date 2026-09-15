"use client";

import { AlertTriangle } from "lucide-react";
import { SidebarTrigger } from "@/components/ui/sidebar";

interface LicenseWarning {
  daysLeft: number;
  endDate: string;
}

export function DashboardTopBar({ licenseWarning }: { licenseWarning: LicenseWarning | null }) {
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-4 border-b border-[#E2E8F0] bg-white/80 backdrop-blur px-4 sm:px-6">
      <SidebarTrigger className="text-[#475569] hover:text-[#2563EB] hover:bg-[#F1F5F9] rounded-lg" />

      {licenseWarning && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 shrink-0 max-w-md ml-auto">
          <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-amber-800 leading-tight">
              License expires in {licenseWarning.daysLeft} day{licenseWarning.daysLeft !== 1 ? "s" : ""} ({licenseWarning.endDate})
            </p>
            <p className="text-[10px] text-amber-600 leading-tight mt-0.5">Contact administrator to renew and avoid disruption.</p>
          </div>
        </div>
      )}
    </header>
  );
}
