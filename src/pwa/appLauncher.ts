// Opens the installed EduNivo app from a normal browser tab.
//
// Browsers have no "launch this PWA" API. What they do have is protocol
// handling: the manifest registers `web+edunivo` (app/manifest.ts ->
// protocol_handlers), and activating a `web+edunivo://` link makes Chromium
// launch the installed app (asking the user to allow it the first time).
// Chromium desktop only; elsewhere the link is simply ignored.

import { APP_PROTOCOL } from "./config";

/** How long to wait for signs that the app window took focus. */
const LAUNCH_DETECT_MS = 2000;

/**
 * Tries to open the installed app. Resolves "launched" if this window lost
 * focus right after (the app window or Chrome's "Open EduNivo?" permission
 * dialog came up), otherwise "unknown" -- the caller should then point the
 * user at the "Open in app" button or their Start menu instead.
 */
export function launchInstalledApp(): Promise<"launched" | "unknown"> {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: "launched" | "unknown") => {
      if (settled) return;
      settled = true;
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("visibilitychange", onBlur);
      window.clearTimeout(timer);
      resolve(result);
    };
    const onBlur = () => finish("launched");
    const timer = window.setTimeout(() => finish("unknown"), LAUNCH_DETECT_MS);

    window.addEventListener("blur", onBlur);
    document.addEventListener("visibilitychange", onBlur);

    // An anchor click (not location.href) so an unhandled scheme can't
    // navigate this tab away from the dashboard.
    const link = document.createElement("a");
    link.href = `${APP_PROTOCOL}://open`;
    link.rel = "noopener";
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();
    link.remove();
  });
}
