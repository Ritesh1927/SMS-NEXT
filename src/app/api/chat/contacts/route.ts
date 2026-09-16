import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Conversation } from "@/models/Conversation";
import { Teacher } from "@/models/Teacher";
import { Student } from "@/models/Student";
import { Parent } from "@/models/Parent";
import { Class } from "@/models/Class";
import { escapeRegex, formatClassName } from "@/lib/helpers";
import { getClassTeacherIdsForChildren } from "@/lib/chatAccess";

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

// GET /api/chat/contacts — role-based contact list.
//
// - parent: can only message the class teacher(s) of their own children
//   (one entry per teacher, even with kids in different classes) plus a
//   single generic "School Admin" thread — no per-child admin threads, no
//   search (the set is always small and fixed).
// - teacher: admin + parents of students in classes where this teacher is
//   THE class teacher (Class.classTeacher, not merely assignedClasses).
// - schooladmin: unrestricted, but the school can have far more contacts
//   than fit in a flat list, so by default this returns only *existing*
//   conversations ("recent"); passing ?type=teacher or ?type=student
//   switches to a search/browse mode for starting new ones.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || !["schooladmin", "teacher", "parent"].includes(auth.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const schoolId = auth.schoolId;
    const { searchParams } = new URL(req.url);
    let contacts: Contact[] = [];
    let needsEnrich = true;

    if (auth.role === "schooladmin") {
      const type = searchParams.get("type");
      const search = (searchParams.get("search") || "").trim();

      if (type === "teacher") {
        const query: Record<string, unknown> = { school: schoolId, isActive: true, staffType: "teaching" };
        if (search) query.name = { $regex: escapeRegex(search), $options: "i" };
        const teachers = await Teacher.find(query).select("name designation").sort({ name: 1 }).limit(50);
        contacts = teachers.map((t) => baseContact(String(t._id), t.name, "teacher", t.designation || "Teacher"));
      } else if (type === "student") {
        const className = searchParams.get("class");
        const section = searchParams.get("section") || "";
        if (!className) {
          contacts = [];
          needsEnrich = false;
        } else {
          const query: Record<string, unknown> = { school: schoolId, isActive: true, class: className, section };
          if (search) query.name = { $regex: escapeRegex(search), $options: "i" };
          const students = await Student.find(query)
            .select("name class section parent")
            .populate("parent", "name isActive")
            .sort({ name: 1 })
            .limit(30);
          contacts = students
            .filter((s) => s.parent && (s.parent as unknown as { isActive?: boolean }).isActive !== false)
            .map((s) => {
              const parent = s.parent as unknown as { _id: string; name: string };
              return baseContact(
                String(parent._id),
                parent.name,
                "parent",
                `Parent of ${s.name} — ${formatClassName(s.class, s.section)}`,
              );
            });
        }
      } else {
        // Default view: only conversations that already exist.
        const conversations = await Conversation.find({ school: schoolId, "participants.userId": auth.id })
          .sort({ lastMessageAt: -1 })
          .limit(100);
        contacts = conversations
          .map((conv) => conversationToContact(conv, auth.id))
          .filter((c): c is Contact => c !== null);
        needsEnrich = false;
      }
    } else if (auth.role === "teacher") {
      const classTeacherClasses = await Class.find({ classTeacher: auth.id, school: schoolId }).select("name section").lean();

      const parentContacts: Contact[] = [];
      if (classTeacherClasses.length > 0) {
        const orFilters = classTeacherClasses.map((c) => ({ class: c.name, section: c.section || "" }));
        const classStudents = await Student.find({ school: schoolId, isActive: true, $or: orFilters })
          .select("name class section parent")
          .populate("parent", "name isActive");

        const seen = new Set<string>();
        for (const s of classStudents) {
          const parent = s.parent as unknown as { _id: string; name: string; isActive?: boolean } | null;
          if (!parent || parent.isActive === false || seen.has(String(parent._id))) continue;
          seen.add(String(parent._id));
          parentContacts.push(
            baseContact(String(parent._id), parent.name, "parent", `${s.name}'s parent — ${formatClassName(s.class, s.section)}`),
          );
        }
      }

      contacts = [baseContact(String(schoolId), "School Admin", "schooladmin", "School Administration"), ...parentContacts];
    } else {
      // parent
      const parentDoc = await Parent.findById(auth.id).populate("students", "name class section");
      type PopulatedChild = { _id: string; name: string; class: string; section?: string };
      const children = (parentDoc?.students as unknown as PopulatedChild[]) || [];

      const adminConv = await Conversation.findOne({
        school: schoolId,
        "participants.userId": { $all: [auth.id, schoolId] },
        childId: null,
      }).lean();
      const adminMe = adminConv?.participants.find((p) => String(p.userId) === auth.id);
      const adminContact: Contact = {
        ...baseContact(String(schoolId), "School Admin", "schooladmin", "School Administration"),
        conversationId: adminConv ? String(adminConv._id) : null,
        lastMessage: adminConv?.lastMessage || "",
        time: adminConv?.lastMessageAt || null,
        unread: adminMe?.unread || 0,
      };

      const classTeacherIds = await getClassTeacherIdsForChildren(
        children.map((c) => ({ class: c.class, section: c.section })),
        String(schoolId),
      );
      const teacherChildNames = new Map<string, string[]>();
      if (classTeacherIds.size > 0) {
        const classDocs = await Class.find({
          school: schoolId,
          $or: children.map((c) => ({ name: c.class, section: c.section || "" })),
        })
          .select("name section classTeacher")
          .lean();
        const teacherByClassKey = new Map(classDocs.map((c) => [`${c.name}::${c.section || ""}`, c.classTeacher ? String(c.classTeacher) : null]));
        for (const child of children) {
          const teacherId = teacherByClassKey.get(`${child.class}::${child.section || ""}`);
          if (!teacherId) continue;
          const arr = teacherChildNames.get(teacherId) || [];
          arr.push(child.name);
          teacherChildNames.set(teacherId, arr);
        }
      }

      const teachers = classTeacherIds.size
        ? await Teacher.find({ _id: { $in: [...classTeacherIds] }, school: schoolId, isActive: true }).select("name")
        : [];
      const teacherContacts = teachers.map((t) =>
        baseContact(String(t._id), t.name, "teacher", formatChildrenSubtitle(teacherChildNames.get(String(t._id)) || [])),
      );

      contacts = [adminContact, ...(await enrichWithConversations(teacherContacts, auth.id, String(schoolId)))];
      needsEnrich = false;
    }

    if (needsEnrich) {
      contacts = await enrichWithConversations(contacts, auth.id, String(schoolId));
    }

    // Safety net: never let an existing conversation become invisible just
    // because the current role/relationship rules no longer surface it
    // (e.g. a class-teacher reassignment after messages were already
    // exchanged) — this is also what keeps /api/chat/unread's count from
    // ever drifting from what's actually reachable here.
    if (auth.role === "teacher" || auth.role === "parent") {
      contacts = await appendOrphanConversations(contacts, auth.id, String(schoolId));
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

function formatChildrenSubtitle(names: string[]): string {
  if (names.length === 0) return "Class Teacher";
  if (names.length === 1) return `${names[0]}'s Class Teacher`;
  const label = `${names.slice(0, -1).join(", ")} & ${names[names.length - 1]}`;
  return `${label}'s Class Teacher`;
}

function baseContact(id: string, name: string, role: Contact["role"], subtitle: string): Contact {
  return {
    id, name, role, subtitle,
    conversationId: null, lastMessage: "", time: null, unread: 0,
    targetUserId: id, targetRole: role, childId: null,
  };
}

interface ConversationLean {
  _id: unknown;
  participants: { userId: unknown; role: Contact["role"]; name: string; unread: number }[];
  childId: unknown;
  lastMessage: string;
  lastMessageAt: Date;
}

function roleLabel(role: Contact["role"]): string {
  if (role === "teacher") return "Teacher";
  if (role === "parent") return "Parent";
  return "School Admin";
}

function conversationToContact(conv: ConversationLean, userId: string): Contact | null {
  const me = conv.participants.find((p) => String(p.userId) === userId);
  const other = conv.participants.find((p) => String(p.userId) !== userId);
  if (!other) return null;
  return {
    id: String(other.userId),
    name: other.name,
    role: other.role,
    subtitle: roleLabel(other.role),
    conversationId: String(conv._id),
    lastMessage: conv.lastMessage || "",
    time: conv.lastMessageAt || null,
    unread: me?.unread || 0,
    targetUserId: String(other.userId),
    targetRole: other.role,
    childId: conv.childId ? String(conv.childId) : null,
  };
}

async function enrichWithConversations(contacts: Contact[], userId: string, schoolId: string): Promise<Contact[]> {
  return Promise.all(
    contacts.map(async (c) => {
      const conv = await Conversation.findOne({
        school: schoolId,
        "participants.userId": { $all: [userId, c.targetUserId] },
        childId: null,
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

async function appendOrphanConversations(contacts: Contact[], userId: string, schoolId: string): Promise<Contact[]> {
  const known = new Set(contacts.map((c) => `${c.targetUserId}::${c.childId || ""}`));
  const conversations = await Conversation.find({ school: schoolId, "participants.userId": userId }).lean();
  const extra: Contact[] = [];
  for (const conv of conversations) {
    const contact = conversationToContact(conv as unknown as ConversationLean, userId);
    if (!contact) continue;
    const key = `${contact.targetUserId}::${contact.childId || ""}`;
    if (known.has(key)) continue;
    known.add(key);
    extra.push(contact);
  }
  return [...contacts, ...extra];
}
