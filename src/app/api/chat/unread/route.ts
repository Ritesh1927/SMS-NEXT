import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Conversation } from "@/models/Conversation";

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
    }).select("participants");

    let total = 0;
    for (const conv of conversations) {
      const me = conv.participants.find((p) => String(p.userId) === auth.id);
      if (me) total += me.unread;
    }

    return NextResponse.json({ success: true, total });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load unread count." },
      { status: 500 },
    );
  }
}
