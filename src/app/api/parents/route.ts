import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireStaffSectionAccess } from "@/lib/auth-server";
import { Parent } from "@/models/Parent";
import { escapeRegex } from "@/lib/helpers";
import "@/models/Student";

// GET /api/parents — school-scoped parent list. There's no dedicated
// "create parent" flow (parents are created as a side effect of student
// admission), so this route is list/manage only.
export async function GET(req: Request) {
  await connectDB();
  const gate = await requireStaffSectionAccess(req, "parents", "open");
  if ("error" in gate) return gate.error;
  const { auth } = gate;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");

    const query: Record<string, unknown> = { school: auth.schoolId };
    if (search) {
      const rx = { $regex: escapeRegex(search), $options: "i" };
      query.$or = [{ name: rx }, { email: rx }, { phone: rx }];
    }

    const parents = await Parent.find(query)
      .select("-password")
      .populate("students", "name studentId class section")
      .sort({ createdAt: -1 });

    return NextResponse.json({ success: true, count: parents.length, data: parents });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load parents." },
      { status: 500 },
    );
  }
}
