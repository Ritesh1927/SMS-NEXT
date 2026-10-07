"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, GraduationCap, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { SA_HOME, SA_NAV_GROUPS, isNavItemActive, type SaNavItem } from "./nav";

interface SidebarProps {
  /** Icon-only rail (desktop). Ignored in the mobile drawer. */
  collapsed: boolean;
  onToggleCollapsed?: () => void;
  variant: "desktop" | "drawer";
  unreadTickets: number;
  adminName: string;
  adminEmail: string;
  onNavigate?: () => void;
  onLogout: () => void;
}

/**
 * Super Admin navigation hub. Desktop: sticky, collapsible to an icon rail
 * (state remembered by the shell). Mobile: rendered inside a left drawer.
 * Sections are collapsible; the one holding the current page starts open.
 */
export function SuperAdminSidebar({
  collapsed: collapsedProp, onToggleCollapsed, variant, unreadTickets, adminName, adminEmail, onNavigate, onLogout,
}: SidebarProps) {
  const pathname = usePathname();
  const collapsed = variant === "desktop" && collapsedProp;
  const [closedGroups, setClosedGroups] = useState<Set<string>>(() => new Set());

  const toggleGroup = (id: string) =>
    setClosedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <nav
      aria-label="Super Admin"
      className={cn(
        "flex h-full flex-col bg-card/80 backdrop-blur-xl dark:bg-card/60",
        variant === "desktop" && "border-r border-border/70",
      )}
    >
      {/* Brand */}
      <div className={cn("flex h-16 shrink-0 items-center gap-3 border-b border-border/60", collapsed ? "justify-center px-2" : "px-5")}>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-md shadow-primary/30">
          <GraduationCap className="h-5 w-5 text-white" />
        </span>
        {!collapsed && (
          <div className="min-w-0">
            <p className="truncate font-heading text-[15px] leading-tight font-bold text-foreground">EduNivo</p>
            <p className="truncate text-[11px] font-medium text-muted-foreground">Super Admin Console</p>
          </div>
        )}
      </div>

      {/* Links */}
      <div className={cn("flex-1 space-y-1 overflow-y-auto py-4", collapsed ? "px-2" : "px-3")}>
        <NavLink item={SA_HOME} pathname={pathname} collapsed={collapsed} unreadTickets={unreadTickets} onNavigate={onNavigate} />

        {SA_NAV_GROUPS.map((group) => {
          const open = collapsed || !closedGroups.has(group.id);
          return (
            <div key={group.id} className="pt-3">
              {collapsed ? (
                <div className="mx-auto mb-2 h-px w-8 bg-border" aria-hidden />
              ) : (
                <button
                  type="button"
                  onClick={() => toggleGroup(group.id)}
                  aria-expanded={open}
                  className="group/sec mb-1 flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[10.5px] font-bold tracking-[0.08em] text-muted-foreground/80 uppercase transition-colors hover:text-foreground"
                >
                  {group.label}
                  <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", !open && "-rotate-90")} />
                </button>
              )}
              <div className="grid transition-[grid-template-rows] duration-200 ease-out" style={{ gridTemplateRows: open ? "1fr" : "0fr" }}>
                <div className="space-y-0.5 overflow-hidden">
                  {group.items.map((item) => (
                    <NavLink key={item.href} item={item} pathname={pathname} collapsed={collapsed} unreadTickets={unreadTickets} onNavigate={onNavigate} />
                  ))}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer: account + collapse */}
      <div className={cn("shrink-0 space-y-1 border-t border-border/60 py-3", collapsed ? "px-2" : "px-3")}>
        {!collapsed && (
          <div className="mb-1 flex items-center gap-2.5 rounded-xl bg-muted/50 px-3 py-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-[12px] font-bold text-white">
              {(adminName || "S").slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-semibold text-foreground">{adminName || "Super Admin"}</p>
              <p className="truncate text-[11px] text-muted-foreground">{adminEmail}</p>
            </div>
          </div>
        )}
        <SidebarButton icon={LogOut} label="Log out" collapsed={collapsed} onClick={onLogout} tone="danger" />
        {variant === "desktop" && onToggleCollapsed && (
          <SidebarButton
            icon={collapsed ? PanelLeftOpen : PanelLeftClose}
            label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            collapsed={collapsed}
            onClick={onToggleCollapsed}
            shortcut="Ctrl B"
          />
        )}
      </div>
    </nav>
  );
}

function NavLink({
  item, pathname, collapsed, unreadTickets, onNavigate,
}: {
  item: SaNavItem;
  pathname: string;
  collapsed: boolean;
  unreadTickets: number;
  onNavigate?: () => void;
}) {
  const active = isNavItemActive(item, pathname);
  const badge = item.badge === "ticketsUnread" && unreadTickets > 0 ? (unreadTickets > 99 ? "99+" : String(unreadTickets)) : null;

  const link = (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group/link relative flex items-center gap-3 rounded-xl text-[13.5px] font-medium transition-all duration-150 outline-none focus-visible:ring-2 focus-visible:ring-ring",
        collapsed ? "mx-auto h-10 w-10 justify-center" : "px-3 py-2",
        active
          ? "bg-primary/[0.09] text-primary dark:bg-primary/15"
          : "text-foreground/70 hover:bg-muted/70 hover:text-foreground",
      )}
    >
      {/* Active indicator bar */}
      {active && !collapsed && <span className="absolute top-1.5 bottom-1.5 -left-3 w-1 rounded-r-full bg-gradient-to-b from-primary to-accent" aria-hidden />}
      <item.icon className={cn("h-[18px] w-[18px] shrink-0 transition-transform duration-150 group-hover/link:scale-105", active ? "text-primary" : "text-muted-foreground group-hover/link:text-foreground")} />
      {!collapsed && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
      {badge && (
        <span
          className={cn(
            "rounded-full bg-destructive font-bold text-white",
            collapsed ? "absolute -top-0.5 -right-0.5 min-w-4 px-1 text-center text-[9px] ring-2 ring-card" : "px-1.5 py-px text-[10px]",
          )}
        >
          {badge}
        </span>
      )}
    </Link>
  );

  if (!collapsed) return link;
  return (
    <Tooltip>
      <TooltipTrigger render={link} />
      <TooltipContent side="right" sideOffset={10}>
        {item.label}
        {badge && ` · ${badge} new`}
      </TooltipContent>
    </Tooltip>
  );
}

function SidebarButton({
  icon: Icon, label, collapsed, onClick, tone, shortcut,
}: {
  icon: typeof LogOut;
  label: string;
  collapsed: boolean;
  onClick: () => void;
  tone?: "danger";
  shortcut?: string;
}) {
  const button = (
    <button
      type="button"
      onClick={onClick}
      aria-label={collapsed ? label : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl text-[13px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring",
        collapsed ? "mx-auto h-10 w-10 justify-center" : "w-full px-3 py-2",
        tone === "danger" ? "text-destructive/90 hover:bg-destructive/10 hover:text-destructive" : "text-muted-foreground hover:bg-muted/70 hover:text-foreground",
      )}
    >
      <Icon className="h-[18px] w-[18px] shrink-0" />
      {!collapsed && <span className="flex-1 text-left">{label}</span>}
      {!collapsed && shortcut && <kbd className="rounded-md border border-border bg-muted px-1.5 font-mono text-[10px] text-muted-foreground">{shortcut}</kbd>}
    </button>
  );
  if (!collapsed) return button;
  return (
    <Tooltip>
      <TooltipTrigger render={button} />
      <TooltipContent side="right" sideOffset={10}>{label}</TooltipContent>
    </Tooltip>
  );
}
