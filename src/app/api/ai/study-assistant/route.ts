import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { chat, type ChatMessage } from "@/lib/ai";

// POST /api/ai/study-assistant — the one generic chat endpoint every AI tool
// panel on the client funnels through (tutor-style Q&A, homework help,
// admin insights chat, and even the report-card/fee-letter/event-planner
// "generators" — those are just client-built prompts sent here as
// `question`). Matches SMS-FRONTEND's AiPage.tsx exactly: none of those
// tools actually call their own dedicated backend routes.
//
// No student role exists in sms-next, so the plain student-tutor framing
// (subject !== "school management") is kept only for teacher/admin use —
// e.g. a teacher asking a subject question while drafting homework help.
export async function POST(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { question, subject, conversationHistory, schoolContext } = await req.json();
    if (!question) {
      return NextResponse.json({ success: false, message: "Question required." }, { status: 400 });
    }

    const isAdmin = subject === "school management";
    let systemPrompt: string;
    if (isAdmin) {
      systemPrompt =
        "You are a helpful school management AI assistant for the school admin. " +
        "Respond naturally to greetings and general conversation. " +
        "When asked about school data (students, fees, attendance, teachers, classes, results), " +
        "answer directly and specifically using the live school data provided below. " +
        "Always mention names, amounts, and specific details from the data. " +
        "Never say data is unavailable if it is present in the school data section.\n\n" +
        (schoolContext || "");
    } else {
      systemPrompt =
        "You are a friendly and helpful school assistant for teachers and admins in India. " +
        "Answer questions clearly, use simple language, and give examples. " +
        "Subject context: " + (subject || "General");
    }

    const history: ChatMessage[] = Array.isArray(conversationHistory) ? conversationHistory : [];
    const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }, ...history, { role: "user", content: question }];
    const maxTok = isAdmin ? 2000 : 800;
    const answer = await chat(messages, maxTok);
    return NextResponse.json({ success: true, answer, subject });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "AI request failed." },
      { status: 500 },
    );
  }
}
