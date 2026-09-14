import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { LoginLog } from "@/models/LoginLog";

export async function DELETE(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { from, to } = await req.json();
    if (!from || !to) {
      return NextResponse.json({ success: false, message: "Both from and to dates are required." }, { status: 400 });
    }

    const result = await LoginLog.deleteMany({
      school: auth.schoolId,
      loginAt: { $gte: new Date(from), $lte: new Date(to + "T23:59:59.999Z") },
    });

    return NextResponse.json({ success: true, message: `Deleted ${result.deletedCount} login logs.`, deletedCount: result.deletedCount });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to purge login logs." },
      { status: 500 },
    );
  }
}
