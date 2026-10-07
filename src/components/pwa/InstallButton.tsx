"use client";

import { AppWindow, BadgeCheck, ChevronRight, MonitorDown, Smartphone } from "lucide-react";
import { ProfileMenuItem } from "@/components/dashboard/ProfileMenuItem";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";

/**
 * Permanent "Download app" entry in the user menus, so the app can be
 * installed at any time -- not only from the one-off automatic dialog.
 * Always shown in a browser tab; inside the installed app window it turns
 * into a "You're using the Desktop App" status row. What the dialog offers
 * depends on installMode: one-click install, "Open App", or guidance.
 *
 * - variant "menu":  item for the desktop user dropdown (DashboardTopBar)
 * - variant "sheet": row for the mobile profile sheet (MobileProfileSheet)
 */
export function InstallButton({ variant, onSelect }: { variant: "menu" | "sheet"; onSelect?: () => void }) {
  const { installMode, os, openInstallDialog } = useInstallPrompt();
  if (!installMode) return null;
  // Inside the installed app there's nothing to install -- just confirm it.
  if (installMode === "standalone") return <DesktopAppStatus variant={variant} />;

  const installed = installMode === "installed";
  const label = installed ? "Open App" : "Download app";
  const Icon = installed ? AppWindow : os === "ios" || os === "android" ? Smartphone : MonitorDown;
  const handleClick = () => {
    onSelect?.();
    openInstallDialog();
  };

  if (variant === "menu") {
    return (
      <ProfileMenuItem
        icon={Icon}
        title={label}
        description={installed ? "Launch EduNivo in its own window" : "Faster access, no browser bars"}
        onClick={handleClick}
      />
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex items-center gap-3 rounded-2xl border border-border/60 bg-card px-4 py-3.5 text-left shadow-sm transition-all active:scale-[0.98] active:bg-muted/60"
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-white shadow-md shadow-black/10">
        <Icon className="h-4.5 w-4.5" />
      </span>
      <span className="flex-1 text-sm font-semibold text-foreground">{label}</span>
      <ChevronRight className="h-4 w-4 text-muted-foreground" />
    </button>
  );
}

/** Non-interactive "You're using the Desktop App" row, shown in the app window. */
function DesktopAppStatus({ variant }: { variant: "menu" | "sheet" }) {
  return (
    <div
      className={
        variant === "menu"
          ? "flex items-center gap-3 rounded-xl px-2.5 py-2"
          : "flex items-center gap-3 rounded-2xl border border-success/20 bg-success/5 px-4 py-3.5"
      }
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-success/10 text-success">
        <BadgeCheck className="h-[17px] w-[17px]" />
      </span>
      <span className="min-w-0">
        <span className="block text-[13.5px] leading-tight font-semibold text-foreground">You&apos;re using the Desktop App</span>
        <span className="mt-0.5 block text-[11.5px] leading-tight text-muted-foreground">Updates install automatically</span>
      </span>
    </div>
  );
}
