import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { chat } from "@/lib/ai";

export async function POST(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { topic, category, schoolName, details } = await req.json();
    const prompt = `Write a formal school notice for:
- School: ${schoolName || "Our School"}
- Topic: ${topic}
- Category: ${category || "general"}
- Key details: ${details || ""}

Format: Title, Date, Body (2-3 paragraphs), Closing. Keep it professional and clear.`;

    const notice = await chat([{ role: "user", content: prompt }], 500);
    return NextResponse.json({ success: true, notice });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to generate notice." },
      { status: 500 },
    );
  }
}
