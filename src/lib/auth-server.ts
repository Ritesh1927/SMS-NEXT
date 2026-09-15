import { NextResponse } from "next/server";
import { verifyToken, type TokenPayload } from "@/lib/helpers";
import { Teacher } from "@/models/Teacher";

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
