"use client";

import { Check, PlusSquare, Share, SquareMousePointer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useInstallPrompt } from "@/hooks/useInstallPrompt";
import { CONTINUE_IN_BROWSER, INSTALL_PRIMARY_BUTTON_CLASS, InstallFooter, InstallSteps, SECONDARY_BUTTON_CLASS } from "./InstallDialogParts";

// Safari exposes no install API (no beforeinstallprompt), so on iPhone/iPad
// and macOS Safari the best we can do is walk the user through the browser's
// own menu. Same visual language as the native dialog's benefit list.
const STEPS = {
  ios: [
    { icon: Share, title: "Tap the Share button", text: "In the browser toolbar: the square with an arrow pointing up." },
    { icon: PlusSquare, title: "Select “Add to Home Screen”", text: "Scroll down the share sheet if you don't see it." },
    { icon: Check, title: "Tap “Add”", text: "EduNivo appears on your home screen, ready to open." },
  ],
  "macos-safari": [
    { icon: SquareMousePointer, title: "Open the File menu", text: "Or click the Share button in Safari's toolbar." },
    { icon: PlusSquare, title: "Choose “Add to Dock…”", text: "Available in Safari 17 and later." },
    { icon: Check, title: "Click “Add”", text: "EduNivo opens from your Dock in its own window." },
  ],
} as const;

export function IOSInstallGuide({ variant }: { variant: "ios" | "macos-safari" }) {
  const { dismissInstallDialog, confirmManualInstall } = useInstallPrompt();

  return (
    <>
      <InstallSteps steps={STEPS[variant]} />

      <InstallFooter>
        <Button variant="ghost" size="lg" className={SECONDARY_BUTTON_CLASS} onClick={dismissInstallDialog}>
          {CONTINUE_IN_BROWSER}
        </Button>
        {/* Safari can't tell us whether the app was added, so trust the
            user; this stops the automatic prompt on this browser for good. */}
        <Button size="lg" className={INSTALL_PRIMARY_BUTTON_CLASS} onClick={confirmManualInstall}>
          <Check />
          I&apos;ve added it
        </Button>
      </InstallFooter>
    </>
  );
}
