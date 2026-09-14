import { NextResponse } from "next/server";
import mongoose from "mongoose";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Conversation } from "@/models/Conversation";
import { Teacher } from "@/models/Teacher";
import { Student } from "@/models/Student";
import { Parent } from "@/models/Parent";
import { Class } from "@/models/Class";
import { Admin } from "@/models/Admin";
import { formatClassName } from "@/lib/helpers";

interface Contact {
  id: string;
  name: string;
  role: "schooladmin" | "teacher" | "parent";
  subtitle: string;
  conversationId: string | null;
  lastMessage: string;
  time: Date | null;
  unread: number;
  targetUserId: string;
  targetRole: "schooladmin" | "teacher" | "parent";
  childId: string | null;
}

// GET /api/chat/contacts — role-based contact list. Simplified from
// SMS-BACKEND's 4-role version (student/teacher/admin/parent) to the 3 roles
// that actually have real accounts here (no student self-login — see the
// investigation before the Attendance feature). That also removes the need
// for mirrorToStudent: since students don't have their own conversations,
// teacher<->parent just talks directly instead of being mirrored through one.
//
// "Class teacher" for a student is derived from Class.classTeacher (matched
// by class+section) rather than Student.classTeacher — nothing in this app
// ever sets the latter; the former is the field the Classes page actually
// lets an admin assign.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || !["schooladmin", "teacher", "parent"].includes(auth.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const schoolId = auth.schoolId;
    let contacts: Contact[] = [];

    if (auth.role === "schooladmin") {
      const [teachers, parents] = await Promise.all([
        Teacher.find({ school: schoolId, isActive: true, staffType: "teaching" }).select("name designation"),
        Parent.find({ school: schoolId, isActive: true }).populate("students", "name"),
      ]);
      contacts = [
        ...teachers.map((t) => baseContact(String(t._id), t.name, "teacher", t.designation || "Teacher")),
        ...parents.map((p) => {
          type PopulatedChild = { name: string };
          const children = (p.students as unknown as PopulatedChild[]) || [];
          return baseContact(String(p._id), p.name, "parent", children.map((c) => c.name).join(", ") || "Parent");
        }),
      ];
    } else if (auth.role === "teacher") {
      const [admin, classTeacherClasses] = await Promise.all([
        Admin.findById(schoolId).select("name schoolName"),
        Class.find({ classTeacher: auth.id, school: schoolId }).select("name section").lean(),
      ]);

      const parentContacts: Contact[] = [];
      if (classTeacherClasses.length > 0) {
        const orFilters = classTeacherClasses.map((c) => ({ class: c.name, section: c.section || "" }));
        const classStudents = await Student.find({ school: schoolId, isActive: true, $or: orFilters })
          .select("name class section parent")
          .populate("parent", "name");

        const seen = new Set<string>();
        for (const s of classStudents) {
          type PopulatedParent = { _id: mongoose.Types.ObjectId; name: string } | null;
          const parent = s.parent as unknown as PopulatedParent;
          if (!parent || seen.has(String(parent._id))) continue;
          seen.add(String(parent._id));
          parentContacts.push(
            baseContact(String(parent._id), parent.name, "parent", `${s.name}'s parent — ${formatClassName(s.class, s.section)}`),
          );
        }
      }

      contacts = [
        ...(admin ? [baseContact(String(admin._id), admin.name || admin.schoolName || "Admin", "schooladmin", "School Admin")] : []),
        ...parentContacts,
      ];
    } else {
      const parentDoc = await Parent.findById(auth.id).populate("students", "name class section");
      type PopulatedChild = { _id: mongoose.Types.ObjectId; name: string; class: string; section?: string };
      const children = (parentDoc?.students as unknown as PopulatedChild[]) || [];

      const childContacts: Contact[] = [];
      const teacherIds = new Set<string>();

      for (const child of children) {
        const conv = await Conversation.findOne({
          school: schoolId,
          "participants.userId": { $all: [auth.id, schoolId] },
          childId: child._id,
        }).lean();
        const me = conv?.participants.find((p) => String(p.userId) === auth.id);
        childContacts.push({
          id: String(child._id),
          name: `School (re: ${child.name})`,
          role: "schooladmin",
          subtitle: formatClassName(child.class, child.section),
          conversationId: conv ? String(conv._id) : null,
          lastMessage: conv?.lastMessage || "",
          time: conv?.lastMessageAt || null,
          unread: me?.unread || 0,
          targetUserId: String(schoolId),
          targetRole: "schooladmin",
          childId: String(child._id),
        });

        const cls = await Class.findOne({ school: schoolId, name: child.class, section: child.section || "" })
          .select("classTeacher")
          .lean();
        if (cls?.classTeacher) teacherIds.add(String(cls.classTeacher));
      }

      const teachers = teacherIds.size
        ? await Teacher.find({ _id: { $in: [...teacherIds] }, school: schoolId, isActive: true }).select("name designation")
        : [];
      const teacherContacts = teachers.map((t) => baseContact(String(t._id), t.name, "teacher", t.designation || "Teacher"));

      contacts = [...childContacts, ...(await enrichWithConversations(teacherContacts, auth.id, String(schoolId)))];
    }

    if (auth.role !== "parent") {
      contacts = await enrichWithConversations(contacts, auth.id, String(schoolId));
    }

    contacts.sort((a, b) => {
      if (a.time && b.time) return new Date(b.time).getTime() - new Date(a.time).getTime();
      if (a.time) return -1;
      if (b.time) return 1;
      return a.name.localeCompare(b.name);
    });

    return NextResponse.json({ success: true, contacts });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load contacts." },
      { status: 500 },
    );
  }
}

function baseContact(id: string, name: string, role: Contact["role"], subtitle: string): Contact {
  return {
    id, name, role, subtitle,
    conversationId: null, lastMessage: "", time: null, unread: 0,
    targetUserId: id, targetRole: role, childId: null,
  };
}

async function enrichWithConversations(contacts: Contact[], userId: string, schoolId: string): Promise<Contact[]> {
  return Promise.all(
    contacts.map(async (c) => {
      // No childId filter here (matches SMS-BACKEND's enrichWithConversations) —
      // a parent-admin pair with multiple children can have multiple per-child
      // conversations; this just surfaces whichever one Mongo returns first.
      const conv = await Conversation.findOne({
        school: schoolId,
        "participants.userId": { $all: [userId, c.targetUserId] },
      }).lean();
      if (!conv) return c;
      const me = conv.participants.find((p) => String(p.userId) === userId);
      return {
        ...c,
        conversationId: String(conv._id),
        lastMessage: conv.lastMessage || "",
        time: conv.lastMessageAt || null,
        unread: me?.unread || 0,
      };
    }),
  );
}
