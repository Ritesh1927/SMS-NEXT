"use client";

import { useState, type ReactNode } from "react";
import {
  AppWindow, BellRing, CircleCheck, Download, GraduationCap, Loader2, Monitor, PanelsTopLeft, RefreshCw, WifiOff, X, Zap,
} from "lucide-react";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { APP_NAME } from "@/pwa/config";
import { IOSInstallGuide } from "./IOSInstallGuide";
import { InstalledAppBody, UnsupportedInstallBody } from "./BrowserInstallGuide";
import { CONTINUE_IN_BROWSER, INSTALL_PRIMARY_BUTTON_CLASS, InstallFooter, SECONDARY_BUTTON_CLASS } from "./InstallDialogParts";

const SUBTITLE = `Install ${APP_NAME} for faster performance, offline access, native notifications, and automatic updates.`;

/**
 * The one install dialog for every role and platform. Mounted once in the
 * root layout; opened by InstallPromptGate (auto, ~4.5 s after login) or
 * InstallButton (the permanent profile-menu entry). Content follows the
 * mode captured when it opened:
 *   prompt            -> "Download & Install" wired to the native prompt
 *   installed         -> "Open App" (launches the installed app)
 *   ios/macos-safari  -> Share / Add to Dock steps (Safari has no install API)
 *   browser-menu      -> informational: no one-click install in this browser
 */
export function InstallModal() {
  const { os, installMethod, installDialogOpen, dialogMode, dismissInstallDialog, closeInstallDialog } = useInstallPrompt();
  // "Not installed?" from the installed view swaps in the install guidance.
  const [showInstallSteps, setShowInstallSteps] = useState(false);
  const isMobile = os === "ios" || os === "android";
  const showingInstalled = dialogMode === "installed" && !showInstallSteps;

  let body: ReactNode;
  if (dialogMode === "prompt") body = <NativeInstallBody />;
  else if (showingInstalled) body = <InstalledAppBody onShowInstallSteps={() => setShowInstallSteps(true)} />;
  else if (installMethod === "ios" || installMethod === "macos-safari") body = <IOSInstallGuide variant={installMethod} />;
  else body = <UnsupportedInstallBody />;

  return (
    <Dialog
      open={installDialogOpen}
      onOpenChange={(open) => {
        if (open) return;
        // Closing an install offer = "Continue in Browser" (snoozes the
        // automatic popup for 7 days); closing the installed view needn't.
        if (dialogMode === "installed") closeInstallDialog();
        else dismissInstallDialog();
      }}
      onOpenChangeComplete={(open) => {
        if (!open) setShowInstallSteps(false);
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden p-0 shadow-[0_40px_90px_-30px_rgba(37,30,140,0.55)] ring-1 ring-white/10 sm:max-w-[480px] max-lg:pb-0"
      >
        {showingInstalled ? (
          <InstallHero
            title={`${APP_NAME} is installed`}
            subtitle="You already have the desktop app on this device. Open it for the full app experience."
            badge="Installed"
          />
        ) : (
          <InstallHero title={isMobile ? `Install the ${APP_NAME} App` : `Install ${APP_NAME} Desktop Experience`} subtitle={SUBTITLE} />
        )}
        {body}
      </DialogContent>
    </Dialog>
  );
}

/** Brand-gradient header with a glass app tile; shared by every variant. */
function InstallHero({ title, subtitle, badge }: { title: string; subtitle: string; badge?: string }) {
  return (
    <div className="relative overflow-hidden bg-gradient-to-br from-primary via-[color-mix(in_oklch,var(--primary),var(--accent)_45%)] to-accent px-6 pt-9 pb-7 text-center text-white">
      {/* Light blobs + faint grid give the glass tile something to refract. */}
      <div className="pointer-events-none absolute -top-20 -left-16 h-52 w-52 rounded-full bg-white/20 blur-3xl" />
      <div className="pointer-events-none absolute -right-14 -bottom-24 h-56 w-56 rounded-full bg-fuchsia-300/25 blur-3xl" />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.06)_1px,transparent_1px)] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)] [background-size:22px_22px]" />

      <DialogClose
        aria-label="Close"
        className="absolute top-3 right-3 flex h-8 w-8 items-center justify-center rounded-full text-white/80 transition-colors outline-none hover:bg-white/15 hover:text-white focus-visible:ring-2 focus-visible:ring-white/70"
      >
        <X className="h-4 w-4" />
      </DialogClose>

      <div className="relative mx-auto mb-5 flex h-20 w-20 animate-in items-center justify-center rounded-[26px] bg-white/15 shadow-2xl ring-1 shadow-black/20 ring-white/35 backdrop-blur-md duration-700 fill-mode-both zoom-in-50">
        <div className="flex h-[60px] w-[60px] items-center justify-center rounded-[18px] bg-white shadow-lg shadow-black/20 dark:bg-white/95">
          <GraduationCap className="h-8 w-8 text-primary" />
        </div>
        {badge && (
          <span className="absolute -right-2 -bottom-2 flex h-7 w-7 items-center justify-center rounded-full bg-success text-white shadow-md ring-[3px] ring-white/90">
            <CircleCheck className="h-4 w-4" />
            <span className="sr-only">{badge}</span>
          </span>
        )}
      </div>

      <DialogTitle className="relative font-heading text-[21px] leading-tight font-bold tracking-tight text-white">
        {title}
      </DialogTitle>
      <DialogDescription className="relative mx-auto mt-2 max-w-[340px] text-[13px] leading-relaxed text-white/85">
        {subtitle}
      </DialogDescription>
    </div>
  );
}

const BENEFITS = [
  { icon: Monitor, label: "Native Desktop Experience" },
  { icon: Zap, label: "Faster Loading" },
  { icon: WifiOff, label: "Offline Access" },
  { icon: RefreshCw, label: "Automatic Updates" },
  { icon: BellRing, label: "Push Notifications" },
  { icon: AppWindow, label: "Opens Like a Desktop Application" },
  { icon: PanelsTopLeft, label: "No Browser Tabs Required" },
];

/** Glass "chips" listing what installing gets you. */
export function BenefitGrid() {
  return (
    <ul className="grid grid-cols-1 gap-2 px-5 pt-5 pb-1 sm:grid-cols-2" aria-label="Benefits">
      {BENEFITS.map(({ icon: Icon, label }, index) => (
        <li
          key={label}
          className="flex animate-in items-center gap-2.5 rounded-xl bg-primary/[0.04] px-3 py-2.5 ring-1 ring-primary/10 duration-500 fill-mode-both fade-in-0 slide-in-from-bottom-2 sm:last:col-span-2 sm:last:justify-center dark:bg-white/[0.04] dark:ring-white/10"
          style={{ animationDelay: `${120 + index * 55}ms` }}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-accent text-white shadow-sm shadow-primary/30">
            <Icon className="h-3.5 w-3.5" />
          </span>
          <span className="text-[12.5px] leading-tight font-semibold text-foreground">{label}</span>
        </li>
      ))}
    </ul>
  );
}

function NativeInstallBody() {
  const { promptInstall, dismissInstallDialog } = useInstallPrompt();
  const [installing, setInstalling] = useState(false);

  const handleInstall = async () => {
    setInstalling(true);
    try {
      await promptInstall();
    } finally {
      setInstalling(false);
    }
  };

  return (
    <>
      <BenefitGrid />
      <InstallFooter>
        <Button variant="ghost" size="lg" className={SECONDARY_BUTTON_CLASS} onClick={dismissInstallDialog}>
          {CONTINUE_IN_BROWSER}
        </Button>
        <Button size="lg" className={INSTALL_PRIMARY_BUTTON_CLASS} onClick={handleInstall} disabled={installing} autoFocus>
          {installing ? <Loader2 className="animate-spin" /> : <Download />}
          {installing ? "Waiting for your browser…" : `Download & Install ${APP_NAME}`}
        </Button>
      </InstallFooter>
    </>
  );
}
