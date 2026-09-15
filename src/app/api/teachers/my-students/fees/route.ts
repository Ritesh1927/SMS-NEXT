import { NextResponse } from "next/server";
import { connectDB } from "@/lib/db";
import { getAuthUser } from "@/lib/auth-server";
import { Class } from "@/models/Class";
import { Student } from "@/models/Student";
import { FeePayment } from "@/models/FeePayment";

interface StudentFeeRow {
  _id: string;
  name: string;
  class: string;
  section: string;
  rollNumber: string;
  totalDue: number;
  totalPaid: number;
  pendingAmount: number;
  feeStatus: "clear" | "pending" | "partial" | "paid";
}

// GET /api/teachers/my-students/fees — read-only fee summary for the
// students in classes this teacher is the class teacher of. Matches
// SMS-BACKEND's getMyStudentsFees, minus the FeeInvoice fallback layer
// (sms-next only has FeePayment records, no separate invoice model).
export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "teacher") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  try {
    await connectDB();
    const ownedClasses = await Class.find({ classTeacher: auth.id, school: auth.schoolId }).select("name section").lean();

    if (ownedClasses.length === 0) {
      return NextResponse.json({
        success: true,
        count: 0,
        data: [],
        summary: { totalDue: 0, totalPaid: 0, totalPending: 0, paidCount: 0, pendingCount: 0 },
      });
    }

    const students = await Student.find({
      school: auth.schoolId,
      isActive: true,
      $or: ownedClasses.map((c) => ({ class: c.name, section: c.section })),
    })
      .select("name class section rollNumber studentId")
      .lean();

    const studentIds = students.map((s) => s._id);
    const feePayments = await FeePayment.find({ school: auth.schoolId, student: { $in: studentIds } })
      .select("student amount paidAmount")
      .lean();

    const rows: Record<string, StudentFeeRow> = {};
    for (const s of students) {
      rows[String(s._id)] = {
        _id: String(s._id),
        name: s.name,
        class: s.class,
        section: s.section,
        rollNumber: s.rollNumber || s.studentId || "",
        totalDue: 0,
        totalPaid: 0,
        pendingAmount: 0,
        feeStatus: "clear",
      };
    }
    for (const p of feePayments) {
      const row = rows[String(p.student)];
      if (!row) continue;
      row.totalDue += p.amount;
      row.totalPaid += p.paidAmount;
    }

    const data = Object.values(rows).map((row) => {
      row.pendingAmount = row.totalDue - row.totalPaid;
      if (row.totalDue === 0) row.feeStatus = "clear";
      else if (row.pendingAmount <= 0) row.feeStatus = "paid";
      else if (row.totalPaid > 0) row.feeStatus = "partial";
      else row.feeStatus = "pending";
      return row;
    });

    const totalDue = data.reduce((sum, s) => sum + s.totalDue, 0);
    const totalPaid = data.reduce((sum, s) => sum + s.totalPaid, 0);
    const totalPending = data.reduce((sum, s) => sum + Math.max(0, s.pendingAmount), 0);
    const paidCount = data.filter((s) => s.feeStatus === "paid" || s.feeStatus === "clear").length;
    const pendingCount = data.length - paidCount;

    return NextResponse.json({
      success: true,
      count: data.length,
      data,
      summary: { totalDue, totalPaid, totalPending, paidCount, pendingCount },
    });
  } catch (err) {
    return NextResponse.json(
      { success: false, message: err instanceof Error ? err.message : "Failed to load fee summary." },
      { status: 500 },
    );
  }
}
