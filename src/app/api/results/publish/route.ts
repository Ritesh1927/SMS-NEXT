import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Result } from "@/models/Result";
import { Teacher } from "@/models/Teacher";

export async function PATCH(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();

    if (auth.role === "teacher") {
      const teacher = await Teacher.findById(auth.id).select("permissions");
      if (!teacher?.permissions?.canEnterMarks) {
        return NextResponse.json({ success: false, message: "You don't have permission to publish results." }, { status: 403 });
      }
    }

    const { resultIds, publish } = await req.json();
    if (!Array.isArray(resultIds) || resultIds.length === 0) {
      return NextResponse.json({ success: false, message: "resultIds[] is required." }, { status: 400 });
    }

    const update = publish
      ? { $set: { isPublished: true, publishedAt: new Date() } }
      : { $set: { isPublished: false }, $unset: { publishedAt: "" } };

    await Result.updateMany({ _id: { $in: resultIds }, school: auth.schoolId }, update);
    return NextResponse.json({ success: true, message: publish ? "Results published." : "Results unpublished." });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to update results." },
      { status: 500 },
    );
  }
}
