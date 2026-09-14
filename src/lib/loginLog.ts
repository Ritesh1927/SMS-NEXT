import { UAParser } from "ua-parser-js";
import { LoginLog, type LoginRole } from "@/models/LoginLog";
import { getClientIp } from "@/lib/rateLimit";

// Fire-and-forget login audit entry, ported from SMS-BACKEND's inline
// "LOG LOGIN" blocks in auth.controller.js. Never awaited by the caller —
// a failure here must not block or fail the actual login response.
export function logLogin(req: Request, entry: { school: string; userId: string; userName: string; email: string; role: LoginRole }) {
  try {
    const ua = new UAParser(req.headers.get("user-agent") || "").getResult();
    const ip = getClientIp(req);
    const browser = ua.browser.name ? `${ua.browser.name}${ua.browser.version ? " " + ua.browser.version : ""}` : "";
    const os = ua.os.name || "";
    const deviceType = ua.device.type === "mobile" ? "Mobile" : ua.device.type === "tablet" ? "Tablet" : "Desktop";
    const device = `${ua.device.vendor || ""} ${ua.device.model || ""}`.trim() || deviceType;

    LoginLog.create({ school: entry.school, userId: entry.userId, userName: entry.userName, email: entry.email, role: entry.role, ip, browser, os, device }).then((doc) => {
      if (!ip || ip === "127.0.0.1" || ip === "::1" || ip.startsWith("192.168.") || ip.startsWith("10.")) return;
      fetch(`http://ip-api.com/json/${ip}?fields=status,country,regionName,city`)
        .then((r) => r.json())
        .then((d) => {
          if (d.status === "success") {
            const location = [d.city, d.regionName, d.country].filter(Boolean).join(", ");
            return LoginLog.findByIdAndUpdate(doc._id, { $set: { location } });
          }
        })
        .catch(() => {});
    }).catch(() => {});
  } catch {
    // never let audit logging break a login
  }
}
