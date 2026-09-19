import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireFeeManager } from "@/lib/auth-server";
import { FeeStructure, type FeeFrequency } from "@/models/FeeStructure";
import { FeePayment } from "@/models/FeePayment";
import { Student } from "@/models/Student";

interface FeeHeadInput {
  title: string;
  amount: number;
  frequency?: FeeFrequency;
  dueDate?: string;
  description?: string;
}

// POST /api/fees/structures/batch — create several fee heads for one class
// in a single call (e.g. Tuition + Transport + Lab all at once), each
// auto-assigning pending FeePayment rows to every active student in the
// class, mirroring SMS-BACKEND's batchCreateFeeStructures.
export async function POST(req: Request) {
  await connectDB();
  const result = await requireFeeManager(req);
  if ("error" in result) return result.error;
  const { auth } = result;

  try {
    const { class: cls, academicYear, fees } = (await req.json()) as {
      class: string;
      academicYear?: string;
      fees: FeeHeadInput[];
    };

    if (!cls || !fees || !Array.isArray(fees) || fees.length === 0) {
      return NextResponse.json({ success: false, message: "Class and at least one fee head are required." }, { status: 400 });
    }
    for (const f of fees) {
      if (!f.title || !f.amount) {
        return NextResponse.json({ success: false, message: "Each fee head needs title and amount." }, { status: 400 });
      }
    }

    const students = await Student.find({ school: auth.schoolId, class: cls, isActive: true }).select("_id");

    const results = [];
    for (const f of fees) {
      const resolvedDueDate =
        f.dueDate ||
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
        title: f.title,
        amount: f.amount,
        dueDate: resolvedDueDate,
        frequency: f.frequency || "monthly",
        description: f.description || "",
        academicYear: academicYear || "",
      });

      if (students.length > 0) {
        const bulk = students.map((s) => ({
          school: auth.schoolId,
          student: s._id,
          feeStructure: fee._id,
          title: f.title,
          amount: f.amount,
          paidAmount: 0,
          dueDate: new Date(resolvedDueDate),
          status: new Date(resolvedDueDate) < new Date() ? "overdue" : "pending",
          paymentMode: "cash",
        }));
        await FeePayment.insertMany(bulk, { ordered: false });
      }
      results.push(fee);
    }

    return NextResponse.json(
      { success: true, message: `${results.length} fee structure(s) created.`, data: results },
      { status: 201 },
    );
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to create fee structures." },
      { status: 500 },
    );
  }
}
