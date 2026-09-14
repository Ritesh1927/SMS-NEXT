import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { StudyMaterial, type MaterialType } from "@/models/StudyMaterial";
import { Teacher } from "@/models/Teacher";
import { Admin } from "@/models/Admin";
import { getTeacherAccessibleClasses, teacherHasAccessToClass } from "@/lib/teacherClasses";
import { uploadDocument } from "@/lib/cloudinary";

const MATERIAL_TYPES: MaterialType[] = ["pdf", "notes", "paper", "worksheet"];

// GET /api/study-materials — admin (optional class/section filters) or
// teacher (scoped to their accessible classes, same two-path check as
// homework). Parent view lives at /student/[studentId] instead, since
// SMS-BACKEND's student branch here assumes a student login this app
// doesn't have.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const cls = searchParams.get("class");
    const section = searchParams.get("section");
    const subject = searchParams.get("subject");

    const query: Record<string, unknown> = { school: auth.schoolId };
    if (auth.role === "teacher") {
      const accessible = await getTeacherAccessibleClasses(auth.id, auth.schoolId);
      if (accessible.length === 0) return NextResponse.json({ success: true, data: [] });
      query.$or = accessible.flatMap((c) => [
        { class: c.name, section: c.section },
        { class: c.name, section: "" },
      ]);
    } else {
      if (cls) query.class = cls;
      if (section) query.section = section;
    }
    if (subject) query.subject = { $regex: subject, $options: "i" };

    const materials = await StudyMaterial.find(query).populate("uploadedBy", "name teacherId").sort({ createdAt: -1 });
    return NextResponse.json({ success: true, count: materials.length, data: materials });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load materials." },
      { status: 500 },
    );
  }
}

// POST /api/study-materials — multipart/form-data upload.
export async function POST(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const form = await req.formData();
    const title = String(form.get("title") || "").trim();
    const description = String(form.get("description") || "").trim();
    const subject = String(form.get("subject") || "").trim();
    const cls = String(form.get("class") || "").trim();
    const section = String(form.get("section") || "").trim();
    const typeRaw = String(form.get("type") || "pdf");
    const type: MaterialType = MATERIAL_TYPES.includes(typeRaw as MaterialType) ? (typeRaw as MaterialType) : "pdf";
    const file = form.get("file");

    if (!title || !subject || !cls) {
      return NextResponse.json({ success: false, message: "title, subject and class are required." }, { status: 400 });
    }
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: "A file is required." }, { status: 400 });
    }

    let uploaderName = "";
    if (auth.role === "teacher") {
      const allowed = await teacherHasAccessToClass(auth.id, auth.schoolId, cls);
      if (!allowed) {
        return NextResponse.json({ success: false, message: "You can only upload materials for your classes." }, { status: 403 });
      }
      const teacher = await Teacher.findById(auth.id).select("name");
      uploaderName = teacher?.name || "";
    } else {
      const admin = await Admin.findById(auth.id).select("name");
      uploaderName = admin?.name || "";
    }

    const uploaded = await uploadDocument(file, "study-materials");

    const material = await StudyMaterial.create({
      school: auth.schoolId,
      title,
      description,
      subject,
      class: cls,
      section,
      type,
      fileUrl: uploaded.url,
      filePublicId: uploaded.publicId,
      fileName: file.name,
      uploadedBy: auth.id,
      uploaderModel: auth.role === "schooladmin" ? "Admin" : "Teacher",
      uploaderName,
    });

    return NextResponse.json({ success: true, message: "Material uploaded.", data: material }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to upload material." },
      { status: 500 },
    );
  }
}
