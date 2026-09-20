import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { Admin } from "@/models/Admin";
import { Teacher } from "@/models/Teacher";
import { Student } from "@/models/Student";
import { Parent } from "@/models/Parent";
import { Class } from "@/models/Class";
import { generateToken } from "@/lib/helpers";
import { logLogin } from "@/lib/loginLog";
import { checkAuthRateLimit } from "@/lib/rateLimit";

// Simplified port of SMS-BACKEND's resolveSchools: the same email+password
// can match a schooladmin, teacher and/or parent account across schools, so
// every matching role is checked and the caller either gets a single
// auto-login or a list of accounts to choose from. The School/Plan
// license-gating subsystem from the original is deliberately left out of
// this initial pass.
interface ResolvedAccount {
  schoolId: string;
  schoolName: string;
  role: "schooladmin" | "teacher" | "parent";
  userId: string;
  userName: string;
  email?: string;
  teacherId?: string;
  permissions?: unknown;
  subjects?: string[];
  classes?: string[];
  classTeacherOf?: string[];
  children?: unknown;
}

export async function POST(req: Request) {
  const limited = await checkAuthRateLimit(req);
  if (limited) return limited;

  try {
    const { email, password, role, schoolId } = await req.json();
    if (!email || !password) {
      return NextResponse.json({ success: false, message: "Email and password required." }, { status: 400 });
    }

    await connectDB();
    const identifier = String(email).trim();
    const results: ResolvedAccount[] = [];
    const skipReasons: string[] = [];

    // Student admission number ("STU-...") logs in as the linked parent.
    if (!role && /^STU-/i.test(identifier)) {
      const student = await Student.findOne({ studentId: identifier.toUpperCase() }).populate(
        "school",
        "schoolName schoolCode",
      );
      if (!student) {
        return NextResponse.json(
          { success: false, message: "No student found with this admission number." },
          { status: 404 },
        );
      }
      if (!student.parent) {
        return NextResponse.json(
          { success: false, message: "No parent account linked to this student. Contact admin." },
          { status: 400 },
        );
      }
      if (!student.password || !(await student.comparePassword(password))) {
        return NextResponse.json({ success: false, message: "Incorrect password." }, { status: 401 });
      }
      const parent = await Parent.findById(student.parent).populate("students", "name studentId class section");
      if (!parent || !parent.isActive) {
        return NextResponse.json({ success: false, message: "Parent account is deactivated." }, { status: 403 });
      }
      const token = generateToken(parent.id, "parent", String(parent.school));
      logLogin(req, { school: String(parent.school), userId: parent.id, userName: parent.name, email: parent.email, role: "parent" });
      return NextResponse.json({
        success: true,
        single: true,
        token,
        user: {
          id: parent.id,
          name: parent.name,
          email: parent.email,
          role: "parent",
          school: parent.school,
          children: parent.students,
        },
      });
    }

    if (!role || role === "schooladmin") {
      const filter: Record<string, unknown> = { email: identifier.toLowerCase() };
      if (schoolId) filter._id = schoolId;
      const admins = await Admin.find(filter);
      for (const a of admins) {
        if (!(await a.comparePassword(password))) continue;
        if (!a.isActive) {
          skipReasons.push("admin_inactive");
          continue;
        }
        results.push({
          schoolId: a.id,
          schoolName: a.schoolName || "Unknown School",
          role: "schooladmin",
          userId: a.id,
          userName: a.name,
          email: a.email,
        });
      }
    }

    if (!role || role === "parent") {
      const filter: Record<string, unknown> = { email: identifier.toLowerCase() };
      if (schoolId) filter.school = schoolId;
      const parents = await Parent.find(filter)
        .populate("students", "name studentId class section")
        .populate<{ school: { _id: unknown; schoolName: string } }>("school", "schoolName");
      for (const p of parents) {
        if (!(await p.comparePassword(password))) continue;
        if (!p.isActive) {
          skipReasons.push("parent_inactive");
          continue;
        }
        results.push({
          schoolId: String(p.school._id),
          schoolName: p.school.schoolName || "Unknown School",
          role: "parent",
          userId: p.id,
          userName: p.name,
          email: p.email,
          children: p.students,
        });
      }
    }

    if (!role || role === "teacher") {
      const filter: Record<string, unknown> = { email: identifier.toLowerCase() };
      if (schoolId) filter.school = schoolId;
      const teachers = await Teacher.find(filter).populate<{ school: { _id: unknown; schoolName: string } }>(
        "school",
        "schoolName",
      );
      for (const t of teachers) {
        if (!(await t.comparePassword(password))) continue;
        if (!t.isActive) {
          skipReasons.push("teacher_inactive");
          continue;
        }
        const classTeacherOfDocs = await Class.find({ classTeacher: t._id, school: String(t.school._id) }).select("name section");
        results.push({
          schoolId: String(t.school._id),
          schoolName: t.school.schoolName || "Unknown School",
          role: "teacher",
          userId: t.id,
          userName: t.name,
          email: t.email,
          teacherId: t.teacherId,
          permissions: t.permissions,
          subjects: t.subjects,
          classes: t.classes,
          classTeacherOf: classTeacherOfDocs.map((c) => `${c.name}-${c.section}`),
        });
      }
    }

    if (results.length === 0) {
      if (skipReasons.length > 0) {
        return NextResponse.json(
          { success: false, message: "Account is deactivated. Contact administrator.", code: "ACCOUNT_DEACTIVATED" },
          { status: 403 },
        );
      }
      const [adminExists, teacherExists, parentExists] = await Promise.all([
        Admin.findOne({ email: identifier.toLowerCase() }).lean(),
        Teacher.findOne({ email: identifier.toLowerCase() }).lean(),
        Parent.findOne({ email: identifier.toLowerCase() }).lean(),
      ]);
      if (!adminExists && !teacherExists && !parentExists) {
        return NextResponse.json(
          { success: false, message: "No account found with this email. Please check your email or contact administrator." },
          { status: 404 },
        );
      }
      return NextResponse.json({ success: false, message: "Incorrect password. Please try again." }, { status: 401 });
    }

    if (results.length === 1) {
      const r = results[0];
      const token = generateToken(r.userId, r.role, r.schoolId);
      logLogin(req, { school: r.schoolId, userId: r.userId, userName: r.userName, email: r.email || identifier.toLowerCase(), role: r.role });
      return NextResponse.json({
        success: true,
        single: true,
        token,
        user: {
          id: r.userId,
          name: r.userName,
          email: r.email || identifier.toLowerCase(),
          role: r.role,
          school: r.schoolId,
          schoolName: r.schoolName,
          ...(r.role === "teacher"
            ? { teacherId: r.teacherId, permissions: r.permissions, subjects: r.subjects, classes: r.classes, classTeacherOf: r.classTeacherOf }
            : {}),
          ...(r.role === "parent" ? { children: r.children } : {}),
        },
      });
    }

    return NextResponse.json({ success: true, single: false, schools: results });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Login failed." },
      { status: 500 },
    );
  }
}
