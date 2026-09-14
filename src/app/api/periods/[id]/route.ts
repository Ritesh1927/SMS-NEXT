import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { SchoolPeriod } from "@/models/SchoolPeriod";
import { recomputePeriodNumbers } from "@/lib/periods";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { id } = await params;
    const { label, startTime, endTime, isBreak, order } = await req.json();

    const period = await SchoolPeriod.findOne({ _id: id, school: auth.schoolId });
    if (!period) return NextResponse.json({ success: false, message: "Period not found." }, { status: 404 });

    if (label !== undefined) period.label = String(label).trim();
    if (startTime !== undefined) period.startTime = startTime;
    if (endTime !== undefined) period.endTime = endTime;
    if (isBreak !== undefined) period.isBreak = !!isBreak;
    if (order !== undefined) period.order = Number(order);

    await period.save();
    await recomputePeriodNumbers(auth.schoolId);

    const updated = await SchoolPeriod.findById(period._id);
    return NextResponse.json({ success: true, data: updated });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to update period." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { id } = await params;
    const period = await SchoolPeriod.findOne({ _id: id, school: auth.schoolId });
    if (!period) return NextResponse.json({ success: false, message: "Period not found." }, { status: 404 });

    await period.deleteOne();
    await recomputePeriodNumbers(auth.schoolId);

    return NextResponse.json({ success: true, message: "Period deleted." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to delete period." },
      { status: 500 },
    );
  }
}
