import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireStaffSectionAccess } from "@/lib/auth-server";
import { Teacher } from "@/models/Teacher";
import { Class } from "@/models/Class";
import { Role } from "@/models/Role";
import { generatePassword, hashPassword, escapeRegex } from "@/lib/helpers";
import { sendCredentialsMail } from "@/lib/mail";
import { getUserLimitStatus, userLimitMessage } from "@/lib/userLimit";

export async function GET(req: Request) {
  await connectDB();
  const gate = await requireStaffSectionAccess(req, "staff", "open");
  if ("error" in gate) return gate.error;
  const { auth } = gate;

  try {
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");

    const query: Record<string, unknown> = { school: auth.schoolId };
    if (search) {
      const rx = { $regex: escapeRegex(search), $options: "i" };
      query.$or = [{ name: rx }, { email: rx }, { teacherId: rx }];
    }

    const teachers = await Teacher.find(query)
      .select("-password")
      .populate("assignedClasses", "name section")
      .populate("staffRole", "name")
      .populate("powerRole", "name")
      .sort({ createdAt: -1 });

    // assignedClasses is which classes a teacher teaches (subjects); being
    // the CLASS teacher of one is a separate, one-directional relationship
    // that only lives on Class.classTeacher -- reverse-looked-up here so the
    // Staff list can show it without an extra per-row request.
    const classTeacherDocs = await Class.find({ school: auth.schoolId, classTeacher: { $in: teachers.map((t) => t._id) } }).select("name section classTeacher");
    const classTeacherMap = new Map(classTeacherDocs.map((c) => [String(c.classTeacher), { name: c.name, section: c.section }]));
    const data = teachers.map((t) => ({ ...t.toObject(), classTeacherOf: classTeacherMap.get(String(t._id)) || null }));

    return NextResponse.json({ success: true, count: data.length, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load teachers." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  await connectDB();
  const gate = await requireStaffSectionAccess(req, "staff", "create");
  if ("error" in gate) return gate.error;
  const { auth } = gate;

  try {
    const body = await req.json();
    const {
      name, email, phone, subjects, primarySubject, secondarySubject, classes, classIds, qualification, experience, designation,
      gender, dateOfBirth, address, bloodGroup, joiningDate, salary, employmentType,
      staffType, department, staffRole, powerRole,
      emergencyContact, emergencyPhone, emergencyRelation, aadhaarNumber, panNumber,
      bankName, accountNumber, ifscCode, specialization, previousExperience,
    } = body;

    if (!name || !email) {
      return NextResponse.json({ success: false, message: "Name and email required." }, { status: 400 });
    }
    const isTeaching = !staffType || staffType === "teaching";
    if (isTeaching && !primarySubject) {
      return NextResponse.json({ success: false, message: "Primary subject is required for teaching staff." }, { status: 400 });
    }
    if (!isTeaching && !staffRole) {
      return NextResponse.json({ success: false, message: "Role is required for non-teaching staff." }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ success: false, message: "Invalid email format." }, { status: 400 });
    }
    if (phone && !/^\d{10}$/.test(phone)) {
      return NextResponse.json({ success: false, message: "Phone must be exactly 10 digits." }, { status: 400 });
    }
    if (dateOfBirth && new Date(dateOfBirth) > new Date()) {
      return NextResponse.json({ success: false, message: "Date of birth cannot be in the future." }, { status: 400 });
    }
    if (aadhaarNumber && !/^\d{12}$/.test(aadhaarNumber)) {
      return NextResponse.json({ success: false, message: "Aadhaar must be exactly 12 digits." }, { status: 400 });
    }
    if (panNumber && !/^[A-Z]{5}\d{4}[A-Z]$/.test(String(panNumber).toUpperCase())) {
      return NextResponse.json({ success: false, message: "PAN must be in the format ABCDE1234F." }, { status: 400 });
    }
    if (emergencyPhone && !/^\d{10}$/.test(emergencyPhone)) {
      return NextResponse.json({ success: false, message: "Emergency phone must be exactly 10 digits." }, { status: 400 });
    }

    const limit = await getUserLimitStatus(auth.schoolId);
    if (limit.capped && limit.remaining < 1) {
      return NextResponse.json({ success: false, message: userLimitMessage(limit) }, { status: 403 });
    }

    if (await Teacher.findOne({ email, school: auth.schoolId })) {
      return NextResponse.json(
        { success: false, message: "Teacher email already exists in this school." },
        { status: 400 },
      );
    }

    const rawPassword = generatePassword();

    // classIds (real Class records) take priority over free-text classes —
    // resolving them here gives both the ObjectId refs (assignedClasses)
    // and consistent "<name>-<section>" labels (classes) instead of trusting
    // whatever string the admin typed.
    let assignedClasses: string[] = [];
    let classLabels: string[] = classes || [];
    if (isTeaching && Array.isArray(classIds) && classIds.length > 0) {
      const clsDocs = await Class.find({ _id: { $in: classIds }, school: auth.schoolId });
      assignedClasses = clsDocs.map((c) => String(c._id));
      classLabels = clsDocs.map((c) => `${c.name}-${c.section}`);
    }

    // staffRole only applies to non-teaching staff; powerRole only applies
    // to teaching staff -- both validated against this school rather than
    // trusted as-is.
    let resolvedStaffRole: string | null = null;
    if (!isTeaching && staffRole) {
      const roleDoc = await Role.findOne({ _id: staffRole, school: auth.schoolId });
      if (!roleDoc) return NextResponse.json({ success: false, message: "That role doesn't exist." }, { status: 400 });
      resolvedStaffRole = String(roleDoc._id);
    }
    let resolvedPowerRole: string | null = null;
    if (isTeaching && powerRole) {
      const roleDoc = await Role.findOne({ _id: powerRole, school: auth.schoolId, roleType: "teaching" });
      if (!roleDoc) return NextResponse.json({ success: false, message: "That power role doesn't exist." }, { status: 400 });
      resolvedPowerRole = String(roleDoc._id);
    }

    const teacher = await Teacher.create({
      name,
      email,
      phone: phone || "",
      staffType: isTeaching ? "teaching" : "non-teaching",
      department: department || "",
      staffRole: resolvedStaffRole,
      powerRole: resolvedPowerRole,
      subjects: isTeaching ? subjects || [] : [],
      primarySubject: isTeaching ? primarySubject || "" : "",
      secondarySubject: isTeaching ? secondarySubject || "" : "",
      classes: isTeaching ? classLabels : [],
      assignedClasses: isTeaching ? assignedClasses : [],
      qualification: qualification || "",
      experience: experience || "",
      designation: designation || (isTeaching ? "Teacher" : "Staff"),
      password: await hashPassword(rawPassword),
      school: auth.schoolId,
      isVerified: true,
      gender: gender || "male",
      dateOfBirth: dateOfBirth || null,
      address: address || "",
      bloodGroup: bloodGroup || "",
      joiningDate: joiningDate || null,
      salary: salary || 0,
      employmentType: employmentType || "full-time",
      emergencyContact: emergencyContact || "",
      emergencyPhone: emergencyPhone || "",
      emergencyRelation: emergencyRelation || "",
      aadhaarNumber: aadhaarNumber || "",
      panNumber: panNumber || "",
      bankName: bankName || "",
      accountNumber: accountNumber || "",
      ifscCode: ifscCode || "",
      specialization: specialization || "",
      previousExperience: previousExperience || "",
    });

    try {
      await sendCredentialsMail(email, { name, userId: teacher.teacherId, email, password: rawPassword });
    } catch (e) {
      console.log("Mail error:", e instanceof Error ? e.message : e);
    }

    const data = teacher.toObject() as unknown as Record<string, unknown>;
    delete data.password;

    return NextResponse.json(
      {
        success: true,
        message: `${isTeaching ? "Teacher" : "Staff"} created. Credentials sent to email.`,
        data,
        tempPassword: rawPassword,
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to create teacher." },
      { status: 500 },
    );
  }
}
