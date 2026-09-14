"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { GraduationCap, LogOut, Loader2 } from "lucide-react";
import { useAuth, getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";

const NAV_ITEMS_BY_ROLE: Record<string, { href: string; label: string }[]> = {
  schooladmin: [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/students", label: "Students" },
    { href: "/dashboard/teachers", label: "Teachers" },
    { href: "/dashboard/parents", label: "Parents" },
    { href: "/dashboard/classes", label: "Classes" },
    { href: "/dashboard/attendance", label: "Attendance" },
    { href: "/dashboard/exams", label: "Exams" },
    { href: "/dashboard/homework", label: "Homework" },
    { href: "/dashboard/timetable", label: "Timetable" },
    { href: "/dashboard/study-materials", label: "Study Materials" },
    { href: "/dashboard/fees", label: "Fees" },
    { href: "/dashboard/leaderboard", label: "Leaderboard" },
    { href: "/dashboard/ai", label: "AI Assistant" },
    { href: "/dashboard/notices", label: "Notices" },
    { href: "/dashboard/chat", label: "Messages" },
    { href: "/dashboard/login-activity", label: "Login Activity" },
    { href: "/dashboard/settings", label: "Settings" },
  ],
  teacher: [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/attendance", label: "Attendance" },
    { href: "/dashboard/exams", label: "Exams" },
    { href: "/dashboard/homework", label: "Homework" },
    { href: "/dashboard/timetable", label: "Timetable" },
    { href: "/dashboard/study-materials", label: "Study Materials" },
    { href: "/dashboard/fees", label: "Fees" },
    { href: "/dashboard/leaderboard", label: "Leaderboard" },
    { href: "/dashboard/ai", label: "AI Assistant" },
    { href: "/dashboard/notices", label: "Notices" },
    { href: "/dashboard/chat", label: "Messages" },
  ],
  parent: [
    { href: "/dashboard", label: "Overview" },
    { href: "/dashboard/timetable", label: "Timetable" },
    { href: "/dashboard/study-materials", label: "Study Materials" },
    { href: "/dashboard/progress", label: "Progress" },
    { href: "/dashboard/leaderboard", label: "Leaderboard" },
    { href: "/dashboard/notices", label: "Notices" },
    { href: "/dashboard/chat", label: "Messages" },
  ],
};

const UNREAD_POLL_MS = 15000;

interface UnreadResponse {
  success: boolean;
  total: number;
}

export default function DashboardLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, loading, isAuthenticated, logout } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace("/login");
  }, [loading, isAuthenticated, router]);

  useEffect(() => {
    if (!user) return;
    const token = getToken();
    if (!token) return;
    const poll = () => {
      apiGet<UnreadResponse>("/chat/unread", token)
        .then((res) => setUnread(res.total))
        .catch(() => {});
    };
    poll();
    const interval = setInterval(poll, UNREAD_POLL_MS);
    return () => clearInterval(interval);
  }, [user, pathname]);

  if (loading || !user) {
    return (
      <div className="flex flex-1 items-center justify-center bg-[#F8FAFC]">
        <Loader2 className="h-6 w-6 animate-spin text-[#2563EB]" />
      </div>
    );
  }

  const handleLogout = () => {
    logout();
    router.push("/login");
  };

  return (
    <div className="flex flex-1 flex-col bg-[#F8FAFC]">
      <header className="border-b border-[#E2E8F0] bg-white px-6">
        <div className="flex items-center justify-between py-4">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-[#2563EB] to-[#7C3AED] flex items-center justify-center">
              <GraduationCap className="h-5 w-5 text-white" />
            </div>
            <span className="text-lg font-bold text-[#172554] tracking-tight">EduNivo</span>
          </div>
          <Button variant="outline" size="sm" onClick={handleLogout} className="gap-1.5">
            <LogOut className="h-3.5 w-3.5" /> Logout
          </Button>
        </div>
        {NAV_ITEMS_BY_ROLE[user.role] && (
          <nav className="flex gap-1 -mb-px">
            {NAV_ITEMS_BY_ROLE[user.role].map((item) => {
              const active = pathname === item.href;
              const isChat = item.href === "/dashboard/chat";
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative px-3 py-2 text-sm font-medium border-b-2 transition-colors ${
                    active
                      ? "border-[#2563EB] text-[#2563EB]"
                      : "border-transparent text-[#64748B] hover:text-[#172554]"
                  }`}
                >
                  {item.label}
                  {isChat && unread > 0 && (
                    <span className="ml-1.5 inline-flex items-center justify-center text-[10px] font-bold text-white bg-red-500 rounded-full h-4 min-w-4 px-1">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </Link>
              );
            })}
          </nav>
        )}
      </header>

      <main className="flex-1 px-6 py-10">
        <div className="mx-auto max-w-5xl w-full">{children}</div>
      </main>
    </div>
  );
}
