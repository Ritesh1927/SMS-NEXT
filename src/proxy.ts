import { NextResponse, type NextRequest } from "next/server";
import { verifyToken } from "@/lib/helpers";
import { connectDB } from "@/lib/db";
import { Admin } from "@/models/Admin";
import { getAcademicYearEndDate } from "@/lib/academicYearDate";

// Next 16 runs Proxy on the Node.js runtime by default (unlike the old
// Edge-only middleware.ts), which is what makes a direct Mongoose lookup
// here possible at all -- see node_modules/next/dist/docs/.../proxy.md,
// "Proxy defaults to using the Node.js runtime."
export const config = { matcher: ["/api/:path*"] };

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

// Routes that must never freeze, no matter what: auth (nobody gets locked
// out of logging in or resetting a password), the year-switch route itself
// (the one escape hatch out of a lock), super-admin routes (cross-tenant,
// not scoped to any one school's year), and routes with no existing school
// to even look up (public lead capture, log purging).
const EXEMPT_PREFIXES = ["/api/auth", "/api/superadmin", "/api/school/year-switch", "/api/leads", "/api/login-logs"];

// Freezes every other write (POST/PUT/PATCH/DELETE) for a school once its
// current educational year's last day has passed without the admin
// switching -- for every role, parents and students included, per the
// confirmed scope. Reads are never touched. The lock is entirely derived
// from Admin.settings (sessionStartMonth + academicYear), never stored, so
// running the switch (which advances academicYear) resolves it immediately
// with no separate unlock step.
export default async function proxy(req: NextRequest) {
  if (!MUTATING_METHODS.has(req.method)) return NextResponse.next();

  const path = req.nextUrl.pathname;
  if (EXEMPT_PREFIXES.some((p) => path.startsWith(p))) return NextResponse.next();

  const header = req.headers.get("authorization");
  if (!header?.startsWith("Bearer ")) return NextResponse.next();

  let schoolId: string;
  try {
    schoolId = verifyToken(header.slice("Bearer ".length).trim()).schoolId;
  } catch {
    return NextResponse.next();
  }

  try {
    await connectDB();
    const admin = await Admin.findById(schoolId).select("settings.sessionStartMonth settings.academicYear").lean();
    const academicYear = admin?.settings?.academicYear;
    const endDate = academicYear ? getAcademicYearEndDate(admin?.settings?.sessionStartMonth || "April", academicYear) : null;
    if (endDate && new Date() > endDate) {
      return NextResponse.json(
        {
          success: false,
          message: `The ${academicYear} educational year has ended. Ask your school admin to switch the educational year before making further changes.`,
        },
        { status: 423 },
      );
    }
  } catch {
    // Fail OPEN on any DB/lookup error -- this is a new safety net, not the
    // primary auth boundary; a transient hiccup here must never become a
    // new way to block every write in the app. Each route's own connectDB()
    // call will independently surface a real DB outage on its own.
  }

  return NextResponse.next();
}
