import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Conversation } from "@/models/Conversation";
import { Teacher } from "@/models/Teacher";
import { Parent } from "@/models/Parent";
import { Admin } from "@/models/Admin";

// Explicit branching instead of an { role: Model } lookup table — indexing a
// table of differently-typed Mongoose models produces a union whose
// findById() overloads TypeScript can no longer resolve.
async function findUserName(role: string, id: string): Promise<string | null> {
  if (role === "teacher") return (await Teacher.findById(id).select("name"))?.name ?? null;
  if (role === "parent") return (await Parent.findById(id).select("name"))?.name ?? null;
  if (role === "schooladmin") return (await Admin.findById(id).select("name"))?.name ?? null;
  return null;
}

export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || !["schooladmin", "teacher", "parent"].includes(auth.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const conversations = await Conversation.find({
      school: auth.schoolId,
      "participants.userId": auth.id,
    }).sort({ lastMessageAt: -1 });

    const result = conversations.map((conv) => {
      const me = conv.participants.find((p) => String(p.userId) === auth.id);
      const other = conv.participants.find((p) => String(p.userId) !== auth.id);
      return {
        id: String(conv._id),
        conversationId: String(conv._id),
        name: other ? other.name : "Unknown",
        role: other ? other.role : "",
        lastMessage: conv.lastMessage,
        time: conv.lastMessageAt,
        unread: me?.unread || 0,
        targetUserId: other ? String(other.userId) : null,
        targetRole: other ? other.role : null,
      };
    });

    return NextResponse.json({ success: true, conversations: result });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load conversations." },
      { status: 500 },
    );
  }
}

// POST — get-or-create a conversation with a target contact.
export async function POST(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || !["schooladmin", "teacher", "parent"].includes(auth.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { targetUserId, targetRole, childId } = await req.json();
    if (!targetUserId || !targetRole) {
      return NextResponse.json({ success: false, message: "targetUserId and targetRole required." }, { status: 400 });
    }

    await connectDB();

    const query: Record<string, unknown> = {
      school: auth.schoolId,
      "participants.userId": { $all: [auth.id, targetUserId] },
    };
    if (childId && auth.role === "parent" && targetRole === "schooladmin") {
      query.childId = childId;
    } else {
      query.childId = null;
    }

    let conversation = await Conversation.findOne(query);

    if (!conversation) {
      if (!["teacher", "parent", "schooladmin"].includes(targetRole)) {
        return NextResponse.json({ success: false, message: "Invalid targetRole." }, { status: 400 });
      }
      const targetName = await findUserName(targetRole, targetUserId);
      if (!targetName) {
        return NextResponse.json({ success: false, message: "Target user not found." }, { status: 404 });
      }

      // Resolve this user's own display name for the participant record.
      const myName = await findUserName(auth.role, auth.id);

      conversation = await Conversation.create({
        school: auth.schoolId,
        participants: [
          { userId: auth.id, role: auth.role, name: myName || "", unread: 0 },
          { userId: targetUserId, role: targetRole, name: targetName, unread: 0 },
        ],
        childId: childId && auth.role === "parent" && targetRole === "schooladmin" ? childId : null,
        lastMessage: "",
        lastMessageAt: new Date(),
      });
    }

    return NextResponse.json({ success: true, conversationId: conversation._id, conversation });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to start conversation." },
      { status: 500 },
    );
  }
}
