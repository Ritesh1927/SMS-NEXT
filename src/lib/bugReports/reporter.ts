import { isValidObjectId } from "mongoose";
import { Admin } from "@/models/Admin";
import { Teacher } from "@/models/Teacher";
import { Student } from "@/models/Student";
import { Parent } from "@/models/Parent";
import { SuperAdmin } from "@/models/SuperAdmin";
import type { ITicketReporter } from "@/models/BugTicket";
import type { TicketAuth } from "./auth";

// Builds the reporter snapshot stored on a ticket: who raised it (role +
// name), their school, and the Teacher/Student ID. Everything comes from the
// database via the verified JWT, so the client can't spoof any of it. Email
// is kept only to notify the reporter. The caller must have called connectDB().

async function schoolName(schoolId: string): Promise<string> {
  if (!isValidObjectId(schoolId)) return "";
  const school = await Admin.findById(schoolId).select("schoolName").lean();
  return school?.schoolName || "";
}

export async function resolveReporter(auth: TicketAuth): Promise<ITicketReporter | null> {
  if (!isValidObjectId(auth.id)) return null;
  const base = { userId: auth.id, role: auth.role, userCode: "", schoolId: "", schoolName: "" };

  switch (auth.role) {
    case "superadmin": {
      const sa = await SuperAdmin.findById(auth.id).select("name email").lean();
      return sa ? { ...base, name: sa.name, email: sa.email, schoolName: "EduNivo (System Administrator)" } : null;
    }
    case "schooladmin": {
      const admin = await Admin.findById(auth.id).select("name email schoolName").lean();
      return admin ? { ...base, name: admin.name, email: admin.email, schoolId: auth.id, schoolName: admin.schoolName || "" } : null;
    }
    case "teacher": {
      const teacher = await Teacher.findById(auth.id).select("name email teacherId school").lean();
      if (!teacher) return null;
      const schoolId = String(teacher.school);
      return { ...base, name: teacher.name, email: teacher.email, userCode: teacher.teacherId || "", schoolId, schoolName: await schoolName(schoolId) };
    }
    case "student": {
      const student = await Student.findById(auth.id).select("name email studentId school").lean();
      if (!student) return null;
      const schoolId = String(student.school);
      return { ...base, name: student.name, email: student.email || "", userCode: student.studentId || "", schoolId, schoolName: await schoolName(schoolId) };
    }
    case "parent": {
      const parent = await Parent.findById(auth.id).select("name email school").lean();
      if (!parent) return null;
      const schoolId = String(parent.school);
      return { ...base, name: parent.name, email: parent.email, schoolId, schoolName: await schoolName(schoolId) };
    }
    default:
      return null;
  }
}
