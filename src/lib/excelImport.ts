import ExcelJS from "exceljs";

export interface TemplateColumn {
  key: string;
  label: string;
  width?: number;
}

// Builds a one-sheet .xlsx with a styled header row and one filled-in
// example row underneath it, so the admin has both the exact column names
// bulk-import expects and a concrete sample of the expected format (dates,
// phone digits, etc.) without needing separate written instructions.
export async function buildTemplateWorkbook(columns: TemplateColumn[], sampleRow: Record<string, string>): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Template");

  sheet.columns = columns.map((c) => ({ header: c.label, key: c.key, width: c.width ?? 22 }));
  sheet.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
  sheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
  sheet.getRow(1).alignment = { vertical: "middle" };
  sheet.addRow(columns.map((c) => sampleRow[c.key] ?? ""));

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

// Reads the first worksheet of an uploaded .xlsx/.xls/.csv into plain row
// objects keyed by the *normalized* header text (lowercased, trimmed,
// non-alphanumerics stripped) so lookups can tolerate the header label's
// punctuation/hints (e.g. "Date of Birth* (YYYY-MM-DD)") without requiring
// an exact match. Blank rows (every cell empty) are skipped.
export async function parseWorkbookRows(buffer: Buffer): Promise<Record<string, string>[]> {
  const workbook = new ExcelJS.Workbook();
  // exceljs's bundled .d.ts predates the newer resizable-ArrayBuffer members
  // TypeScript's lib now adds to Buffer's structural shape — a real Buffer
  // satisfies this at runtime regardless, so `any` sidesteps the mismatch.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  await workbook.xlsx.load(buffer as any);
  const sheet = workbook.worksheets[0];
  if (!sheet) return [];

  const headerRow = sheet.getRow(1);
  const headers: (string | null)[] = [];
  headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
    const raw = cell.value != null ? String(cell.value).trim() : "";
    headers[colNumber] = raw ? normalizeHeader(raw) : null;
  });

  const rows: Record<string, string>[] = [];
  for (let r = 2; r <= sheet.rowCount; r++) {
    const row = sheet.getRow(r);
    const obj: Record<string, string> = {};
    let hasValue = false;
    row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      const key = headers[colNumber];
      if (!key) return;
      let value = cell.value;
      if (value && typeof value === "object" && "text" in value) value = (value as { text: string }).text;
      if (value instanceof Date) value = value.toISOString().slice(0, 10);
      const str = value != null ? String(value).trim() : "";
      if (str) hasValue = true;
      obj[key] = str;
    });
    if (hasValue) rows.push(obj);
  }
  return rows;
}

function normalizeHeader(label: string): string {
  return label
    .toLowerCase()
    .replace(/\*/g, "")
    .replace(/\([^)]*\)/g, "")
    .replace(/[^a-z0-9]/g, "");
}

// Maps a template's {key, label} pairs to the same normalized form used by
// parseWorkbookRows, so a route can look up `row[fieldKeys.name]` instead of
// re-deriving the normalized header string itself.
export function normalizedKeys<T extends Record<string, string>>(labels: T): T {
  const out = {} as T;
  for (const key of Object.keys(labels) as (keyof T)[]) {
    out[key] = normalizeHeader(labels[key]) as T[keyof T];
  }
  return out;
}
