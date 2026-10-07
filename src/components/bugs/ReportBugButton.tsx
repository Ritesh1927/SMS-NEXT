"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bug } from "lucide-react";
import { cn } from "@/lib/utils";
import { getToken as getSchoolToken } from "@/contexts/AuthContext";
import { getSuperAdminToken } from "@/lib/superAdminAuth";
import { ticketFetch } from "@/lib/bugReports/client";
import { BUG_REPORTS_CHANGED_EVENT } from "@/lib/bugReports/events";
import { REPORT_PAGE, type ReportTrack } from "./BugReportForm";

const UNREAD_POLL_MS = 60_000;

/**
 * Floating "Report a Bug" tab, pinned to the right edge of every
 * authenticated page. Collapsed it's a slim bug tab; hover/focus slides out
 * the label. It links to the Report a Bug page, passing the current page as
 * ?from= so the report records where the problem happened. The red dot
 * counts reports with replies/status updates the user hasn't opened yet.
 */
export function ReportBugButton({ track }: { track: ReportTrack }) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const getToken = track === "school" ? getSchoolToken : getSuperAdminToken;

  const refreshUnread = useCallback(() => {
    if (track !== "school" || !getToken()) return;
    ticketFetch<{ count: number }>(getToken, "/bug-reports/unread")
      .then((r) => setUnread(r.count))
      .catch(() => {});
  }, [track, getToken]);

  useEffect(() => {
    refreshUnread();
    const id = window.setInterval(() => document.visibilityState === "visible" && refreshUnread(), UNREAD_POLL_MS);
    window.addEventListener(BUG_REPORTS_CHANGED_EVENT, refreshUnread);
    return () => {
      window.clearInterval(id);
      window.removeEventListener(BUG_REPORTS_CHANGED_EVENT, refreshUnread);
    };
  }, [refreshUnread]);

  // Already on the report page: the tab would just point at itself.
  if (pathname === REPORT_PAGE[track]) return null;

  return (
    <Link
      href={`${REPORT_PAGE[track]}?from=${encodeURIComponent(pathname)}`}
      aria-label={unread ? `Report a bug (${unread} report updates)` : "Report a bug"}
      className={cn(
        "group/bug fixed top-[58%] right-0 z-40 flex -translate-y-1/2 items-center gap-0 overflow-hidden rounded-l-2xl py-2.5 pr-2 pl-2.5 text-white lg:top-1/2",
        "bg-gradient-to-b from-primary to-accent shadow-[0_10px_30px_-8px_rgba(80,72,229,0.6)] ring-1 ring-white/20",
        "transition-all duration-300 ease-out hover:gap-2 hover:pr-3.5 focus-visible:gap-2 focus-visible:pr-3.5 focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:outline-none",
        "print:hidden",
      )}
    >
      <span className="relative flex h-6 w-6 items-center justify-center">
        <Bug className="h-[18px] w-[18px] transition-transform duration-300 group-hover/bug:rotate-12" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-destructive px-1 text-[9px] font-bold ring-2 ring-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </span>
      <span className="max-w-0 overflow-hidden text-[13px] font-semibold whitespace-nowrap opacity-0 transition-all duration-300 group-hover/bug:max-w-32 group-hover/bug:opacity-100 group-focus-visible/bug:max-w-32 group-focus-visible/bug:opacity-100">
        Report a Bug
      </span>
    </Link>
  );
}
