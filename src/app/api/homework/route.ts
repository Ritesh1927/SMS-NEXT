import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Homework } from "@/models/Homework";
import { Teacher } from "@/models/Teacher";
import { Student } from "@/models/Student";
import { getTeacherAccessibleClasses, teacherHasAccessToClass } from "@/lib/teacherClasses";

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

    const query: Record<string, unknown> = { school: auth.schoolId, isActive: true };
    if (auth.role === "teacher") {
      const accessible = await getTeacherAccessibleClasses(auth.id, auth.schoolId);
      if (accessible.length === 0) return NextResponse.json({ success: true, data: [] });
      query.$or = accessible.map((c) => ({ class: c.name, section: c.section }));
    } else {
      if (cls) query.class = cls;
      if (section) query.section = section;
    }
    if (subject) query.subject = subject;

    const hw = await Homework.find(query).populate("assignedBy", "name teacherId").sort({ dueDate: 1 });

    // Attach real class size so the client can show an accurate submissions
    // progress bar instead of treating the submission count as its own total.
    const pairs = [...new Set(hw.map((h) => `${h.class}::${h.section || ""}`))].map((key) => {
      const [className, section_] = key.split("::");
      return { class: className, section: section_ };
    });
    const counts = new Map<string, number>();
    await Promise.all(
      pairs.map(async (p) => {
        const q: Record<string, unknown> = { school: auth.schoolId, class: p.class, isActive: true };
        if (p.section) q.section = p.section;
        counts.set(`${p.class}::${p.section}`, await Student.countDocuments(q));
      }),
    );

    const data = hw.map((h) => ({
      ...h.toObject(),
      totalStudents: counts.get(`${h.class}::${h.section || ""}`) ?? 0,
    }));

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load homework." },
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
      if (!teacher?.permissions?.canAssignHomework) {
        return NextResponse.json({ success: false, message: "You don't have permission to assign homework." }, { status: 403 });
      }
    }

    const { title, description, subject, class: cls, section, dueDate, maxMarks } = await req.json();
    if (!title || !description || !subject || !cls || !dueDate) {
      return NextResponse.json(
        { success: false, message: "title, description, subject, class and dueDate are required." },
        { status: 400 },
      );
    }

    if (auth.role === "teacher") {
      const allowed = await teacherHasAccessToClass(auth.id, auth.schoolId, cls);
      if (!allowed) {
        return NextResponse.json({ success: false, message: "You can only assign homework to your classes." }, { status: 403 });
      }
    }

    const hw = await Homework.create({
      school: auth.schoolId,
      title,
      description,
      subject,
      class: cls,
      section: section || "",
      dueDate,
      maxMarks: maxMarks || null,
      assignedBy: auth.id,
      assignedByModel: auth.role === "schooladmin" ? "Admin" : "Teacher",
    });

    const populated = await Homework.findById(hw._id).populate("assignedBy", "name teacherId");
    return NextResponse.json({ success: true, message: "Homework assigned.", data: populated }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to assign homework." },
      { status: 500 },
    );
  }
}
