import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Notice, type NoticeTargetRole } from "@/models/Notice";
import { Teacher } from "@/models/Teacher";
import { Student } from "@/models/Student";
import { getTeacherAccessibleClasses } from "@/lib/teacherClasses";
import "@/models/Admin";

export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || !["schooladmin", "teacher", "parent"].includes(auth.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const category = searchParams.get("category");
    const isUrgent = searchParams.get("isUrgent");

    // SMS-BACKEND's getNotices overwrites its expiry $or with the
    // role-target $or instead of combining them, so an expired notice can
    // still show up for non-admin roles. Using $and here so both filters
    // actually apply.
    const conditions: Record<string, unknown>[] = [
      { $or: [{ expiryDate: null }, { expiryDate: { $gte: new Date() } }] },
    ];
    // A "student"-targeted notice reaches a teacher/parent only when it
    // isn't scoped to a class list, or their own classes intersect it --
    // that's how a class/standard pick actually narrows delivery down to
    // the people "concerned with" it, per Design.md's notices feature.
    if (auth.role === "teacher") {
      const myClasses = (await getTeacherAccessibleClasses(auth.id, auth.schoolId)).map((c) => c.name);
      conditions.push({
        $or: [
          { targetRoles: "all" },
          { targetRoles: "teacher" },
          { targetRoles: "student", $or: [{ targetClasses: { $size: 0 } }, { targetClasses: { $in: myClasses } }] },
        ],
      });
    } else if (auth.role === "parent") {
      const children = await Student.find({ parent: auth.id, school: auth.schoolId }).select("class").lean();
      const myClasses = children.map((c) => c.class);
      conditions.push({
        $or: [
          { targetRoles: "all" },
          { targetRoles: "parent" },
          { targetRoles: "student", $or: [{ targetClasses: { $size: 0 } }, { targetClasses: { $in: myClasses } }] },
        ],
      });
    }

    const query: Record<string, unknown> = { school: auth.schoolId, $and: conditions };
    if (category) query.category = category;
    if (isUrgent !== null) query.isUrgent = isUrgent === "true";

    const notices = await Notice.find(query).sort({ isPinned: -1, isUrgent: -1, createdAt: -1 }).populate("postedBy", "name");
    return NextResponse.json({ success: true, data: notices });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load notices." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();

    if (auth.role === "teacher") {
      const teacher = await Teacher.findById(auth.id).select("permissions");
      if (!teacher?.permissions?.canPostNotice) {
        return NextResponse.json({ success: false, message: "You don't have permission to post notices." }, { status: 403 });
      }
    }

    const { title, content, category, targetRoles, classScope, targetClasses, isUrgent, isPinned, expiryDate } = await req.json();
    if (!title || !content) {
      return NextResponse.json({ success: false, message: "Title and content are required." }, { status: 400 });
    }

    const resolvedRoles: NoticeTargetRole[] = targetRoles?.length ? targetRoles : ["all"];
    const notice = await Notice.create({
      school: auth.schoolId,
      title,
      content,
      category: category || "general",
      targetRoles: resolvedRoles,
      classScope: resolvedRoles.includes("student") ? classScope || "" : "",
      targetClasses: resolvedRoles.includes("student") && targetClasses?.length ? targetClasses : [],
      postedBy: auth.id,
      postedByModel: auth.role === "schooladmin" ? "Admin" : "Teacher",
      isUrgent: isUrgent || false,
      isPinned: isPinned || false,
      expiryDate: expiryDate || null,
    });

    return NextResponse.json({ success: true, message: "Notice posted.", data: notice }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to post notice." },
      { status: 500 },
    );
  }
}
