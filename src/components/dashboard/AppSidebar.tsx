"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, GraduationCap, UserRound, School, Link2, CalendarCheck,
  BookOpen, CalendarClock, ClipboardList, Library, IndianRupee, Megaphone, MessageSquare,
  BarChart3, Trophy, Brain, Activity, Settings, TrendingUp, LogOut, GraduationCap as Logo,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuBadge, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import type { AuthUser, UserRole } from "@/contexts/AuthContext";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  section: string;
  badge?: "unread";
}

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  schooladmin: [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard, section: "Overview" },

    { href: "/dashboard/students", label: "Students", icon: Users, section: "People" },
    { href: "/dashboard/teachers", label: "Teachers", icon: GraduationCap, section: "People" },
    { href: "/dashboard/parents", label: "Parents", icon: UserRound, section: "People" },
    { href: "/dashboard/classes", label: "Classes", icon: School, section: "People" },

    { href: "/dashboard/subjects", label: "Subjects", icon: Link2, section: "Academics" },
    { href: "/dashboard/attendance", label: "Attendance", icon: CalendarCheck, section: "Academics" },
    { href: "/dashboard/exams", label: "Exams", icon: ClipboardList, section: "Academics" },
    { href: "/dashboard/homework", label: "Homework", icon: BookOpen, section: "Academics" },
    { href: "/dashboard/timetable", label: "Timetable", icon: CalendarClock, section: "Academics" },
    { href: "/dashboard/study-materials", label: "Study Materials", icon: Library, section: "Academics" },

    { href: "/dashboard/fees", label: "Fees", icon: IndianRupee, section: "Finance" },

    { href: "/dashboard/notices", label: "Notices", icon: Megaphone, section: "Communication" },
    { href: "/dashboard/chat", label: "Messages", icon: MessageSquare, section: "Communication", badge: "unread" },

    { href: "/dashboard/reports", label: "Reports", icon: BarChart3, section: "Insights" },
    { href: "/dashboard/leaderboard", label: "Leaderboard", icon: Trophy, section: "Insights" },
    { href: "/dashboard/ai", label: "AI Assistant", icon: Brain, section: "Insights" },

    { href: "/dashboard/login-activity", label: "Login Activity", icon: Activity, section: "Administration" },
    { href: "/dashboard/settings", label: "Settings", icon: Settings, section: "Administration" },
  ],
  teacher: [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard, section: "Overview" },

    { href: "/dashboard/attendance", label: "Attendance", icon: CalendarCheck, section: "Academics" },
    { href: "/dashboard/exams", label: "Exams", icon: ClipboardList, section: "Academics" },
    { href: "/dashboard/homework", label: "Homework", icon: BookOpen, section: "Academics" },
    { href: "/dashboard/timetable", label: "Timetable", icon: CalendarClock, section: "Academics" },
    { href: "/dashboard/study-materials", label: "Study Materials", icon: Library, section: "Academics" },

    { href: "/dashboard/fees", label: "Fees", icon: IndianRupee, section: "Finance" },

    { href: "/dashboard/notices", label: "Notices", icon: Megaphone, section: "Communication" },
    { href: "/dashboard/chat", label: "Messages", icon: MessageSquare, section: "Communication", badge: "unread" },

    { href: "/dashboard/reports", label: "Reports", icon: BarChart3, section: "Insights" },
    { href: "/dashboard/leaderboard", label: "Leaderboard", icon: Trophy, section: "Insights" },
    { href: "/dashboard/ai", label: "AI Assistant", icon: Brain, section: "Insights" },
  ],
  parent: [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard, section: "Overview" },

    { href: "/dashboard/timetable", label: "Timetable", icon: CalendarClock, section: "Academics" },
    { href: "/dashboard/study-materials", label: "Study Materials", icon: Library, section: "Academics" },
    { href: "/dashboard/progress", label: "Progress", icon: TrendingUp, section: "Academics" },

    { href: "/dashboard/notices", label: "Notices", icon: Megaphone, section: "Communication" },
    { href: "/dashboard/chat", label: "Messages", icon: MessageSquare, section: "Communication", badge: "unread" },

    { href: "/dashboard/leaderboard", label: "Leaderboard", icon: Trophy, section: "Insights" },
  ],
  student: [],
};

function groupBySection(items: NavItem[]) {
  const groups: { section: string; items: NavItem[] }[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.section === item.section) last.items.push(item);
    else groups.push({ section: item.section, items: [item] });
  }
  return groups;
}

type SectionTheme = { icon: string; activeBg: string; activeText: string; label: string };
const SECTION_THEMES: Record<string, SectionTheme> = {
  Overview: { icon: "text-[#2563EB]/60", activeBg: "bg-[#2563EB]/10", activeText: "text-[#2563EB]", label: "text-[#2563EB]/60" },
  People: { icon: "text-blue-500/60", activeBg: "bg-blue-500/10", activeText: "text-blue-600", label: "text-blue-500/60" },
  Academics: { icon: "text-violet-500/60", activeBg: "bg-violet-500/10", activeText: "text-violet-600", label: "text-violet-500/60" },
  Finance: { icon: "text-emerald-500/60", activeBg: "bg-emerald-500/10", activeText: "text-emerald-600", label: "text-emerald-500/60" },
  Communication: { icon: "text-amber-500/60", activeBg: "bg-amber-500/10", activeText: "text-amber-600", label: "text-amber-500/60" },
  Insights: { icon: "text-fuchsia-500/60", activeBg: "bg-fuchsia-500/10", activeText: "text-fuchsia-600", label: "text-fuchsia-500/60" },
  Administration: { icon: "text-slate-500/60", activeBg: "bg-slate-500/10", activeText: "text-slate-600", label: "text-slate-500/60" },
};

const ROLE_LABEL: Record<UserRole, string> = {
  schooladmin: "School Admin",
  teacher: "Teacher",
  parent: "Parent",
  student: "Student",
};

export function AppSidebar({ user, unreadCount, onLogout }: { user: AuthUser; unreadCount: number; onLogout: () => void }) {
  const pathname = usePathname();
  const sections = groupBySection(NAV_BY_ROLE[user.role] || []);

  return (
    <Sidebar collapsible="icon" className="border-r border-[#E2E8F0]">
      <div className="flex h-16 items-center gap-3 px-4 border-b border-[#E2E8F0] overflow-hidden">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-[#2563EB] to-[#7C3AED]">
          <Logo className="h-5 w-5 text-white" />
        </div>
        <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
          <span className="text-sm font-bold text-[#172554] tracking-tight truncate">{user.schoolName || "EduNivo"}</span>
          <span className="text-[11px] text-[#64748B] truncate">{ROLE_LABEL[user.role]}</span>
        </div>
      </div>

      <SidebarContent className="px-3 py-4 flex flex-col justify-between">
        <div>
          {sections.map(({ section, items }) => {
            const theme = SECTION_THEMES[section] || SECTION_THEMES.Overview;
            return (
              <SidebarGroup key={section} className="py-1.5">
                <SidebarGroupLabel className={`text-[10px] uppercase tracking-wider font-semibold ${theme.label}`}>
                  {section}
                </SidebarGroupLabel>
                <SidebarGroupContent>
                  <SidebarMenu className="gap-1">
                    {items.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <SidebarMenuItem key={item.href}>
                          <SidebarMenuButton
                            isActive={isActive}
                            tooltip={item.label}
                            render={
                              <Link
                                href={item.href}
                                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                                  isActive ? `${theme.activeBg} ${theme.activeText} font-semibold` : "text-[#475569] hover:bg-[#F1F5F9] hover:text-[#172554]"
                                }`}
                              >
                                <item.icon className={`h-4 w-4 shrink-0 ${isActive ? theme.activeText : theme.icon}`} />
                                <span className="truncate">{item.label}</span>
                              </Link>
                            }
                          />
                          {item.badge === "unread" && unreadCount > 0 && (
                            <SidebarMenuBadge className="bg-red-500 text-white rounded-full">
                              {unreadCount > 9 ? "9+" : unreadCount}
                            </SidebarMenuBadge>
                          )}
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarGroupContent>
              </SidebarGroup>
            );
          })}
        </div>

        <div className="mt-auto pt-4 border-t border-[#E2E8F0]">
          <div className="flex items-center gap-2 px-1 py-2 mb-1 group-data-[collapsible=icon]:justify-center">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-[#2563EB]/10 text-[#2563EB] text-xs font-semibold">
                {user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="text-sm font-medium text-[#172554] truncate">{user.name}</p>
              <p className="text-xs text-[#64748B] truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-[#64748B] hover:bg-red-50 hover:text-red-600 transition-colors group-data-[collapsible=icon]:justify-center"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="group-data-[collapsible=icon]:hidden">Logout</span>
          </button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
