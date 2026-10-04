import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { requireFeeManager } from "@/lib/auth-server";
import { FeeStructure, findDuplicateFeeStructures, type FeeFrequency } from "@/models/FeeStructure";
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
      f.title = String(f.title).trim();
    }

    // All-or-nothing duplicate guard — nothing is created if any check
    // fails, so a partial batch can never slip through. Same rule as the
    // single-create endpoint: one active head per class+title.
    const norm = (t: string) => t.trim().toLowerCase();
    const seen = new Set<string>();
    for (const f of fees) {
      const key = norm(f.title);
      if (seen.has(key)) {
        return NextResponse.json(
          { success: false, message: `Duplicate fee head "${f.title}" appears more than once in this list.` },
          { status: 400 },
        );
      }
      seen.add(key);
    }
    const dups = await findDuplicateFeeStructures(auth.schoolId, cls, fees.map((f) => f.title));
    if (dups.length > 0) {
      return NextResponse.json(
        {
          success: false,
          message: `Fee head(s) already exist for Class ${cls}: ${dups.map((d) => d.title).join(", ")}. Edit or delete them instead.`,
        },
        { status: 409 },
      );
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
