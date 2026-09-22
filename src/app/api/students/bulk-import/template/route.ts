import { NextResponse } from "next/server";
import { getAuthUser } from "@/lib/auth-server";
import { buildTemplateWorkbook } from "@/lib/excelImport";
import { STUDENT_TEMPLATE_COLUMNS, STUDENT_SAMPLE_ROW } from "@/lib/bulkImportFields";

export async function GET(req: Request) {
  const auth = getAuthUser(req);
  if (!auth || auth.role !== "schooladmin") {
    return NextResponse.json({ success: false, message: "Unauthorized." }, { status: 401 });
  }

  const buffer = await buildTemplateWorkbook(STUDENT_TEMPLATE_COLUMNS, STUDENT_SAMPLE_ROW);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="student_bulk_upload_template.xlsx"',
    },
  });
}
