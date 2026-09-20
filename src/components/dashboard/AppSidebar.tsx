"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Users, GraduationCap, UserRound, School, Link2, CalendarCheck,
  BookOpen, CalendarClock, ClipboardList, Library, IndianRupee, Megaphone, MessageSquare,
  BarChart3, Trophy, Brain, Activity, Settings, TrendingUp, LogOut, Shield, UserCog,
  GraduationCap as Logo,
} from "lucide-react";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent, SidebarGroupLabel,
  SidebarMenu, SidebarMenuButton, SidebarMenuBadge, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { getToken, type AuthUser, type UserRole } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  section: string;
  badge?: "unread";
  pageKey?: string;
  featureKey?: string;
}

const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
  schooladmin: [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard, section: "Overview", featureKey: "dashboard" },

    { href: "/dashboard/students", label: "Students", icon: Users, section: "People", featureKey: "students" },
    { href: "/dashboard/teachers", label: "Staff", icon: GraduationCap, section: "People", featureKey: "teachers" },
    { href: "/dashboard/parents", label: "Parents", icon: UserRound, section: "People" },
    { href: "/dashboard/classes", label: "Classes", icon: School, section: "People", featureKey: "classes" },

    { href: "/dashboard/subjects", label: "Subject & Class", icon: Link2, section: "Academics" },
    { href: "/dashboard/attendance", label: "Attendance", icon: CalendarCheck, section: "Academics", featureKey: "attendance" },
    { href: "/dashboard/exams", label: "Exams", icon: ClipboardList, section: "Academics", featureKey: "exams" },
    { href: "/dashboard/homework", label: "Homework", icon: BookOpen, section: "Academics", featureKey: "homework" },
    { href: "/dashboard/timetable", label: "Timetable", icon: CalendarClock, section: "Academics", featureKey: "timetable" },
    { href: "/dashboard/study-materials", label: "Study Materials", icon: Library, section: "Academics", featureKey: "materials" },

    { href: "/dashboard/fees", label: "Fees", icon: IndianRupee, section: "Finance", featureKey: "fees" },

    { href: "/dashboard/notices", label: "Notices", icon: Megaphone, section: "Communication", featureKey: "notices" },
    { href: "/dashboard/chat", label: "Communication", icon: MessageSquare, section: "Communication", badge: "unread", featureKey: "chat" },

    { href: "/dashboard/reports", label: "Reports", icon: BarChart3, section: "Insights", featureKey: "reports" },
    { href: "/dashboard/leaderboard", label: "Leaderboard", icon: Trophy, section: "Insights" },
    { href: "/dashboard/ai", label: "AI Assistant", icon: Brain, section: "Insights", featureKey: "ai" },

    { href: "/dashboard/roles-permissions", label: "Roles & Permissions", icon: Shield, section: "Administration" },
    { href: "/dashboard/user-master", label: "User Master", icon: UserCog, section: "Administration" },
    { href: "/dashboard/login-activity", label: "Login Activity", icon: Activity, section: "Administration" },
    { href: "/dashboard/settings", label: "Settings", icon: Settings, section: "Administration" },
  ],
  teacher: [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard, section: "Overview", featureKey: "dashboard" },

    { href: "/dashboard/students", label: "Students", icon: Users, section: "My Classes", pageKey: "pageStudents", featureKey: "students" },
    { href: "/dashboard/classes", label: "Classes", icon: School, section: "My Classes", pageKey: "pageClasses", featureKey: "classes" },

    { href: "/dashboard/attendance", label: "Attendance", icon: CalendarCheck, section: "Academics", pageKey: "pageAttendance", featureKey: "attendance" },
    { href: "/dashboard/exams", label: "Exams", icon: ClipboardList, section: "Academics", pageKey: "pageTestsExams", featureKey: "exams" },
    { href: "/dashboard/homework", label: "Homework", icon: BookOpen, section: "Academics", pageKey: "pageHomework", featureKey: "homework" },
    { href: "/dashboard/timetable", label: "Timetable", icon: CalendarClock, section: "Academics", pageKey: "pageTimetable", featureKey: "timetable" },
    { href: "/dashboard/study-materials", label: "Study Materials", icon: Library, section: "Academics", pageKey: "pageStudyMaterials", featureKey: "materials" },

    { href: "/dashboard/fees", label: "Fees", icon: IndianRupee, section: "Finance", pageKey: "pageFees", featureKey: "fees" },

    { href: "/dashboard/notices", label: "Notices", icon: Megaphone, section: "Communication", pageKey: "pageNotices", featureKey: "notices" },
    { href: "/dashboard/chat", label: "Communication", icon: MessageSquare, section: "Communication", badge: "unread", pageKey: "pageCommunication", featureKey: "chat" },

    { href: "/dashboard/reports", label: "Reports", icon: BarChart3, section: "Insights", pageKey: "pageReports", featureKey: "reports" },
    { href: "/dashboard/leaderboard", label: "Leaderboard", icon: Trophy, section: "Insights" },
    { href: "/dashboard/ai", label: "AI Assistant", icon: Brain, section: "Insights", pageKey: "pageAi", featureKey: "ai" },
  ],
  parent: [
    { href: "/dashboard", label: "Overview", icon: LayoutDashboard, section: "Overview", featureKey: "dashboard" },

    { href: "/dashboard/attendance", label: "Attendance", icon: CalendarCheck, section: "Academics", featureKey: "attendance" },
    { href: "/dashboard/exams", label: "Exams", icon: ClipboardList, section: "Academics", featureKey: "exams" },
    { href: "/dashboard/homework", label: "Homework", icon: BookOpen, section: "Academics", featureKey: "homework" },
    { href: "/dashboard/timetable", label: "Timetable", icon: CalendarClock, section: "Academics", featureKey: "timetable" },
    { href: "/dashboard/study-materials", label: "Study Materials", icon: Library, section: "Academics", featureKey: "materials" },
    { href: "/dashboard/progress", label: "Progress", icon: TrendingUp, section: "Academics", featureKey: "reports" },

    { href: "/dashboard/fees", label: "Fees", icon: IndianRupee, section: "Finance", featureKey: "fees" },

    { href: "/dashboard/notices", label: "Notices", icon: Megaphone, section: "Communication", featureKey: "notices" },
    { href: "/dashboard/chat", label: "Communication", icon: MessageSquare, section: "Communication", badge: "unread", featureKey: "chat" },

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
// A single consistent indigo/purple brand theme for every section, matching
// the original app's sidebar (one active-item highlight color throughout,
// not a different color per section).
const DEFAULT_THEME: SectionTheme = {
  icon: "text-primary/60",
  activeBg: "bg-accent/10 border border-accent/20",
  activeText: "text-primary",
  label: "text-muted-foreground",
};

const ROLE_LABEL: Record<UserRole, string> = {
  schooladmin: "School Admin",
  teacher: "Teacher",
  parent: "Parent",
  student: "Student",
};

interface PermissionResponse {
  success: boolean;
  data: { pages: string[] };
}

interface LicenseResponse {
  success: boolean;
  data: { features: string[] } | null;
}

export function AppSidebar({ user, unreadCount, onLogout }: { user: AuthUser; unreadCount: number; onLogout: () => void }) {
  const pathname = usePathname();
  const [allowedPages, setAllowedPages] = useState<string[] | null>(null);
  const [allowedFeatures, setAllowedFeatures] = useState<string[] | null>(null);

  useEffect(() => {
    if (user.role !== "teacher") return;
    const token = getToken();
    if (!token) return;
    apiGet<PermissionResponse>(`/permissions/${user.id}`, token)
      .then((res) => setAllowedPages(res.data.pages || []))
      .catch(() => setAllowedPages([]));
  }, [user.role, user.id]);

  useEffect(() => {
    if (user.role !== "schooladmin" && user.role !== "teacher" && user.role !== "parent") return;
    const token = getToken();
    if (!token) return;
    apiGet<LicenseResponse>("/school/license", token)
      .then((res) => setAllowedFeatures(res.data?.features || []))
      .catch(() => setAllowedFeatures([]));
  }, [user.role]);

  // Empty/not-yet-loaded pages or features list means "allow everything" —
  // matches the original app's backward-compatible default (teachers with
  // no Roles & Permissions assignment yet; schools with no plan features
  // configured, i.e. trial/free mode).
  const navItems = (NAV_BY_ROLE[user.role] || []).filter((item) => {
    if (item.pageKey && allowedPages && allowedPages.length > 0 && !allowedPages.includes(item.pageKey)) return false;
    if (item.featureKey && allowedFeatures && allowedFeatures.length > 0 && !allowedFeatures.includes(item.featureKey)) return false;
    return true;
  });
  const sections = groupBySection(navItems);

  return (
    <Sidebar collapsible="icon" className="dark border-r border-sidebar-border/70 rounded-br-[20px]">
      <div className="flex h-16 items-center gap-3 px-4 group-data-[collapsible=icon]:justify-start group-data-[collapsible=icon]:pl-5 group-data-[collapsible=icon]:pr-2 border-b border-sidebar-border/70 overflow-hidden">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent">
          <Logo className="h-5 w-5 text-white" />
        </div>
        <div className="flex flex-col min-w-0 group-data-[collapsible=icon]:hidden">
          <span className="text-sm font-bold text-foreground tracking-tight truncate">{user.schoolName || "EduNivo"}</span>
          <span className="text-[11px] text-muted-foreground truncate">{ROLE_LABEL[user.role]}</span>
        </div>
      </div>

      <SidebarContent className="px-3 py-4 flex flex-col justify-between">
        <div>
          {sections.map(({ section, items }) => {
            const theme = DEFAULT_THEME;
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
                                className={`relative flex h-11 items-center gap-3 rounded-[8px] px-3 text-sm font-medium transition-colors ${
                                  isActive ? `${theme.activeBg} ${theme.activeText} font-semibold` : "text-muted-foreground hover:bg-muted hover:text-foreground"
                                }`}
                              >
                                {isActive && (
                                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-primary" />
                                )}
                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px]">
                                  <item.icon className={`h-4 w-4 shrink-0 ${isActive ? theme.activeText : theme.icon}`} />
                                </span>
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

        <div className="mt-auto pt-4 border-t border-border">
          <div className="flex items-center gap-2 px-1 py-2 mb-1 group-data-[collapsible=icon]:justify-start group-data-[collapsible=icon]:pl-2">
            <Avatar className="h-8 w-8 shrink-0">
              <AvatarFallback className="bg-primary/10 text-primary text-xs font-semibold">
                {user.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 group-data-[collapsible=icon]:hidden">
              <p className="text-sm font-medium text-foreground truncate">{user.name}</p>
              <p className="text-xs text-muted-foreground truncate">{user.email}</p>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors group-data-[collapsible=icon]:justify-start group-data-[collapsible=icon]:pl-4"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span className="group-data-[collapsible=icon]:hidden">Logout</span>
          </button>
        </div>
      </SidebarContent>
    </Sidebar>
  );
}
