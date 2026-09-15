import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth-server";
import { Plan } from "@/models/Plan";
import { School } from "@/models/School";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireSuperAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const body = await req.json();
    await connectDB();
    const plan = await Plan.findByIdAndUpdate(id, body, { new: true, runValidators: true });
    if (!plan) return NextResponse.json({ success: false, message: "Plan not found." }, { status: 404 });
    return NextResponse.json({ success: true, data: plan });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to update plan." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireSuperAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    await connectDB();
    const plan = await Plan.findByIdAndDelete(id);
    if (!plan) return NextResponse.json({ success: false, message: "Plan not found." }, { status: 404 });
    await School.updateMany({ "license.planId": plan._id }, { $set: { "license.planId": null, "license.status": "trial" } });
    return NextResponse.json({ success: true, message: "Plan deleted." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to delete plan." },
      { status: 500 },
    );
  }
}
