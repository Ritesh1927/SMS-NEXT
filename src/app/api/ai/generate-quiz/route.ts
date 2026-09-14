import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { chat } from "@/lib/ai";

export async function POST(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { subject, topic, class: cls, count } = await req.json();
    const prompt = `Generate ${count || 5} multiple choice questions for:
- Subject: ${subject}, Topic: ${topic}, Class: ${cls}

Format as JSON array: [{"question":"...","options":["A)...","B)...","C)...","D)..."],"correct":"A","explanation":"..."}]
Return ONLY the JSON array, no extra text.`;

    const raw = await chat([{ role: "user", content: prompt }], 1200);
    let questions: unknown;
    try {
      questions = JSON.parse(raw.replace(/```json|```/g, "").trim());
    } catch {
      questions = raw;
    }
    return NextResponse.json({ success: true, questions });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to generate quiz." },
      { status: 500 },
    );
  }
}
