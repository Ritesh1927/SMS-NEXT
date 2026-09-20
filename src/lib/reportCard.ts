import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ReportCardRow {
  subject: string;
  date: string;
  totalMarks: number;
  marksObtained: number;
  percentage: number;
  grade: string;
  remarks?: string;
  isAbsent: boolean;
  isPassed: boolean;
}

export interface ReportCardData {
  school: {
    schoolName?: string;
    schoolAddress?: string;
    schoolPhone?: string;
    schoolEmail?: string;
    logo?: string;
    themeColor?: string;
    secondaryColor?: string;
  };
  studentName: string;
  studentClass: string;
  studentSection?: string;
  studentId?: string;
  rollNumber?: string;
  examTitle: string;
  examDateRange?: string;
  generatedDate: string;
  rows: ReportCardRow[];
  averagePercentage: number;
}

// Mirrors src/lib/receipt.ts's helpers -- kept local since neither is
// exported there, and each formal-document generator here is self-contained.
function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

function drawLogo(doc: jsPDF, logoData: string, x: number, y: number, maxW: number, maxH: number) {
  try {
    const match = logoData.match(/^data:image\/(\w+);base64,(.+)$/);
    if (!match) return;
    // The uploaded logo can be any image type (the settings page accepts
    // whatever the browser file picker allows) -- jsPDF needs the real
    // format, not a hardcoded guess, or it silently mis-renders or throws.
    const format = match[1].toUpperCase() === "JPG" ? "JPEG" : match[1].toUpperCase();
    doc.addImage(match[2], format, x, y, maxW, maxH);
  } catch {
    // ignore malformed/unsupported logo data — report card still renders without it
  }
}

function gradeColor(grade: string): [number, number, number] {
  if (grade === "A+" || grade === "A") return [22, 130, 70];
  if (grade === "B+" || grade === "B") return [37, 99, 200];
  if (grade === "C" || grade === "D") return [180, 130, 20];
  return [190, 40, 40];
}

function overallResultLabel(rows: ReportCardRow[]): { label: string; color: [number, number, number] } {
  const attempted = rows.filter((r) => !r.isAbsent);
  if (attempted.length === 0) return { label: "N/A", color: [120, 120, 120] };
  return attempted.every((r) => r.isPassed) ? { label: "PASS", color: [22, 130, 70] } : { label: "FAIL", color: [190, 40, 40] };
}

function buildReportCardDoc(data: ReportCardData): jsPDF {
  const doc = new jsPDF("p", "mm", "a4");
  const W = 210;
  const H = 297;
  const p = hexToRgb(data.school.themeColor || "#6366f1");
  const s = hexToRgb(data.school.secondaryColor || "#8B5CF6");

  // ─── HEADER ─────────────────────────────────────────────────────
  doc.setFillColor(...p);
  doc.rect(0, 0, W, 10, "F");
  doc.setFillColor(...s);
  doc.triangle(0, 10, W, 10, W, 30, "F");
  doc.setFillColor(...p);
  doc.triangle(0, 10, 0, 30, W, 30, "F");

  if (data.school.logo) drawLogo(doc, data.school.logo, 16, 14, 22, 22);

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.setFont("helvetica", "bold");
  doc.text(data.school.schoolName || "School Name", W / 2, 20, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const contact = [data.school.schoolAddress, data.school.schoolPhone, data.school.schoolEmail].filter(Boolean).join("  |  ");
  if (contact) doc.text(contact, W / 2, 26, { align: "center" });

  // ─── Title ──────────────────────────────────────────────────────
  doc.setTextColor(...p);
  doc.setFontSize(20);
  doc.setFont("helvetica", "bold");
  doc.text("ACADEMIC REPORT CARD", W / 2, 42, { align: "center" });
  doc.setDrawColor(...p);
  doc.setLineWidth(1.2);
  doc.line(66, 45, 144, 45);

  // ─── Student info + Exam info ────────────────────────────────────
  const infoY = 53;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...p);
  doc.text("STUDENT", 14, infoY);

  doc.setFontSize(13);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text(data.studentName, 14, infoY + 8);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`Class: ${data.studentClass}${data.studentSection ? ` - ${data.studentSection}` : ""}`, 14, infoY + 14);
  if (data.rollNumber) doc.text(`Roll No: ${data.rollNumber}`, 14, infoY + 20);
  if (data.studentId) doc.text(`Student ID: ${data.studentId}`, 14, infoY + 26);

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...p);
  doc.text("EXAMINATION", 135, infoY);

  doc.setFontSize(11);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text(data.examTitle, 135, infoY + 8);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  if (data.examDateRange) doc.text(data.examDateRange, 135, infoY + 14);
  doc.text(`Generated: ${data.generatedDate}`, 135, infoY + 20);

  // ─── RESULTS TABLE ────────────────────────────────────────────────
  const tableY = infoY + 34;

  autoTable(doc, {
    startY: tableY,
    head: [["Subject", "Date", "Total", "Marks", "%", "Grade", "Remarks", "Result"]],
    body: data.rows.map((r) => [
      r.subject,
      r.date,
      String(r.totalMarks),
      r.isAbsent ? "—" : String(r.marksObtained),
      r.isAbsent ? "—" : `${r.percentage}%`,
      r.isAbsent ? "AB" : r.grade,
      r.remarks || "—",
      r.isAbsent ? "Absent" : r.isPassed ? "Pass" : "Fail",
    ]),
    theme: "grid",
    headStyles: { fillColor: p, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 9, halign: "center", cellPadding: 4 },
    columnStyles: {
      0: { cellWidth: 34, fontStyle: "bold" },
      1: { cellWidth: 22 },
      2: { cellWidth: 16, halign: "center" },
      3: { cellWidth: 20, halign: "center" },
      4: { cellWidth: 14, halign: "center" },
      5: { cellWidth: 19, halign: "center", fontStyle: "bold" },
      6: { cellWidth: 35 },
      7: { cellWidth: 22, halign: "center", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: [250, 248, 245] },
    styles: { fontSize: 8.5, textColor: [50, 50, 50], cellPadding: 4, halign: "left" },
    margin: { left: 14, right: 14 },
    didParseCell: (hookData) => {
      if (hookData.section !== "body") return;
      const row = data.rows[hookData.row.index];
      if (hookData.column.index === 5 && !row.isAbsent) hookData.cell.styles.textColor = gradeColor(row.grade);
      if (hookData.column.index === 7) hookData.cell.styles.textColor = row.isAbsent ? [120, 120, 120] : row.isPassed ? [22, 130, 70] : [190, 40, 40];
    },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || tableY + 20;

  // ─── SUMMARY ──────────────────────────────────────────────────────
  const attempted = data.rows.filter((r) => !r.isAbsent);
  const passedCount = attempted.filter((r) => r.isPassed).length;
  const absentCount = data.rows.length - attempted.length;
  const overall = overallResultLabel(data.rows);

  const sumX = 110;
  const sumW = 82;
  const rowH = 9;
  let sy = finalY + 10;

  const drawRow = (label: string, value: string, bgColor: [number, number, number], textColor: [number, number, number]) => {
    doc.setFillColor(...bgColor);
    doc.rect(sumX, sy - 5, sumW, rowH, "F");
    doc.setFontSize(10);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(...textColor);
    doc.text(label, sumX + 4, sy);
    doc.text(value, sumX + sumW - 4, sy, { align: "right" });
    sy += rowH;
  };

  drawRow("Subjects Appeared:", `${attempted.length} of ${data.rows.length}`, [245, 245, 250], [80, 80, 80]);
  drawRow("Subjects Passed:", `${passedCount} of ${attempted.length}`, [240, 255, 240], [30, 140, 60]);
  if (absentCount > 0) drawRow("Absent:", `${absentCount}`, [255, 248, 235], [180, 130, 20]);

  sy += 2;
  doc.setFillColor(...p);
  doc.rect(sumX, sy - 6, sumW, rowH + 2, "F");
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("AVERAGE:", sumX + 4, sy + 1);
  doc.text(`${data.averagePercentage}%`, sumX + sumW - 4, sy + 1, { align: "right" });
  sy += rowH + 4;

  doc.setFillColor(...overall.color);
  doc.rect(sumX, sy - 6, sumW, rowH + 2, "F");
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("OVERALL RESULT:", sumX + 4, sy + 1);
  doc.text(overall.label, sumX + sumW - 4, sy + 1, { align: "right" });

  // ─── Grading scale ──────────────────────────────────────────────
  const scaleY = sy + 14;
  doc.setTextColor(...p);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("Grading Scale:", 14, scaleY);
  doc.setTextColor(110, 110, 110);
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text("A+: 90-100  ·  A: 80-89  ·  B+: 70-79  ·  B: 60-69  ·  C: 50-59  ·  D: 33-49  ·  F: Below 33  ·  AB: Absent", 14, scaleY + 5);

  // ─── Signatures ─────────────────────────────────────────────────
  const sigY = Math.min(scaleY + 28, H - 32);
  doc.setDrawColor(160, 160, 160);
  doc.setLineWidth(0.3);
  doc.line(14, sigY, 64, sigY);
  doc.line(146, sigY, 196, sigY);
  doc.setTextColor(90, 90, 90);
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  doc.text("Class Teacher", 39, sigY + 5, { align: "center" });
  doc.text("Principal", 171, sigY + 5, { align: "center" });

  // ─── FOOTER ─────────────────────────────────────────────────────
  doc.setFillColor(...p);
  doc.rect(0, H - 16, W, 16, "F");
  doc.setFillColor(...s);
  doc.triangle(0, H - 26, W, H - 26, 0, H - 16, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("This is a computer-generated report card and does not require a signature.", W / 2, H - 9, { align: "center" });

  return doc;
}

export function downloadReportCard(data: ReportCardData, filename: string): void {
  const doc = buildReportCardDoc(data);
  doc.save(filename);
}
