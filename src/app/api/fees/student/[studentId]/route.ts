import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { FeePayment } from "@/models/FeePayment";
import { Parent } from "@/models/Parent";

// GET /api/fees/student/[studentId] — a student's fee records + paid/
// pending totals. Simplified from SMS-BACKEND's getStudentFees, which
// projects a full academic-year month-by-month schedule against fee
// structures; here the totals are summed directly from real FeePayment
// records, which already exist for every active student once a fee
// structure is created (see POST /api/fees/structures).
export async function GET(req: Request, { params }: { params: Promise<{ studentId: string }> }) {
  const auth = getAuthUser(req);
  if (!auth || !["schooladmin", "teacher", "parent"].includes(auth.role)) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    const { studentId } = await params;
    await connectDB();

    if (auth.role === "parent") {
      const parentDoc = await Parent.findById(auth.id);
      const childIds = (parentDoc?.students || []).map((id) => String(id));
      if (!childIds.includes(studentId)) {
        return NextResponse.json({ success: false, message: "Access denied." }, { status: 403 });
      }
    }

    const fees = await FeePayment.find({ student: studentId, school: auth.schoolId })
      .populate("feeStructure", "title class amount frequency")
      .sort({ createdAt: -1 });

    const paid = fees.filter((f) => f.status === "paid").reduce((s, f) => s + f.paidAmount, 0);
    const pending = fees.filter((f) => f.status !== "paid").reduce((s, f) => s + (f.amount - f.paidAmount), 0);

    return NextResponse.json({ success: true, data: { fees, summary: { paid, pending, total: paid + pending } } });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load fees." },
      { status: 500 },
    );
  }
}
