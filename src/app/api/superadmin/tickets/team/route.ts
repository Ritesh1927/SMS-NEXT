import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { SuperAdmin } from "@/models/SuperAdmin";
import { requireSuperAdminActor } from "@/lib/bugReports/auth";

// GET /api/superadmin/tickets/team -- Super Admin team members, for the
// "Assigned to" picker and @mentions.
export async function GET(req: Request) {
  await connectDB();
  const gate = await requireSuperAdminActor(req);
  if ("error" in gate) return gate.error;
  const team = await SuperAdmin.find({ isActive: { $ne: false } }).select("name email").sort({ name: 1 }).lean();
  return NextResponse.json({
    success: true,
    data: team.map((m) => ({ id: String(m._id), name: m.name, email: m.email, isMe: String(m._id) === gate.actor.id })),
  });
}
