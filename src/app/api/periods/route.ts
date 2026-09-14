import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { SchoolPeriod } from "@/models/SchoolPeriod";
import { recomputePeriodNumbers } from "@/lib/periods";

export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || !["schooladmin", "teacher", "parent"].includes(auth.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const periods = await SchoolPeriod.find({ school: auth.schoolId }).sort({ order: 1 });
    return NextResponse.json({ success: true, data: periods });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load periods." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { label, startTime, endTime, isBreak } = await req.json();
    if (!label || !startTime || !endTime) {
      return NextResponse.json({ success: false, message: "label, startTime and endTime are required." }, { status: 400 });
    }

    const last = await SchoolPeriod.findOne({ school: auth.schoolId }).sort({ order: -1 });
    const order = last ? last.order + 1 : 1;

    const period = await SchoolPeriod.create({
      school: auth.schoolId,
      label: String(label).trim(),
      startTime,
      endTime,
      isBreak: !!isBreak,
      order,
    });

    await recomputePeriodNumbers(auth.schoolId);
    const updated = await SchoolPeriod.findById(period._id);
    return NextResponse.json({ success: true, data: updated }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to add period." },
      { status: 500 },
    );
  }
}
