import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireFeeAccess } from "@/lib/auth-server";
import { Concession } from "@/models/Concession";
import "@/models/Student";
import "@/models/FeeStructure";

const populateConcession = (q: ReturnType<typeof Concession.find>) =>
  q.populate("student", "name studentId class section rollNumber").populate("feeStructure", "title class amount");

export async function GET(req: Request) {
  await connectDB();
  const result = await requireFeeAccess(req, { extra: "manageFeeStructure" });
  if ("error" in result) return result.error;
  const { auth } = result;

  try {
    const data = await populateConcession(Concession.find({ school: auth.schoolId }).sort({ createdAt: -1 }));
    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load concessions." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  await connectDB();
  const result = await requireFeeAccess(req, { extra: "manageFeeStructure" });
  if ("error" in result) return result.error;
  const { auth } = result;

  try {
    const { student, feeStructure, type, value, isPct, description, duration, validUntil } = await req.json();
    if (!student || value === undefined) {
      return NextResponse.json({ success: false, message: "student and value are required." }, { status: 400 });
    }
    if (duration === "until-date" && !validUntil) {
      return NextResponse.json({ success: false, message: "validUntil is required for until-date duration." }, { status: 400 });
    }
    if (isPct !== false && Number(value) > 100) {
      return NextResponse.json({ success: false, message: "Percent discount cannot exceed 100." }, { status: 400 });
    }

    const con = await Concession.create({
      school: auth.schoolId,
      student,
      feeStructure: feeStructure || null,
      type: type || "Custom",
      value,
      isPct: isPct !== false,
      description: description || "",
      duration: duration || "recurring",
      validUntil: duration === "until-date" ? validUntil : null,
    });

    const populated = await populateConcession(Concession.find({ _id: con._id }));
    return NextResponse.json({ success: true, message: "Concession added.", data: populated[0] }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to create concession." },
      { status: 500 },
    );
  }
}
