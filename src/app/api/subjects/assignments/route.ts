import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Class } from "@/models/Class";
import "@/models/Subject";

// GET /api/subjects/assignments — every class with its assigned subjects
// populated, for the admin "assign" and "summary" tabs.
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const classes = await Class.find({ school: auth.schoolId })
      .populate("assignedSubjects", "name code description")
      .select("name section assignedSubjects")
      .sort({ name: 1, section: 1 });

    return NextResponse.json({ success: true, data: classes });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load assignments." },
      { status: 500 },
    );
  }
}
