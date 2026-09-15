import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth-server";
import { School } from "@/models/School";
import { Admin } from "@/models/Admin";
import { Teacher } from "@/models/Teacher";
import { Student } from "@/models/Student";
import { Parent } from "@/models/Parent";
import { escapeRegex, generatePassword, hashPassword } from "@/lib/helpers";

export async function GET(req: Request) {
  const auth = requireSuperAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const search = searchParams.get("search");

    const query: Record<string, unknown> = {};
    if (search) {
      const q = escapeRegex(search);
      query.$or = [
        { name: { $regex: q, $options: "i" } },
        { code: { $regex: q, $options: "i" } },
        { adminEmail: { $regex: q, $options: "i" } },
      ];
    }

    const schools = await School.find(query).select("-adminPassword").sort({ createdAt: -1 });

    const schoolsWithCounts = await Promise.all(
      schools.map(async (s) => {
        const adminCount = s.adminUserId ? await Admin.countDocuments({ _id: s.adminUserId, isActive: true }) : 0;
        const [teachers, students, parents] = await Promise.all([
          Teacher.countDocuments({ school: s.adminUserId }),
          Student.countDocuments({ school: s.adminUserId }),
          Parent.countDocuments({ school: s.adminUserId }),
        ]);
        return {
          ...s.toObject(),
          userCounts: {
            admin: adminCount,
            teachers,
            students,
            parents,
            usersUsed: adminCount + teachers + students,
            usersTotal: (s.license?.includedUsers || 0) + (s.license?.extraUsers || 0),
          },
        };
      }),
    );

    return NextResponse.json({ success: true, data: schoolsWithCounts, total: schoolsWithCounts.length });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load schools." },
      { status: 500 },
    );
  }
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{10}$/;

export async function POST(req: Request) {
  const auth = requireSuperAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const body = await req.json();
    const {
      name, address, phone, email, adminName, adminEmail, adminPhone,
      planId, planName, startDate, endDate, extraUsers, includedUsers, pricePerUser, months, totalAmount, totalUsers,
    } = body;

    if (!name || !adminName || !adminEmail) {
      return NextResponse.json(
        { success: false, message: "School name, admin name and admin email are required." },
        { status: 400 },
      );
    }
    if (!EMAIL_REGEX.test(adminEmail)) {
      return NextResponse.json({ success: false, message: "Invalid admin email format." }, { status: 400 });
    }
    if (email && !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ success: false, message: "Invalid school email format." }, { status: 400 });
    }

    const phoneClean = String(phone || "").replace(/[\s\-+]/g, "");
    const adminPhoneClean = String(adminPhone || "").replace(/[\s\-+]/g, "");
    if (phoneClean && !PHONE_REGEX.test(phoneClean)) {
      return NextResponse.json({ success: false, message: "School phone must be exactly 10 digits." }, { status: 400 });
    }
    if (adminPhoneClean && !PHONE_REGEX.test(adminPhoneClean)) {
      return NextResponse.json({ success: false, message: "Admin phone must be exactly 10 digits." }, { status: 400 });
    }

    await connectDB();

    const adminEmailLower = String(adminEmail).toLowerCase();
    if (await School.findOne({ adminEmail: adminEmailLower })) {
      return NextResponse.json({ success: false, message: "This admin email is already registered." }, { status: 400 });
    }
    if (await Admin.findOne({ email: adminEmailLower })) {
      return NextResponse.json({ success: false, message: "This admin email is already registered." }, { status: 400 });
    }
    if (phoneClean && (await School.findOne({ phone: phoneClean }))) {
      return NextResponse.json({ success: false, message: "This school phone number is already registered." }, { status: 400 });
    }
    if (adminPhoneClean && (await School.findOne({ adminPhone: adminPhoneClean }))) {
      return NextResponse.json({ success: false, message: "This admin phone number is already registered." }, { status: 400 });
    }

    const rawPassword = generatePassword();
    const hashedPassword = await hashPassword(rawPassword);

    const school = await School.create({
      name, address: address || "", phone: phone || "", email: email || "",
      adminName, adminEmail: adminEmailLower, adminPhone: adminPhone || "",
      adminPassword: hashedPassword,
      license: {
        planId: planId || null,
        planName: planName || "",
        startDate: startDate ? new Date(startDate) : null,
        endDate: endDate ? new Date(endDate) : null,
        includedUsers: parseInt(includedUsers) || 0,
        extraUsers: parseInt(extraUsers) || 0,
        totalUsers: parseInt(totalUsers) || 0,
        pricePerUser: parseInt(pricePerUser) || 0,
        months: parseInt(months) || 1,
        totalAmount: parseInt(totalAmount) || 0,
        status: "active",
      },
    });

    const admin = await Admin.create({
      schoolName: name, schoolAddress: address || "", schoolPhone: phoneClean || phone || "",
      schoolEmail: email || "",
      name: adminName, email: adminEmailLower,
      password: hashedPassword,
      phone: adminPhoneClean || adminPhone || "", role: "schooladmin", isVerified: true, isActive: true,
    });

    school.adminUserId = admin._id;
    await school.save();

    return NextResponse.json(
      {
        success: true,
        message: "School created.",
        data: {
          schoolId: school._id, code: school.code, adminEmail: school.adminEmail,
          generatedPassword: rawPassword, planName: planName || "None",
        },
      },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to create school." },
      { status: 500 },
    );
  }
}
