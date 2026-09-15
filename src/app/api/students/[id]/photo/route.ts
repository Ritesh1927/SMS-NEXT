import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Student } from "@/models/Student";
import { uploadProfilePhoto, deleteAsset } from "@/lib/cloudinary";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    await connectDB();

    const student = await Student.findOne({ _id: id, school: auth.schoolId });
    if (!student) return NextResponse.json({ success: false, message: "Student not found." }, { status: 404 });

    const formData = await req.formData();
    const file = formData.get("photo");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: "No photo file provided." }, { status: 400 });
    }

    const { url, publicId } = await uploadProfilePhoto(file);

    const oldPublicId = student.photoPublicId;
    student.photo = url;
    student.photoPublicId = publicId;
    await student.save();

    if (oldPublicId) await deleteAsset(oldPublicId, "image");

    return NextResponse.json({ success: true, message: "Photo updated.", data: { photo: url } });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to upload photo." },
      { status: 500 },
    );
  }
}
