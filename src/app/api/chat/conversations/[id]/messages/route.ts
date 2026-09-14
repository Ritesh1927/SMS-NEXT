import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Conversation, type ChatRole } from "@/models/Conversation";
import { Message } from "@/models/Message";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || !["schooladmin", "teacher", "parent"].includes(auth.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const page = Number(searchParams.get("page")) || 1;
    const limit = Number(searchParams.get("limit")) || 50;
    const after = searchParams.get("after"); // ISO timestamp — for lightweight polling

    await connectDB();

    const conversation = await Conversation.findOne({ _id: id, "participants.userId": auth.id });
    if (!conversation) {
      return NextResponse.json({ success: false, message: "Conversation not found." }, { status: 404 });
    }

    let messages;
    if (after) {
      // Poll mode: only what's new since the client's last-seen message, no
      // pagination/skip math and no read-state side effects (the client is
      // just topping up an open thread, not "opening" it).
      messages = await Message.find({ conversation: id, createdAt: { $gt: new Date(after) } }).sort({ createdAt: 1 });
      return NextResponse.json({ success: true, messages });
    }

    messages = await Message.find({ conversation: id })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    await Message.updateMany(
      { conversation: id, sender: { $ne: auth.id }, read: false },
      { $set: { read: true, readAt: new Date() } },
    );
    await Conversation.updateOne(
      { _id: id, "participants.userId": auth.id },
      { $set: { "participants.$.unread": 0 } },
    );

    return NextResponse.json({ success: true, messages: messages.reverse() });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load messages." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || !["schooladmin", "teacher", "parent"].includes(auth.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { id } = await params;
    const { text } = await req.json();
    if (!text || !text.trim()) {
      return NextResponse.json({ success: false, message: "Message text required." }, { status: 400 });
    }

    await connectDB();

    const conversation = await Conversation.findOne({
      _id: id,
      school: auth.schoolId,
      "participants.userId": auth.id,
    });
    if (!conversation) {
      return NextResponse.json({ success: false, message: "Conversation not found." }, { status: 404 });
    }

    const me = conversation.participants.find((p) => String(p.userId) === auth.id);

    const message = await Message.create({
      conversation: id,
      sender: auth.id,
      senderRole: auth.role as ChatRole,
      senderName: me?.name || "",
      text: text.trim(),
      school: auth.schoolId,
    });

    const otherIndex = conversation.participants.findIndex((p) => String(p.userId) !== auth.id);

    await Conversation.updateOne(
      { _id: id },
      {
        $set: { lastMessage: text.trim(), lastMessageAt: new Date(), lastSenderId: auth.id },
        ...(otherIndex >= 0 ? { $inc: { [`participants.${otherIndex}.unread`]: 1 } } : {}),
      },
    );

    return NextResponse.json({ success: true, message }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to send message." },
      { status: 500 },
    );
  }
}
