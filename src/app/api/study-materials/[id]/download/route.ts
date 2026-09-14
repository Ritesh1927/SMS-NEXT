import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { StudyMaterial } from "@/models/StudyMaterial";

// PATCH /api/study-materials/[id]/download — fire-and-forget counter bump
// alongside the client's real <a href> download; any of the 3 roles can hit
// it since anyone who can see a material can download it.
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || !["schooladmin", "teacher", "parent"].includes(auth.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { id } = await params;
    const material = await StudyMaterial.findOneAndUpdate(
      { _id: id, school: auth.schoolId },
      { $inc: { downloads: 1 } },
      { new: true },
    );
    if (!material) return NextResponse.json({ success: false, message: "Material not found." }, { status: 404 });
    return NextResponse.json({ success: true, data: { downloads: material.downloads, fileUrl: material.fileUrl } });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to update download count." },
      { status: 500 },
    );
  }
}
