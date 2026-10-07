"use client";

import { useState } from "react";
import {
  AppWindow, Check, Compass, Download, EllipsisVertical, ExternalLink, Info, LayoutGrid, Loader2, Menu, MonitorDown, MousePointerClick, PlusSquare,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { launchInstalledApp } from "@/pwa/appLauncher";
import type { Browser, OS } from "@/pwa/platformDetection";
import {
  CONTINUE_IN_BROWSER, INSTALL_PRIMARY_BUTTON_CLASS, InstallFooter, InstallSteps, SECONDARY_BUTTON_CLASS, type InstallStep,
} from "./InstallDialogParts";

// The two dialog states without a one-click install:
// - installed:   the app is on this device but this is a browser tab ->
//                "Open App" launches it via the web+edunivo:// handler.
// - unsupported: this browser didn't offer an install (Firefox, or a
//                Chromium tab that isn't eligible yet) -> informational.

const isDesktop = (os: OS) => os === "windows" || os === "macos" || os === "linux" || os === "chromeos";
const isChromium = (browser: Browser) => browser === "chrome" || browser === "edge" || browser === "opera" || browser === "samsung";

function launcherHint(os: OS): string {
  switch (os) {
    case "windows": return "Start menu, Windows Search, taskbar or desktop shortcut.";
    case "macos": return "Dock, Launchpad or Applications › Chrome Apps.";
    case "chromeos": return "Your launcher (the circle in the bottom-left corner).";
    case "android": return "Your home screen or app drawer.";
    case "ios": return "Your home screen. It keeps its own sign-in, separate from the browser.";
    default: return "Your app launcher or desktop.";
  }
}

export function InstalledAppBody({ onShowInstallSteps }: { onShowInstallSteps: () => void }) {
  const { os, browser, closeInstallDialog } = useInstallPrompt();
  const [launch, setLaunch] = useState<"idle" | "opening" | "failed">("idle");
  // web+edunivo:// launching is a Chromium desktop feature.
  const canLaunch = isDesktop(os) && isChromium(browser);

  const handleOpen = async () => {
    setLaunch("opening");
    const result = await launchInstalledApp();
    if (result === "launched") closeInstallDialog();
    else setLaunch("failed");
  };

  const steps: InstallStep[] = [
    ...(isDesktop(os) && isChromium(browser)
      ? [{ icon: MousePointerClick, title: "Or click “Open in app”", text: "At the right end of the address bar while you're on EduNivo." }]
      : []),
    { icon: os === "android" || os === "ios" ? AppWindow : LayoutGrid, title: "Or open it like any app", text: launcherHint(os) },
  ];

  return (
    <>
      <div className="px-5 pt-5">
        {launch === "failed" ? (
          <div role="status" className="flex gap-2.5 rounded-xl bg-warning/10 px-3.5 py-3 text-[12.5px] leading-snug text-foreground ring-1 ring-warning/25">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <span>
              Your browser didn&apos;t open the app automatically. This can happen the first time, before the app has
              picked up the latest update. Use one of the options below instead.
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2.5 rounded-xl bg-success/10 px-3.5 py-3 text-[12.5px] font-medium text-foreground ring-1 ring-success/20">
            <Check className="h-4 w-4 shrink-0 text-success" />
            EduNivo is installed on this device.
          </div>
        )}
      </div>
      <InstallSteps steps={steps} />

      <InstallFooter>
        <Button variant="ghost" size="lg" className={SECONDARY_BUTTON_CLASS} onClick={closeInstallDialog}>
          {CONTINUE_IN_BROWSER}
        </Button>
        {canLaunch && (
          <Button size="lg" className={INSTALL_PRIMARY_BUTTON_CLASS} onClick={handleOpen} disabled={launch === "opening"} autoFocus>
            {launch === "opening" ? <Loader2 className="animate-spin" /> : <ExternalLink />}
            {launch === "opening" ? "Opening…" : "Open App"}
          </Button>
        )}
      </InstallFooter>
      {/* Our "installed" record can go stale after an uninstall, which no
          browser reports -- always leave a way back to install. */}
      <p className="-mt-2 pb-4 text-center text-[11.5px] text-muted-foreground">
        Not installed anymore?{" "}
        <button type="button" onClick={onShowInstallSteps} className="font-semibold text-primary underline-offset-2 hover:underline">
          See how to install
        </button>
      </p>
    </>
  );
}

function browserMenuSteps(os: OS, browser: Browser): InstallStep[] {
  if (os === "android") {
    if (browser === "samsung") {
      return [
        { icon: Menu, title: "Tap the menu (☰)", text: "Bottom-right of Samsung Internet." },
        { icon: PlusSquare, title: "Tap “Add page to” › “Home screen”" },
      ];
    }
    return [
      { icon: EllipsisVertical, title: "Tap the menu (⋮)", text: "Top-right of the browser." },
      { icon: PlusSquare, title: "Tap “Install app” or “Add to Home screen”" },
    ];
  }
  if (browser === "edge") {
    return [
      { icon: EllipsisVertical, title: "Open the menu (…)", text: "Top-right of Microsoft Edge." },
      { icon: LayoutGrid, title: "Choose “Apps” › “Install this site as an app”" },
    ];
  }
  return [
    { icon: MonitorDown, title: "Click the install icon in the address bar", text: "Or open the menu (⋮) in the top-right." },
    { icon: Download, title: "Choose “Cast, save and share” › “Install page as app…”" },
  ];
}

/**
 * No one-click install here. Per the install policy, the install button is
 * hidden and we explain why, with what the user can do about it.
 */
export function UnsupportedInstallBody() {
  const { os, browser, dismissInstallDialog } = useInstallPrompt();
  const chromium = isChromium(browser);

  return (
    <>
      <div className="px-5 pt-5">
        <div role="note" className="flex gap-2.5 rounded-xl bg-info/10 px-3.5 py-3 text-[12.5px] leading-snug text-foreground ring-1 ring-info/20">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-info" />
          {chromium ? (
            <span>
              One-click install isn&apos;t available in this tab right now. If EduNivo is already installed, click{" "}
              <span className="font-semibold">“Open in app”</span> in the address bar. Otherwise you can install it from
              your browser&apos;s menu:
            </span>
          ) : (
            <span>
              Your browser doesn&apos;t support installing apps. Open EduNivo in{" "}
              <span className="font-semibold">Google Chrome, Microsoft Edge or Brave</span> to install the desktop
              experience. You can keep using EduNivo here in the meantime.
            </span>
          )}
        </div>
      </div>
      {chromium ? (
        <InstallSteps steps={browserMenuSteps(os, browser)} />
      ) : (
        <InstallSteps steps={[{ icon: Compass, title: "Open this page in Chrome, Edge or Brave", text: window.location.host }]} />
      )}
      <InstallFooter>
        <Button size="lg" className={INSTALL_PRIMARY_BUTTON_CLASS} onClick={dismissInstallDialog} autoFocus>
          <AppWindow />
          {CONTINUE_IN_BROWSER}
        </Button>
      </InstallFooter>
    </>
  );
}
