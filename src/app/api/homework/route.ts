import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Homework } from "@/models/Homework";
import { Teacher } from "@/models/Teacher";
import { Student } from "@/models/Student";
import "@/models/Admin";
import { getTeacherAccessibleClasses, teacherHasAccessToClass, isClassTeacherOf } from "@/lib/teacherClasses";
import { uploadDocument } from "@/lib/cloudinary";

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

    const hw = await Homework.find(query)
      .populate("assignedBy", "name teacherId")
      .populate("submissions.student", "name studentId")
      .sort({ dueDate: 1 });

    // Attach real class size so the client can show an accurate submissions
    // progress bar instead of treating the submission count as its own total.
    const pairs = [...new Set(hw.map((h) => `${h.class}::${h.section || ""}`))].map((key) => {
      const [className, section_] = key.split("::");
      return { class: className, section: section_ };
    });
    const rosterByClass = new Map<string, { _id: unknown; name: string; studentId: string }[]>();
    await Promise.all(
      pairs.map(async (p) => {
        const q: Record<string, unknown> = { school: auth.schoolId, class: p.class, isActive: true };
        if (p.section) q.section = p.section;
        const students = await Student.find(q)
          .select("name studentId")
          .sort({ rollNumber: 1, name: 1 })
          .lean<{ _id: unknown; name: string; studentId: string }[]>();
        rosterByClass.set(`${p.class}::${p.section}`, students);
      }),
    );

    const data = hw.map((h) => {
      const students = rosterByClass.get(`${h.class}::${h.section || ""}`) ?? [];
      // submissions.student is populated above but typed as a plain ObjectId.
      const submittedIds = new Set(
        h.submissions.map((s) => {
          const raw = s.student as unknown as { _id?: unknown } | null;
          return String(raw?._id ?? raw);
        }),
      );
      // Full class roster for the Submissions dialog: everyone who submitted
      // (existing submission docs) followed by classmates who haven't, so
      // the teacher sees who is missing — not just who turned it in.
      const roster = [
        ...h.submissions.map((s) => ({ ...s.toObject(), notSubmitted: false })),
        ...students
          .filter((st) => !submittedIds.has(String(st._id)))
          .map((st) => ({ student: st, submittedAt: null, note: "", status: "submitted", marks: null, feedback: "", notSubmitted: true })),
      ];
      return {
        ...h.toObject(),
        totalStudents: students.length,
        roster,
      };
    });

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

    const formData = await req.formData();
    const title = formData.get("title") as string | null;
    const description = formData.get("description") as string | null;
    const subject = formData.get("subject") as string | null;
    const cls = formData.get("class") as string | null;
    const section = formData.get("section") as string | null;
    const dueDate = formData.get("dueDate") as string | null;
    const maxMarks = formData.get("maxMarks") as string | null;
    const file = formData.get("file");

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

      // Being the class's actual class teacher is enough on its own — the
      // canAssignHomework grant is only needed for a subject-only teacher
      // (access via assignedClasses, not Class.classTeacher).
      const isClassTeacher = await isClassTeacherOf(auth.id, auth.schoolId, cls);
      if (!isClassTeacher) {
        const teacher = await Teacher.findById(auth.id).select("permissions");
        if (!teacher?.permissions?.canAssignHomework) {
          return NextResponse.json({ success: false, message: "You don't have permission to assign homework." }, { status: 403 });
        }
      }
    }

    let attachment: { url: string; publicId: string } | null = null;
    if (file instanceof File && file.size > 0) {
      attachment = await uploadDocument(file, "homework-attachments");
    }

    const hw = await Homework.create({
      school: auth.schoolId,
      title,
      description,
      subject,
      class: cls,
      section: section || "",
      dueDate,
      maxMarks: maxMarks ? Number(maxMarks) : null,
      assignedBy: auth.id,
      assignedByModel: auth.role === "schooladmin" ? "Admin" : "Teacher",
      attachmentUrl: attachment?.url || "",
      attachmentName: attachment ? (file as File).name : "",
      attachmentPublicId: attachment?.publicId || "",
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
