import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser, requireFeeManager } from "@/lib/auth-server";
import { FeeStructure } from "@/models/FeeStructure";
import { FeePayment } from "@/models/FeePayment";
import { Student } from "@/models/Student";

export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || (auth.role !== "schooladmin" && auth.role !== "teacher")) {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const { searchParams } = new URL(req.url);
    const cls = searchParams.get("class");

    const query: Record<string, unknown> = { school: auth.schoolId, isActive: true };
    if (cls) query.class = cls;

    const fees = await FeeStructure.find(query).sort({ class: 1, createdAt: -1 });
    return NextResponse.json({ success: true, data: fees });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load fee structures." },
      { status: 500 },
    );
  }
}

export async function POST(req: Request) {
  await connectDB();
  const result = await requireFeeManager(req);
  if ("error" in result) return result.error;
  const { auth } = result;

  try {
    const { class: cls, title, amount, dueDate, frequency, description, academicYear } = await req.json();
    if (!cls || !title || !amount) {
      return NextResponse.json({ success: false, message: "Class, title and amount are required." }, { status: 400 });
    }

    const resolvedDueDate =
      dueDate ||
      (() => {
        const d = new Date();
        d.setDate(1);
        d.setMonth(d.getMonth() + 1);
        d.setDate(0);
        return d.toISOString().slice(0, 10);
      })();

    const fee = await FeeStructure.create({
      school: auth.schoolId,
      class: cls,
      title,
      amount,
      dueDate: resolvedDueDate,
      frequency: frequency || "monthly",
      description: description || "",
      academicYear: academicYear || "",
    });

    // Auto-assign a pending payment record to every active student in this
    // class, matching SMS-BACKEND's createFeeStructure — so the payments
    // list is populated immediately instead of needing a separate "collect"
    // step per student just to create the row.
    const students = await Student.find({ school: auth.schoolId, class: cls, isActive: true }).select("_id");
    if (students.length > 0) {
      const bulk = students.map((s) => ({
        school: auth.schoolId,
        student: s._id,
        feeStructure: fee._id,
        title,
        amount: parseFloat(amount),
        paidAmount: 0,
        dueDate: new Date(resolvedDueDate),
        status: new Date(resolvedDueDate) < new Date() ? "overdue" : "pending",
        paymentMode: "cash",
      }));
      await FeePayment.insertMany(bulk, { ordered: false });
    }

    return NextResponse.json(
      { success: true, message: `Fee structure created and assigned to ${students.length} student(s).`, data: fee },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to create fee structure." },
      { status: 500 },
    );
  }
}
