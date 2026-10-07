"use client";

import { UAParser } from "ua-parser-js";
import { attachmentKindOf, type AttachmentKind } from "./constants";

// Browser-side helpers for the ticket system: authenticated fetch (works
// with either the school token or the Super Admin token), direct uploads
// to Cloudinary with progress, and the auto-collected page/device context.

export type TokenGetter = () => string | null;

export class TicketApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

export async function ticketFetch<T>(
  getToken: TokenGetter,
  path: string,
  init: { method?: "GET" | "POST" | "PATCH" | "PUT" | "DELETE"; body?: unknown; signal?: AbortSignal } = {},
): Promise<T> {
  const token = getToken();
  if (!token) throw new TicketApiError("Your session has expired. Please sign in again.", 401);
  let res: Response;
  try {
    res = await fetch(`/api${path}`, {
      method: init.method ?? "GET",
      signal: init.signal,
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body !== undefined ? { "Content-Type": "application/json" } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") throw err;
    throw new TicketApiError("Could not reach the server. Check your connection and try again.", 0);
  }
  const json = await res.json().catch(() => ({}) as Record<string, unknown>);
  if (!res.ok || json.success === false) {
    throw new TicketApiError((json.message as string) || "Something went wrong.", res.status);
  }
  return json as T;
}

// ---- Uploads ---------------------------------------------------------------

export interface UploadedAttachment {
  publicId: string;
  kind: AttachmentKind;
  name: string;
  /** Local object URL for the preview (revoke when discarded). */
  previewUrl: string;
}

interface SignatureResponse {
  data: { kind: AttachmentKind; uploadUrl: string; fields: Record<string, string>; publicId: string; maxBytes: number };
}

/**
 * Uploads one file straight to Cloudinary using server-signed parameters.
 * XHR (not fetch) because fetch can't report upload progress.
 */
export async function uploadAttachment(
  getToken: TokenGetter,
  file: File,
  onProgress: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<UploadedAttachment> {
  const kind = attachmentKindOf(file.name);
  if (!kind) throw new TicketApiError("Only JPG, PNG, WebP images and MP4, MOV, WebM videos are supported.", 400);

  const { data: sig } = await ticketFetch<SignatureResponse>(getToken, "/bug-reports/upload-signature", {
    method: "POST",
    body: { filename: file.name, bytes: file.size },
    signal,
  });

  const form = new FormData();
  Object.entries(sig.fields).forEach(([key, value]) => form.append(key, value));
  form.append("file", file);

  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", sig.uploadUrl);
    xhr.upload.onprogress = (e) => e.lengthComputable && onProgress(e.loaded / e.total);
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return resolve();
      let message = "Upload failed. Please try again.";
      try {
        message = JSON.parse(xhr.responseText)?.error?.message || message;
      } catch {
        // keep generic message
      }
      reject(new TicketApiError(message, xhr.status));
    };
    xhr.onerror = () => reject(new TicketApiError("Upload interrupted. Check your connection and retry.", 0));
    xhr.onabort = () => reject(new DOMException("Upload cancelled", "AbortError"));
    signal?.addEventListener("abort", () => xhr.abort(), { once: true });
    xhr.send(form);
  });

  onProgress(1);
  return { publicId: sig.publicId, kind, name: file.name, previewUrl: URL.createObjectURL(file) };
}

// ---- Auto-collected context -------------------------------------------------

const SEGMENT_LABELS: Record<string, string> = {
  dashboard: "Dashboard",
  ai: "AI Assistant",
  chat: "Communication",
  "study-materials": "Study Materials",
  "user-master": "User Master",
  "login-activity": "Login Activity",
  "roles-permissions": "Roles & Permissions",
  "my-bugs": "My Reported Bugs",
  "super-admin": "Super Admin",
  new: "New",
  edit: "Edit",
};

const humanize = (segment: string) =>
  SEGMENT_LABELS[segment] ?? segment.replace(/[-_]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

/** "/dashboard/students/665f.../edit" -> module "Students", page "Students › Edit". */
export function describeRoute(pathname: string): { module: string; pageName: string } {
  const parts = pathname.split("/").filter(Boolean);
  const meaningful = parts.filter((p) => !/^[a-f\d]{24}$/i.test(p) && !/^[\w-]{20,}$/.test(p));
  const scoped = meaningful[0] === "dashboard" || meaningful[0] === "super-admin" ? meaningful.slice(1) : meaningful;
  const moduleName = scoped.length ? humanize(scoped[0]) : humanize(meaningful[0] || "dashboard");
  const pageName = scoped.length ? scoped.map(humanize).join(" › ") : "Overview";
  return { module: moduleName, pageName };
}

export interface ClientContext {
  pageUrl: string;
  module: string;
  pageName: string;
  browser: string;
  os: string;
  deviceType: string;
  screenResolution: string;
  viewport: string;
  timeZone: string;
  language: string;
  clientTime: string;
  standalone: boolean;
}

/** Same-origin path the user came from, or null if missing/unsafe. */
export function safeReturnPath(value: string | null | undefined): string | null {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.length > 500) return null;
  return value;
}

/**
 * Device + page context. `pagePath` is the page the problem happened on
 * (the report page passes the "from" page); defaults to the current page.
 */
export function collectClientContext(pagePath?: string): ClientContext {
  const ua = new UAParser(navigator.userAgent).getResult();
  const path = pagePath || `${window.location.pathname}${window.location.search}`;
  const { module, pageName } = describeRoute(path.split(/[?#]/)[0]);
  const isTouchMac = /Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1;
  const deviceType =
    ua.device.type === "mobile" ? "Mobile" : ua.device.type === "tablet" || isTouchMac ? "Tablet" : "Desktop";
  return {
    pageUrl: path,
    module,
    pageName,
    browser: [ua.browser.name, ua.browser.version?.split(".")[0]].filter(Boolean).join(" ") || "Unknown",
    os: [ua.os.name, ua.os.version].filter(Boolean).join(" ") || "Unknown",
    deviceType,
    screenResolution: `${window.screen.width}×${window.screen.height} @${window.devicePixelRatio || 1}x`,
    viewport: `${window.innerWidth}×${window.innerHeight}`,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "",
    language: navigator.language || "",
    clientTime: new Date().toString().slice(0, 60),
    standalone: window.matchMedia("(display-mode: standalone)").matches,
  };
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function formatDateTime(value: string | Date | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

export function timeAgo(value: string | Date): string {
  const seconds = Math.round((Date.now() - new Date(value).getTime()) / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 30) return `${days}d ago`;
  return formatDateTime(value).split(",")[0];
}

/** Cloudinary delivery URL with automatic quality/format (smaller videos). */
export function optimizedUrl(url: string): string {
  return url.includes("/upload/") ? url.replace("/upload/", "/upload/q_auto,f_auto/") : url;
}
