import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser, getNonTeachingStaffSections } from "@/lib/auth-server";
import { Homework } from "@/models/Homework";
import "@/models/Teacher";
import "@/models/Admin";
import "@/models/Student";
import { uploadDocument, deleteAsset } from "@/lib/cloudinary";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    await connectDB();

    const staffSections = await getNonTeachingStaffSections(auth);
    if (staffSections && !staffSections.homework?.view) {
      return NextResponse.json({ success: false, message: "You don't have permission to do this." }, { status: 403 });
    }

    const hw = await Homework.findOne({ _id: id, school: auth.schoolId })
      .populate("assignedBy", "name teacherId")
      .populate("submissions.student", "name studentId class section");
    if (!hw) return NextResponse.json({ success: false, message: "Homework not found." }, { status: 404 });

    return NextResponse.json({ success: true, data: hw });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load homework." },
      { status: 500 },
    );
  }
}

const ALLOWED_FIELDS = ["title", "description", "subject", "class", "section", "dueDate", "maxMarks"] as const;

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    await connectDB();

    const staffSections = await getNonTeachingStaffSections(auth);
    if (staffSections && !staffSections.homework?.edit) {
      return NextResponse.json({ success: false, message: "You don't have permission to do this." }, { status: 403 });
    }

    // A non-teaching staffer with "edit" can touch any homework, same as
    // admin -- the author-only restriction below is specific to a genuine
    // teacher acting on their own postings.
    const query: Record<string, unknown> = { _id: id, school: auth.schoolId };
    if (auth.role === "teacher" && !staffSections) query.assignedBy = auth.id;

    const existing = await Homework.findOne(query);
    if (!existing) return NextResponse.json({ success: false, message: "Homework not found or access denied." }, { status: 404 });

    const updates: Record<string, unknown> = {};

    const contentType = req.headers.get("content-type") || "";
    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      for (const key of ALLOWED_FIELDS) {
        const value = formData.get(key);
        if (value !== null) updates[key] = key === "maxMarks" ? (value ? Number(value) : null) : value;
      }

      const file = formData.get("file");
      const removeAttachment = formData.get("removeAttachment") === "true";

      if (file instanceof File && file.size > 0) {
        const attachment = await uploadDocument(file, "homework-attachments");
        if (existing.attachmentPublicId) await deleteAsset(existing.attachmentPublicId, "raw");
        updates.attachmentUrl = attachment.url;
        updates.attachmentName = file.name;
        updates.attachmentPublicId = attachment.publicId;
      } else if (removeAttachment) {
        if (existing.attachmentPublicId) await deleteAsset(existing.attachmentPublicId, "raw");
        updates.attachmentUrl = "";
        updates.attachmentName = "";
        updates.attachmentPublicId = "";
      }
    } else {
      const body = await req.json();
      for (const key of ALLOWED_FIELDS) {
        if (body[key] !== undefined) updates[key] = body[key];
      }
    }

    const hw = await Homework.findOneAndUpdate(query, updates, { returnDocument: "after" }).populate(
      "assignedBy",
      "name teacherId",
    );
    if (!hw) return NextResponse.json({ success: false, message: "Homework not found or access denied." }, { status: 404 });

    return NextResponse.json({ success: true, message: "Homework updated.", data: hw });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to update homework." },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    await connectDB();

    const staffSections = await getNonTeachingStaffSections(auth);
    if (staffSections && !staffSections.homework?.delete) {
      return NextResponse.json({ success: false, message: "You don't have permission to do this." }, { status: 403 });
    }

    const query: Record<string, unknown> = { _id: id, school: auth.schoolId };
    if (auth.role === "teacher" && !staffSections) query.assignedBy = auth.id;

    const hw = await Homework.findOneAndDelete(query);
    if (!hw) return NextResponse.json({ success: false, message: "Homework not found or access denied." }, { status: 404 });

    return NextResponse.json({ success: true, message: "Homework deleted." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to delete homework." },
      { status: 500 },
    );
  }
}
