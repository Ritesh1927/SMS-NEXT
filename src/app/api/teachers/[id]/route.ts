import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireStaffSectionAccess } from "@/lib/auth-server";
import { Teacher } from "@/models/Teacher";
import { Class } from "@/models/Class";
import { Role } from "@/models/Role";

const ALLOWED_FIELDS = [
  "name", "phone", "subjects", "primarySubject", "secondarySubject", "classes", "qualification", "experience", "designation", "isActive",
  "gender", "dateOfBirth", "address", "bloodGroup", "joiningDate", "salary", "employmentType",
  "staffType", "department", "permissions",
  "emergencyContact", "emergencyPhone", "emergencyRelation", "aadhaarNumber", "panNumber",
  "bankName", "accountNumber", "ifscCode", "specialization", "previousExperience",
] as const;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  await connectDB();
  const gate = await requireStaffSectionAccess(req, "staff", "view");
  if ("error" in gate) return gate.error;
  const { auth } = gate;

  try {
    const { id } = await params;
    const teacher = await Teacher.findOne({ _id: id, school: auth.schoolId })
      .select("-password")
      .populate("assignedClasses", "name section")
      .populate("staffRole", "name")
      .populate("powerRole", "name");
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
  await connectDB();
  const gate = await requireStaffSectionAccess(req, "staff", "edit");
  if ("error" in gate) return gate.error;
  const { auth } = gate;

  try {
    const { id } = await params;
    const body = await req.json();

    // PATCH is a partial update, so every check here only fires for a field
    // actually present in the body, matching the rules POST already
    // enforces on create. email isn't in ALLOWED_FIELDS below (it's the
    // login identifier, not editable here), so it isn't checked.
    if (body.name !== undefined && !String(body.name).trim()) {
      return NextResponse.json({ success: false, message: "Name cannot be empty." }, { status: 400 });
    }
    if (body.phone && !/^\d{10}$/.test(body.phone)) {
      return NextResponse.json({ success: false, message: "Phone must be exactly 10 digits." }, { status: 400 });
    }
    if (body.dateOfBirth && new Date(body.dateOfBirth) > new Date()) {
      return NextResponse.json({ success: false, message: "Date of birth cannot be in the future." }, { status: 400 });
    }
    if (body.aadhaarNumber && !/^\d{12}$/.test(body.aadhaarNumber)) {
      return NextResponse.json({ success: false, message: "Aadhaar must be exactly 12 digits." }, { status: 400 });
    }
    if (body.panNumber && !/^[A-Z]{5}\d{4}[A-Z]$/.test(String(body.panNumber).toUpperCase())) {
      return NextResponse.json({ success: false, message: "PAN must be in the format ABCDE1234F." }, { status: 400 });
    }
    if (body.emergencyPhone && !/^\d{10}$/.test(body.emergencyPhone)) {
      return NextResponse.json({ success: false, message: "Emergency phone must be exactly 10 digits." }, { status: 400 });
    }

    const updates: Record<string, unknown> = {};
    for (const key of ALLOWED_FIELDS) {
      if (body[key] !== undefined) updates[key] = body[key];
    }

    // staffRole/powerRole: validated against this school (not just passed
    // through) so a teacher can never end up pointing at another school's
    // Role doc. Empty string/null clears it; omitting the field leaves it
    // untouched. staffRole is non-teaching staff only; powerRole is
    // teaching staff only -- the frontend only ever sends one or the other
    // based on staffType, but both are independently validated here.
    if (body.staffRole !== undefined) {
      if (!body.staffRole) {
        updates.staffRole = null;
      } else {
        const role = await Role.findOne({ _id: body.staffRole, school: auth.schoolId });
        if (!role) return NextResponse.json({ success: false, message: "That role doesn't exist." }, { status: 400 });
        updates.staffRole = role._id;
      }
    }
    if (body.powerRole !== undefined) {
      if (!body.powerRole) {
        updates.powerRole = null;
      } else {
        const role = await Role.findOne({ _id: body.powerRole, school: auth.schoolId, roleType: "teaching" });
        if (!role) return NextResponse.json({ success: false, message: "That power role doesn't exist." }, { status: 400 });
        updates.powerRole = role._id;
      }
    }

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
      .populate("assignedClasses", "name section")
      .populate("staffRole", "name")
      .populate("powerRole", "name");
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
  await connectDB();
  const gate = await requireStaffSectionAccess(req, "staff", "delete");
  if ("error" in gate) return gate.error;
  const { auth } = gate;

  try {
    const { id } = await params;
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
