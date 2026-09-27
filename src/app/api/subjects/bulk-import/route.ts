import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Subject } from "@/models/Subject";
import { parseWorkbookRows } from "@/lib/excelImport";
import { SUBJECT_KEYS } from "@/lib/bulkImportFields";

const MAX_ROWS = 500;
const MAX_FILE_BYTES = 5 * 1024 * 1024;

function requireSchoolAdmin(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") return null;
  return auth;
}

// Mirrors generateCode() in api/subjects/route.ts — first-letter-of-each-word
// (max 4 chars) or first 4 letters for a single word, disambiguated on
// collision against the DB. Rows are created sequentially, so codes already
// written by earlier rows are visible to later generateCode() calls.
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

interface RowResult {
  row: number;
  name: string;
  status: "created" | "failed";
  message?: string;
}

export async function POST(req: Request) {
  const auth = requireSchoolAdmin(req);
  if (!auth) return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });

  try {
    const formData = await req.formData();
    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ success: false, message: "No file uploaded." }, { status: 400 });
    }
    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json({ success: false, message: "File is too large — must be under 5 MB." }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const rawRows = await parseWorkbookRows(buffer);
    if (rawRows.length === 0) {
      return NextResponse.json({ success: false, message: "No data rows found in the uploaded file." }, { status: 400 });
    }
    if (rawRows.length > MAX_ROWS) {
      return NextResponse.json(
        { success: false, message: `Too many rows — upload at most ${MAX_ROWS} subjects at a time.` },
        { status: 400 },
      );
    }

    await connectDB();

    const existingSubjects = await Subject.find({ school: auth.schoolId }).select("name");
    // Case-insensitive names: covers duplicates against the DB and against
    // earlier rows in the same file.
    const usedNames = new Set(existingSubjects.map((s) => s.name.trim().toLowerCase()));

    const results: RowResult[] = [];

    for (let i = 0; i < rawRows.length; i++) {
      const excelRow = i + 2;
      const row = rawRows[i];
      const name = (row[SUBJECT_KEYS.name] || "").trim();

      const fail = (message: string) => results.push({ row: excelRow, name: name || "(no name)", status: "failed", message });

      if (!name) { fail("Subject name is required."); continue; }

      const nameKey = name.toLowerCase();
      if (usedNames.has(nameKey)) { fail(`Subject "${name}" already exists.`); continue; }
      usedNames.add(nameKey);

      const description = (row[SUBJECT_KEYS.description] || "").trim();

      try {
        const code = await generateCode(auth.schoolId, name);
        await Subject.create({ name, code, description, school: auth.schoolId });
        results.push({ row: excelRow, name, status: "created" });
      } catch (err) {
        results.push({ row: excelRow, name, status: "failed", message: err instanceof Error ? err.message : "Failed to create subject." });
      }
    }

    const created = results.filter((r) => r.status === "created");
    const failed = results.filter((r) => r.status === "failed");

    return NextResponse.json({
      success: true,
      message: `${created.length} subject${created.length === 1 ? "" : "s"} created${failed.length > 0 ? `, ${failed.length} failed` : ""}.`,
      data: { createdCount: created.length, failedCount: failed.length, results },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to process the uploaded file." },
      { status: 500 },
    );
  }
}
