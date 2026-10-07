import {
  Archive, Bug, Crown, LayoutDashboard, LifeBuoy, School, Settings2, type LucideIcon,
} from "lucide-react";

// Super Admin navigation -- the single source for the sidebar, breadcrumbs
// and the command palette. Only modules that exist are listed: every entry
// is a real page backed by real APIs (no dead "coming soon" links).

export interface SaNavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  description: string;
  /** Exact match only (so /super-admin doesn't light up for every page). */
  exact?: boolean;
  /** Extra paths that belong to this item (e.g. ticket detail pages). */
  matches?: RegExp;
  badge?: "ticketsUnread";
}

export interface SaNavGroup {
  id: string;
  label: string;
  icon: LucideIcon;
  items: SaNavItem[];
}

export const SA_HOME: SaNavItem = {
  href: "/super-admin",
  label: "Dashboard",
  icon: LayoutDashboard,
  description: "Platform overview, KPIs and recent activity",
  exact: true,
};

export const SA_NAV_GROUPS: SaNavGroup[] = [
  {
    id: "schools",
    label: "School Management",
    icon: School,
    items: [
      { href: "/super-admin/schools", label: "Schools", icon: School, description: "Register, edit, renew and manage schools" },
      { href: "/super-admin/plans", label: "Subscription Plans", icon: Crown, description: "Pricing, free users and features per plan" },
    ],
  },
  {
    id: "support",
    label: "Support Center",
    icon: LifeBuoy,
    items: [
      {
        href: "/super-admin/tickets",
        label: "Bug Reports & Tickets",
        icon: LifeBuoy,
        description: "Reports from every school and role",
        exact: true,
        matches: /^\/super-admin\/tickets\/[a-f\d]{24}$/i,
        badge: "ticketsUnread",
      },
      { href: "/super-admin/tickets/archive", label: "Solved Archive", icon: Archive, description: "Past fixes, searchable" },
      { href: "/super-admin/report-bug", label: "Report a Bug", icon: Bug, description: "File a ticket as System Administrator" },
    ],
  },
  {
    id: "system",
    label: "System",
    icon: Settings2,
    items: [
      { href: "/super-admin/tickets/settings", label: "Ticket Settings", icon: Settings2, description: "Retention and upload limits" },
    ],
  },
];

export const SA_ALL_ITEMS: SaNavItem[] = [SA_HOME, ...SA_NAV_GROUPS.flatMap((g) => g.items)];

export function isNavItemActive(item: SaNavItem, pathname: string): boolean {
  if (item.matches?.test(pathname)) return true;
  return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export interface Crumb {
  label: string;
  href?: string;
}

/** "Super Admin › Support Center › Bug Reports & Tickets › Ticket details" */
export function breadcrumbsFor(pathname: string): Crumb[] {
  const crumbs: Crumb[] = [{ label: "Super Admin", href: SA_HOME.href }];
  if (pathname === SA_HOME.href) return [...crumbs, { label: SA_HOME.label }];

  for (const group of SA_NAV_GROUPS) {
    // Prefer the most specific (longest) matching item.
    const item = [...group.items].sort((a, b) => b.href.length - a.href.length).find((i) => isNavItemActive(i, pathname));
    if (!item) continue;
    crumbs.push({ label: group.label });
    const isDetail = pathname !== item.href;
    crumbs.push({ label: item.label, href: isDetail ? item.href : undefined });
    if (isDetail) crumbs.push({ label: "Details" });
    return crumbs;
  }
  return crumbs;
}

/** The page title for the current route (mobile header, document title). */
export function pageTitleFor(pathname: string): string {
  const crumbs = breadcrumbsFor(pathname);
  return crumbs[crumbs.length - 1]?.label ?? "Super Admin";
}
