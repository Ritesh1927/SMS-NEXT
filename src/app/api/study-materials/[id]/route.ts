import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { StudyMaterial } from "@/models/StudyMaterial";
import { deleteAsset } from "@/lib/cloudinary";

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { id } = await params;

    const query: Record<string, unknown> = { _id: id, school: auth.schoolId };
    if (auth.role === "teacher") query.uploadedBy = auth.id;

    const material = await StudyMaterial.findOne(query);
    if (!material) {
      return NextResponse.json({ success: false, message: "Material not found or access denied." }, { status: 404 });
    }

    if (material.filePublicId) {
      await deleteAsset(material.filePublicId, "raw");
    }

    await material.deleteOne();
    return NextResponse.json({ success: true, message: "Material deleted." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to delete material." },
      { status: 500 },
    );
  }
}
