import { NextResponse } from "next/server";
import { verifyToken, type TokenPayload } from "@/lib/helpers";
import { Teacher } from "@/models/Teacher";
// Side-effect import: registers the Role model so .populate("staffRole")
// below resolves even when this route is bundled in isolation (Next.js
// serverless bundles are per-route -- an import type alone is erased and
// registers nothing at runtime, however many other routes import the real
// Role model elsewhere).
import "@/models/Role";
import type { ISectionPermission } from "@/models/Role";
import type { SectionAction } from "@/lib/roles";

// Reads the "Authorization: Bearer <token>" header on an API route request
// and returns the decoded payload, or null if missing/invalid — callers
// respond 401 themselves so each route controls its own error shape.
export function getAuthUser(req: Request): TokenPayload | null {
  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return null;
  const token = header.slice("Bearer ".length).trim();
  if (!token) return null;
  try {
    return verifyToken(token);
  } catch {
    return null;
  }
}

type SuperAdminResult = { auth: TokenPayload } | { error: NextResponse };

// Shared by every protected /api/superadmin/* route.
export function requireSuperAdmin(req: Request): SuperAdminResult {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "superadmin") {
    return { error: NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 }) };
  }
  return { auth };
}

type FeeManagerResult = { auth: TokenPayload } | { error: NextResponse };

// Shared by every /api/fees write route: schooladmin is always allowed,
// teacher only with permissions.canManageFees. Distinguishes "not logged
// in" (401) from "logged in but not permitted" (403) so callers don't have
// to collapse both into one generic "Unauthorized" — the caller must have
// already called connectDB() since this queries Teacher.
export async function requireFeeManager(req: Request): Promise<FeeManagerResult> {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return { error: NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 }) };
  }
  if (auth.role === "teacher") {
    const teacher = await Teacher.findById(auth.id).select("permissions");
    if (!teacher?.permissions?.canManageFees) {
      return {
        error: NextResponse.json(
          { success: false, message: "You don't have permission to manage fees." },
          { status: 403 },
        ),
      };
    }
  }
  return { auth };
}

/**
 * Null for anyone who isn't a non-teaching staff member (schooladmin,
 * teaching staff, parent, student, or a non-teaching staffer with no role
 * assigned yet resolves to `{}` -- still non-null, since they ARE
 * non-teaching staff, just with nothing granted). Lets a route distinguish
 * "genuine teaching staff, apply the existing class/subject-ownership
 * scoping" from "non-teaching staff, apply the Role grant instead" without
 * duplicating the Teacher+staffRole lookup in every GET route that needs
 * both branches (requireStaffSectionAccess alone only answers yes/no for
 * one action -- it can't tell a caller WHY a teaching-staff JWT was
 * rejected, so it can't drive this 3-way branch on its own). Caller must
 * have already called connectDB().
 */
export async function getNonTeachingStaffSections(auth: TokenPayload | null): Promise<Record<string, ISectionPermission> | null> {
  if (!auth || auth.role !== "teacher") return null;
  const teacher = await Teacher.findById(auth.id).select("staffType staffRole").populate<{ staffRole: { sections: Record<string, ISectionPermission> } | null }>("staffRole");
  if (!teacher || teacher.staffType !== "non-teaching") return null;
  return teacher.staffRole?.sections || {};
}

function sectionAllows(sections: Record<string, ISectionPermission> | null, sectionKey: string, action: SectionAction | { extra: string }): boolean {
  const section = sections?.[sectionKey];
  return typeof action === "string" ? section?.[action] === true : section?.extras?.[action.extra] === true;
}

type StaffSectionResult = { auth: TokenPayload } | { error: NextResponse };

/**
 * Gate for the new Role-based permission system -- non-teaching staff only.
 * Teaching staff keep using their existing `Teacher.permissions` booleans
 * (requireFeeManager above, and the inline checks in notices/homework/exams
 * routes) completely untouched; this helper never grants or denies based on
 * those. schooladmin is always allowed. Caller must have already called
 * connectDB().
 */
export async function requireStaffSectionAccess(
  req: Request,
  sectionKey: string,
  action: SectionAction | { extra: string },
): Promise<StaffSectionResult> {
  const auth = getAuthUser(req);
  const denied = () =>
    NextResponse.json({ success: false, message: "You don't have permission to do this." }, { status: 403 });
  if (!auth) return { error: NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 }) };
  if (auth.role === "schooladmin") return { auth };
  if (auth.role !== "teacher") return { error: denied() };

  const sections = await getNonTeachingStaffSections(auth);
  if (!sections) return { error: denied() };
  if (!sectionAllows(sections, sectionKey, action)) return { error: denied() };
  return { auth };
}

type FeeAccessResult = { auth: TokenPayload; isAdmin: boolean } | { error: NextResponse };

/**
 * Fee routes have THREE legitimate actors, not two: schooladmin, teaching
 * staff via the existing blanket `permissions.canManageFees` (requireFeeManager
 * above -- untouched), and non-teaching staff via the new Role system's
 * `fees` section. `action` names which grant to check for a non-teaching
 * staffer; teaching staff's `canManageFees` is still an all-or-nothing
 * blanket (that system never had finer actions), so it passes regardless of
 * which `action` is requested, same as it always has. Caller must have
 * already called connectDB().
 */
export async function requireFeeAccess(req: Request, action: SectionAction | { extra: string }): Promise<FeeAccessResult> {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return { error: NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 }) };
  }
  if (auth.role === "schooladmin") return { auth, isAdmin: true };

  const sections = await getNonTeachingStaffSections(auth);
  if (sections) {
    if (!sectionAllows(sections, "fees", action)) {
      return { error: NextResponse.json({ success: false, message: "You don't have permission to do this." }, { status: 403 }) };
    }
    return { auth, isAdmin: false };
  }

  // Not non-teaching staff -- a genuine teacher, so the old blanket flag applies.
  const teacher = await Teacher.findById(auth.id).select("permissions");
  if (!teacher?.permissions?.canManageFees) {
    return { error: NextResponse.json({ success: false, message: "You don't have permission to manage fees." }, { status: 403 }) };
  }
  return { auth, isAdmin: false };
}
