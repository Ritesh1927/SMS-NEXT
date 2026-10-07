import type { MetadataRoute } from "next";
import { APP_DESCRIPTION, APP_FULL_NAME, APP_NAME, APP_PROTOCOL, BACKGROUND_COLOR, THEME_COLOR } from "@/pwa/config";

// Served by Next.js at /manifest.webmanifest, and <link rel="manifest"> is
// added to every page automatically. Icons come from
// scripts/generate-pwa-icons.mjs -> public/icons/.
const ICON_SIZES = [72, 96, 128, 144, 152, 192, 256, 384, 512];

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: APP_FULL_NAME,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    // "/" already routes each user to the right place: /dashboard for any
    // signed-in school role, /super-admin for super admins, else /login.
    start_url: "/",
    scope: "/",
    // standalone = own window, no address bar / tabs / browser buttons.
    display: "standalone",
    // Desktops and tablets are used in landscape; don't lock rotation.
    orientation: "any",
    theme_color: THEME_COLOR,
    background_color: BACKGROUND_COLOR,
    lang: "en",
    dir: "ltr",
    categories: ["education", "productivity"],
    // Clicking the app icon focuses the already-open window instead of
    // spawning a second one (Chromium desktop).
    launch_handler: { client_mode: ["navigate-existing", "auto"] },
    // Lets a browser tab open the installed app via a web+edunivo:// link
    // ("Open App" in the install dialog -- see src/pwa/appLauncher.ts).
    // "/" then routes the user to their dashboard as usual.
    protocol_handlers: [{ protocol: APP_PROTOCOL, url: "/?launch=%s" }],
    // Lists the PWA itself so navigator.getInstalledRelatedApps() can tell a
    // browser tab "EduNivo is already installed" (Chromium). Resolved
    // relative to this manifest's URL. prefer_related_applications: false
    // keeps the normal install prompt.
    related_applications: [{ platform: "webapp", url: "/manifest.webmanifest" }],
    prefer_related_applications: false,
    icons: [
      ...ICON_SIZES.map((size) => ({
        src: `/icons/icon-${size}x${size}.png`,
        sizes: `${size}x${size}`,
        type: "image/png",
        purpose: "any" as const,
      })),
      { src: "/icons/maskable-192x192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    // Long-press (Android) / right-click (desktop) menu on the app icon.
    // Only routes every school role can open.
    shortcuts: [
      {
        name: "Dashboard",
        url: "/dashboard",
        icons: [{ src: "/icons/shortcut-dashboard.png", sizes: "96x96", type: "image/png" }],
      },
      {
        name: "Notices",
        url: "/dashboard/notices",
        icons: [{ src: "/icons/shortcut-notices.png", sizes: "96x96", type: "image/png" }],
      },
      {
        name: "Communication",
        url: "/dashboard/chat",
        icons: [{ src: "/icons/shortcut-chat.png", sizes: "96x96", type: "image/png" }],
      },
    ],
  };
}
