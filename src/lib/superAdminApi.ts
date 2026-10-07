"use client";

import { getSuperAdminToken } from "@/lib/superAdminAuth";

// Shared client helpers + record types for the Super Admin panel. The
// requests are exactly the ones the pages made before the redesign (same
// endpoints, methods, headers and bodies); this only removes the copy each
// page carried of authHeaders/parseJson and the record interfaces.

export interface PlanRecord {
  _id: string;
  name: string;
  pricePerUser: number;
  includedUsers: number;
  features: string[];
  isActive: boolean;
}

export interface SchoolRecord {
  _id: string;
  name: string;
  code: string;
  address: string;
  phone: string;
  email: string;
  adminName: string;
  adminEmail: string;
  adminPhone: string;
  isActive: boolean;
  isVerified: boolean;
  allowAttendanceEdit?: boolean;
  license: {
    planName: string;
    includedUsers: number;
    extraUsers: number;
    totalUsers: number;
    pricePerUser: number;
    months: number;
    totalAmount: number;
    startDate: string | null;
    endDate: string | null;
    status: string;
  };
  userCounts: { admin: number; teachers: number; students: number; parents: number; usersUsed: number; usersTotal: number };
  createdAt: string;
}

export interface PlatformStats {
  totalSchools: number;
  activeSchools: number;
  totalTeachers: number;
  totalStudents: number;
  totalParents: number;
}

export function authHeaders(token: string, json = false): HeadersInit {
  return json ? { "Content-Type": "application/json", Authorization: `Bearer ${token}` } : { Authorization: `Bearer ${token}` };
}

export async function parseJson(res: Response) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) throw new Error(json.message || "Something went wrong.");
  return json;
}

/** Authenticated request to a Super Admin API route; throws on HTTP/API errors. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- route payloads vary; callers type the fields they read
export async function saRequest<T = any>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const token = getSuperAdminToken();
  if (!token) throw new Error("Your session has expired. Please sign in again.");
  const res = await fetch(`/api${path}`, {
    method: init.method ?? "GET",
    headers: authHeaders(token, init.body !== undefined),
    body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
  });
  return parseJson(res);
}

// ---- License helpers (display only) ----------------------------------------

export type LicenseHealth = "active" | "expiring" | "expired" | "trial" | "suspended" | "none";

/** How a school's license looks right now, for badges and the dashboard. */
export function licenseHealth(school: SchoolRecord, now = Date.now()): LicenseHealth {
  const l = school.license;
  if (!l) return "none";
  if (l.status === "suspended") return "suspended";
  if (!l.endDate) return l.status === "trial" ? "trial" : "none";
  const end = new Date(l.endDate).getTime();
  if (end < now || l.status === "expired") return "expired";
  if (end - now <= 30 * 24 * 60 * 60 * 1000) return "expiring";
  return l.status === "trial" ? "trial" : "active";
}

export function daysUntil(date: string | null, now = Date.now()): number | null {
  if (!date) return null;
  return Math.ceil((new Date(date).getTime() - now) / 86_400_000);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export function formatINR(amount: number): string {
  return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(amount || 0);
}

// ---- Cross-page actions -----------------------------------------------------

/**
 * One-shot hand-off from the header/command palette to a page, e.g. "open
 * the Register School dialog" or "pre-fill this search" after navigating.
 * The target page consumes it once on mount.
 */
type PendingAction = { type: "register-school"; planId?: string } | { type: "create-plan" } | { type: "search-schools"; query: string };
let pending: PendingAction | null = null;

export function setPendingAction(action: PendingAction) {
  pending = action;
}

export function takePendingAction<T extends PendingAction["type"]>(type: T): Extract<PendingAction, { type: T }> | null {
  if (pending?.type !== type) return null;
  const action = pending as Extract<PendingAction, { type: T }>;
  pending = null;
  return action;
}

/** Fired after a Super Admin page action so open views can refresh. */
export const SA_PENDING_ACTION_EVENT = "edunivo:sa-pending-action";
