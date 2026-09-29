"use client";

import { useEffect, useState } from "react";
import {
  LayoutDashboard, Users, GraduationCap, UserRound, School, Link2, CalendarCheck,
  BookOpen, CalendarClock, ClipboardList, Library, IndianRupee, Megaphone, MessageSquare,
  BarChart3, Trophy, Brain, Activity, Settings, TrendingUp, Shield, UserCog,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { getToken, type AuthUser, type UserRole } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";

// Mirrors NAV_BY_ROLE in components/dashboard/AppSidebar.tsx -- kept as a
// separate, additive config (rather than importing from AppSidebar) so the
// approved desktop sidebar file never has to change to support the mobile
// modules drawer. If the desktop nav is ever restructured, mirror the edit
// here too.
export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  section: string;
  badge?: "unread";
  pageKey?: string;
  featureKey?: string;
}

export const NAV_BY_ROLE: Record<UserRole, NavItem[]> = {
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

export const ROLE_LABEL: Record<UserRole, string> = {
  schooladmin: "School Admin",
  teacher: "Teacher",
  parent: "Parent",
  student: "Student",
};

export interface NavSection {
  section: string;
  items: NavItem[];
}

function groupBySection(items: NavItem[]): NavSection[] {
  const groups: NavSection[] = [];
  for (const item of items) {
    const last = groups[groups.length - 1];
    if (last && last.section === item.section) last.items.push(item);
    else groups.push({ section: item.section, items: [item] });
  }
  return groups;
}

interface PermissionResponse {
  success: boolean;
  data: { pages: string[] };
}

interface LicenseResponse {
  success: boolean;
  data: { features: string[] } | null;
}

// Same permission/feature-gating rules as AppSidebar's navItems filter, run
// independently so the mobile modules drawer works without depending on the
// desktop sidebar mounting. Empty/not-yet-loaded lists mean "allow
// everything" -- same backward-compatible default as the sidebar.
export function useNavAccess(user: AuthUser): NavSection[] {
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

  const navItems = (NAV_BY_ROLE[user.role] || []).filter((item) => {
    if (item.pageKey && allowedPages && allowedPages.length > 0 && !allowedPages.includes(item.pageKey)) return false;
    if (item.featureKey && allowedFeatures && allowedFeatures.length > 0 && !allowedFeatures.includes(item.featureKey)) return false;
    return true;
  });

  return groupBySection(navItems);
}
