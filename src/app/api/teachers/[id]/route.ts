import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Teacher } from "@/models/Teacher";
import { Class } from "@/models/Class";

function requireSchoolAdmin(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") return null;
  return auth;
}

const ALLOWED_FIELDS = [
  "name", "phone", "subjects", "classes", "qualification", "experience", "designation", "isActive",
  "gender", "dateOfBirth", "address", "bloodGroup", "joiningDate", "salary", "employmentType",
  "staffType", "department", "permissions",
  "emergencyContact", "emergencyPhone", "emergencyRelation", "aadhaarNumber", "panNumber",
  "bankName", "accountNumber", "ifscCode", "specialization", "previousExperience",
] as const;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireSchoolAdmin(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    const { id } = await params;
    await connectDB();
    const teacher = await Teacher.findOne({ _id: id, school: auth.schoolId })
      .select("-password")
      .populate("assignedClasses", "name section");
    if (!teacher) return NextResponse.json({ success: false, message: "Teacher not found." }, { status: 404 });

    return NextResponse.json({ success: true, data: teacher });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load teacher." },
      { status: 500 },
    );
  }
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireSchoolAdmin(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    const { id } = await params;
    const body = await req.json();
    const updates: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    await connectDB();

    // Same classIds -> assignedClasses/classes resolution as create. An
    // explicit empty array clears assignments; omitting classIds entirely
    // leaves assignedClasses/classes untouched.
    if (Array.isArray(body.classIds)) {
      if (body.classIds.length === 0) {
        updates.assignedClasses = [];
        updates.classes = [];
      } else {
        const clsDocs = await Class.find({ _id: { $in: body.classIds }, school: auth.schoolId });
        updates.assignedClasses = clsDocs.map((c) => c._id);
        updates.classes = clsDocs.map((c) => `${c.name}-${c.section}`);
      }
    }

    const teacher = await Teacher.findOneAndUpdate({ _id: id, school: auth.schoolId }, updates, {
      returnDocument: "after",
    })
      .select("-password")
      .populate("assignedClasses", "name section");
    if (!teacher) return NextResponse.json({ success: false, message: "Teacher not found." }, { status: 404 });

    return NextResponse.json({ success: true, message: "Teacher updated.", data: teacher });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to update teacher." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireSchoolAdmin(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    const { id } = await params;
    await connectDB();
    const teacher = await Teacher.findOneAndDelete({ _id: id, school: auth.schoolId });
    if (!teacher) return NextResponse.json({ success: false, message: "Teacher not found." }, { status: 404 });

    return NextResponse.json({ success: true, message: "Teacher deleted." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to delete teacher." },
      { status: 500 },
    );
  }
}
