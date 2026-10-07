// Browser/OS detection for the install flow. Everything here is client-only
// and must be called after mount (it reads navigator/window).

export type OS = "ios" | "android" | "windows" | "macos" | "chromeos" | "linux" | "unknown";

/**
 * How this browser lets the user install the app:
 * - "prompt":       Chromium (Chrome, Edge, Samsung Internet, Opera...) --
 *                   fires `beforeinstallprompt`, we show our own dialog.
 * - "ios":          iPhone/iPad -- no install API, manual Share > Add to Home Screen.
 * - "macos-safari": Safari 17+ on macOS -- manual File > Add to Dock.
 * - "none":         Firefox desktop, in-app webviews, old browsers.
 */
export type InstallMethod = "prompt" | "ios" | "macos-safari" | "none";

/** Browser family -- only used to word the manual install steps. */
export type Browser = "chrome" | "edge" | "samsung" | "opera" | "firefox" | "safari" | "other";

export interface PlatformInfo {
  os: OS;
  browser: Browser;
  installMethod: InstallMethod;
  isMobile: boolean;
}

// Order matters: Edge/Opera/Samsung UAs also contain "Chrome", and every
// Chromium UA contains "Safari".
function detectBrowser(ua: string): Browser {
  if (/Edg(e|A|iOS)?\//.test(ua)) return "edge";
  if (/SamsungBrowser/.test(ua)) return "samsung";
  if (/OPR\/|Opera/.test(ua)) return "opera";
  if (/Firefox|FxiOS/.test(ua)) return "firefox";
  if (/Chrome|Chromium|CriOS/.test(ua)) return "chrome";
  if (/Safari/.test(ua)) return "safari";
  return "other";
}

function detectOS(ua: string): OS {
  // iPadOS 13+ reports a desktop Mac user agent; the touch-point count is
  // the reliable tell, since no Mac has a touchscreen.
  const isIPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || isIPadOS) return "ios";
  if (/Android/.test(ua)) return "android";
  if (/CrOS/.test(ua)) return "chromeos";
  if (/Windows/.test(ua)) return "windows";
  if (/Macintosh|Mac OS X/.test(ua)) return "macos";
  if (/Linux/.test(ua)) return "linux";
  return "unknown";
}

// Social-app webviews (Instagram, Facebook, LinkedIn...) can't add to the
// home screen at all, so the manual guide would only mislead there.
function isInAppWebView(ua: string): boolean {
  return /FBAN|FBAV|Instagram|LinkedInApp|Line\/|GSA\//.test(ua);
}

function detectInstallMethod(ua: string, os: OS): InstallMethod {
  if (isInAppWebView(ua)) return "none";
  // Every iOS browser is WebKit underneath; since iOS 16.4 Safari, Chrome,
  // Edge and Firefox all offer "Add to Home Screen" from their share menu.
  if (os === "ios") return "ios";
  // Safari (not Chrome/Edge/Firefox, which also say "Safari" in their UA).
  const isSafari = /Safari/.test(ua) && !/Chrome|Chromium|CriOS|Edg|OPR|Firefox|FxiOS/.test(ua);
  if (os === "macos" && isSafari) return "macos-safari";
  if ("BeforeInstallPromptEvent" in window || "onbeforeinstallprompt" in window) return "prompt";
  return "none";
}

export function detectPlatform(): PlatformInfo {
  const ua = navigator.userAgent;
  const os = detectOS(ua);
  return {
    os,
    browser: detectBrowser(ua),
    installMethod: detectInstallMethod(ua, os),
    isMobile: os === "ios" || os === "android",
  };
}

let cachedPlatform: PlatformInfo | null = null;

/** Memoized detectPlatform() -- stable identity for useSyncExternalStore. */
export function getPlatformSnapshot(): PlatformInfo {
  cachedPlatform ??= detectPlatform();
  return cachedPlatform;
}

const STANDALONE_QUERIES = [
  "(display-mode: standalone)",
  "(display-mode: fullscreen)",
  "(display-mode: minimal-ui)",
  "(display-mode: window-controls-overlay)",
];

/** True when the page is running as the installed app, not in a browser tab. */
export function isRunningStandalone(): boolean {
  if (STANDALONE_QUERIES.some((query) => window.matchMedia(query).matches)) return true;
  // iOS Safari predates the display-mode media query for home-screen apps.
  if ((navigator as Navigator & { standalone?: boolean }).standalone === true) return true;
  // Launched from an Android Trusted Web Activity wrapper.
  return document.referrer.startsWith("android-app://");
}

/** Subscribes to display-mode changes (e.g. user picks "Open in app"). */
export function onStandaloneChange(callback: () => void): () => void {
  const lists = STANDALONE_QUERIES.map((query) => window.matchMedia(query));
  lists.forEach((list) => list.addEventListener("change", callback));
  return () => lists.forEach((list) => list.removeEventListener("change", callback));
}
