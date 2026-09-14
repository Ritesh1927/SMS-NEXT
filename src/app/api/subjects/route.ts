import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Subject } from "@/models/Subject";

function requireSchoolAdmin(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") return null;
  return auth;
}

// Auto-generates a code from the subject name, first-letter-of-each-word
// for multi-word names (max 4 chars) or the first 4 letters for a single
// word, then disambiguates on collision — matches SMS-BACKEND's
// createSubject exactly.
async function generateCode(schoolId: string, name: string): Promise<string> {
  const words = name.trim().split(/\s+/);
  const base = words.length === 1 ? words[0].substring(0, 4).toUpperCase() : words.map((w) => w[0]).join("").toUpperCase().substring(0, 4);

  let code = base;
  let counter = 1;
  while (await Subject.findOne({ school: schoolId, code })) {
    counter++;
    code = base.substring(0, 3) + counter;
  }
  return code;
}

export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const subjects = await Subject.find({ school: auth.schoolId }).sort({ createdAt: -1 });
    return NextResponse.json({ success: true, data: subjects });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load subjects." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  const auth = requireSchoolAdmin(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    const { name, description } = await req.json();
    if (!name || !String(name).trim()) {
      return NextResponse.json({ success: false, message: "Subject name is required." }, { status: 400 });
    }

    await connectDB();
    const code = await generateCode(auth.schoolId, name);

    const subject = await Subject.create({
      name: String(name).trim(),
      code,
      description: String(description || "").trim(),
      school: auth.schoolId,
    });

    return NextResponse.json({ success: true, message: "Subject created.", data: subject }, { status: 201 });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to create subject." },
      { status: 500 },
    );
  }
}
