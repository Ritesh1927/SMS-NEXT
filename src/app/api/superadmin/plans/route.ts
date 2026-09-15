import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth-server";
import { Plan } from "@/models/Plan";

export async function GET(req: Request) {
  const auth = requireSuperAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    await connectDB();
    const plans = await Plan.find().sort({ createdAt: 1 });
    return NextResponse.json({ success: true, data: plans });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load plans." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const auth = requireSuperAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const { name, pricePerUser, includedUsers, features, isActive } = await req.json();
    if (!name) return NextResponse.json({ success: false, message: "Plan name is required." }, { status: 400 });

    await connectDB();
    if (await Plan.findOne({ name })) {
      return NextResponse.json({ success: false, message: "Plan name already exists." }, { status: 400 });
    }

    const plan = await Plan.create({
      name,
      pricePerUser: pricePerUser || 0,
      includedUsers: includedUsers || 2,
      features: features || [],
      isActive: isActive !== false,
    });
    return NextResponse.json({ success: true, data: plan }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to create plan." },
      { status: 500 },
    );
  }
}
