import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireSuperAdmin } from "@/lib/auth-server";
import { School } from "@/models/School";
import { Admin } from "@/models/Admin";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_REGEX = /^\d{10}$/;

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireSuperAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    await connectDB();
    const school = await School.findById(id).select("-adminPassword");
    if (!school) return NextResponse.json({ success: false, message: "School not found." }, { status: 404 });
    return NextResponse.json({ success: true, data: school });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load school." },
      { status: 500 },
    );
  }
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = requireSuperAdmin(req);
  if ("error" in auth) return auth.error;

  try {
    const { id } = await params;
    const { name, address, phone, email, website, adminName, adminPhone, isActive, license } = await req.json();

    await connectDB();
    const school = await School.findById(id);
    if (!school) return NextResponse.json({ success: false, message: "School not found." }, { status: 404 });

    const phoneClean = String(phone || "").replace(/[\s\-+]/g, "");
    const adminPhoneClean = String(adminPhone || "").replace(/[\s\-+]/g, "");
    if (phoneClean && !PHONE_REGEX.test(phoneClean)) {
      return NextResponse.json({ success: false, message: "School phone must be exactly 10 digits." }, { status: 400 });
    }
    if (adminPhoneClean && !PHONE_REGEX.test(adminPhoneClean)) {
      return NextResponse.json({ success: false, message: "Admin phone must be exactly 10 digits." }, { status: 400 });
    }
    if (email && !EMAIL_REGEX.test(email)) {
      return NextResponse.json({ success: false, message: "Invalid school email format." }, { status: 400 });
    }

    if (phoneClean && phoneClean !== String(school.phone || "").replace(/[\s\-+]/g, "")) {
      if (await School.findOne({ phone: phoneClean, _id: { $ne: school._id } })) {
        return NextResponse.json({ success: false, message: "This school phone number is already registered." }, { status: 400 });
      }
    }
    if (adminPhoneClean && adminPhoneClean !== String(school.adminPhone || "").replace(/[\s\-+]/g, "")) {
      if (await School.findOne({ adminPhone: adminPhoneClean, _id: { $ne: school._id } })) {
        return NextResponse.json({ success: false, message: "This admin phone number is already registered." }, { status: 400 });
      }
    }

    if (name) {
      Object.assign(school, {
        name, address, phone: phoneClean || phone, email, website,
        adminName, adminPhone: adminPhoneClean || adminPhone, isActive,
      });
    }

    if (license) {
      Object.assign(school.license, license);
    }
    await school.save();

    if (school.adminUserId) {
      await Admin.findByIdAndUpdate(school.adminUserId, {
        schoolName: name || school.name,
        schoolEmail: email || school.email,
        schoolPhone: phoneClean || phone || school.phone,
        schoolAddress: address || school.address,
        website: website || "",
      });
    }

    return NextResponse.json({ success: true, message: "School updated.", data: school.toObject({ versionKey: false }) });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to update school." },
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
    const school = await School.findByIdAndDelete(id);
    if (!school) return NextResponse.json({ success: false, message: "School not found." }, { status: 404 });
    if (school.adminUserId) {
      await Admin.findByIdAndDelete(school.adminUserId);
    }
    return NextResponse.json({ success: true, message: "School deleted." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to delete school." },
      { status: 500 },
    );
  }
}
