import { createHash } from "crypto";
import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { SuperAdmin } from "@/models/SuperAdmin";
import type { TokenPayload } from "@/lib/helpers";
import { REPORTER_ROLES, type ReporterRole } from "./constants";

export interface TicketAuth extends TokenPayload {
  role: ReporterRole;
  /** Stable, non-reversible fingerprint of the login token ("session id"). */
  sessionId: string;
}

type TicketAuthResult = { auth: TicketAuth } | { error: NextResponse };

const unauthorized = () => NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

/**
 * Any signed-in user -- every school role and the Super Admin -- may report
 * bugs. Both auth tracks issue the same JWT format, so one check covers both.
 */
export function requireTicketUser(req: Request): TicketAuthResult {
  const auth = getAuthUser(req);
  if (!auth || !(REPORTER_ROLES as readonly string[]).includes(auth.role)) return { error: unauthorized() };
  const token = req.headers.get("authorization")!.slice("Bearer ".length).trim();
  return {
    auth: {
      ...auth,
      role: auth.role as ReporterRole,
      sessionId: createHash("sha256").update(token).digest("hex").slice(0, 16),
    },
  };
}

export interface SuperAdminActor {
  role: "superadmin";
  id: string;
  name: string;
  email: string;
}

/**
 * Super Admin gate for the ticket management routes, also resolving the
 * actor's display name for timeline entries. Caller must connectDB() first.
 */
export async function requireSuperAdminActor(req: Request): Promise<{ actor: SuperAdminActor } | { error: NextResponse }> {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "superadmin") return { error: unauthorized() };
  const sa = await SuperAdmin.findById(auth.id).select("name email isActive").lean();
  if (!sa || sa.isActive === false) return { error: unauthorized() };
  return { actor: { role: "superadmin", id: auth.id, name: sa.name, email: sa.email } };
}

/** Public origin of this deployment, for links in emails. */
export function appOrigin(req: Request): string {
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || (host?.startsWith("localhost") ? "http" : "https");
  return host ? `${proto}://${host}` : new URL(req.url).origin;
}
