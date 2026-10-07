"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LifeBuoy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getSuperAdminToken } from "@/lib/superAdminAuth";
import { ticketFetch } from "@/lib/bugReports/client";

/** "Tickets" entry for the Super Admin dashboard header, with a live unread badge. */
export function TicketsNavButton() {
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const check = () =>
      ticketFetch<{ data: { unread: number } }>(getSuperAdminToken, "/superadmin/tickets/stats")
        .then((r) => setUnread(r.data.unread))
        .catch(() => {});
    check();
    const id = window.setInterval(() => document.visibilityState === "visible" && check(), 30_000);
    return () => window.clearInterval(id);
  }, []);

  return (
    <Button
      variant="ghost"
      className="relative gap-1.5 text-white/70 hover:bg-white/10 hover:text-white"
      onClick={() => router.push("/super-admin/tickets")}
      aria-label={unread ? `Tickets (${unread} new)` : "Tickets"}
    >
      <LifeBuoy className="h-4 w-4" />
      Tickets
      {unread > 0 && (
        <span className="rounded-full bg-destructive px-1.5 py-px text-[10px] font-bold text-white shadow-sm shadow-destructive/40">
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </Button>
  );
}
