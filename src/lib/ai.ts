import Groq from "groq-sdk";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

function getGroq(): Groq {
  if (!process.env.GROQ_API_KEY) throw new Error("GROQ_API_KEY is not set. Add it to .env.local");
  return new Groq({ apiKey: process.env.GROQ_API_KEY });
}

// Same model SMS-BACKEND already uses — keeps behavior/cost parity with the
// original app rather than picking a new provider for this port.
export async function chat(messages: ChatMessage[], maxTokens = 1024): Promise<string> {
  const groq = getGroq();
  const res = await groq.chat.completions.create({
    model: "openai/gpt-oss-20b",
    messages,
    max_tokens: maxTokens,
  });
  return res.choices[0].message.content || "";
}
