import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Teacher } from "@/models/Teacher";
import { generatePassword, hashPassword, escapeRegex } from "@/lib/helpers";
import { sendCredentialsMail } from "@/lib/mail";

function requireSchoolAdmin(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") return null;
  return auth;
}

export async function GET(req: Request) {
  const auth = requireSchoolAdmin(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");

    const query: Record<string, unknown> = { school: auth.schoolId };
    if (search) {
      const rx = { $regex: escapeRegex(search), $options: "i" };
      query.$or = [{ name: rx }, { email: rx }, { teacherId: rx }];
    }

    const teachers = await Teacher.find(query).select("-password").sort({ createdAt: -1 });
    return NextResponse.json({ success: true, count: teachers.length, data: teachers });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load teachers." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const auth = requireSchoolAdmin(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    const body = await req.json();
    const {
      name, email, phone, subjects, classes, qualification, experience, designation,
      gender, dateOfBirth, address, bloodGroup, joiningDate, salary, employmentType,
      staffType, department,
    } = body;

    if (!name || !email) {
      return NextResponse.json({ success: false, message: "Name and email required." }, { status: 400 });
    }

    await connectDB();
    if (await Teacher.findOne({ email, school: auth.schoolId })) {
      return NextResponse.json(
        { success: false, message: "Teacher email already exists in this school." },
        { status: 400 },
      );
    }

    const isTeaching = !staffType || staffType === "teaching";
    const rawPassword = generatePassword();

    const teacher = await Teacher.create({
      name,
      email,
      phone: phone || "",
      staffType: isTeaching ? "teaching" : "non-teaching",
      department: department || "",
      subjects: isTeaching ? subjects || [] : [],
      classes: isTeaching ? classes || [] : [],
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
