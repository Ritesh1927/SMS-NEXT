import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export interface ReceiptData {
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
  receiptNumber: string;
  paymentDate: string;
  paymentMode: string;
  feeHeadTotals: {
    feeHead: string;
    month: string;
    amount: number;
    lateFee?: number;
    concession?: number;
    total: number;
  }[];
  grandTotal: number;
}

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  return [parseInt(h.substring(0, 2), 16), parseInt(h.substring(2, 4), 16), parseInt(h.substring(4, 6), 16)];
}

function drawLogo(doc: jsPDF, logoData: string, x: number, y: number, maxW: number, maxH: number) {
  try {
    if (logoData.startsWith("data:image")) {
      const sub = logoData.substring(logoData.indexOf(",") + 1);
      doc.addImage(sub, "PNG", x, y, maxW, maxH);
      return true;
    }
  } catch {
    // ignore malformed logo data — receipt still renders without it
  }
  return false;
}

function buildReceiptDoc(data: ReceiptData): jsPDF {
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

  if (data.school.logo) {
    drawLogo(doc, data.school.logo, 16, 14, 22, 22);
  }

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(17);
  doc.setFont("helvetica", "bold");
  doc.text(data.school.schoolName || "School Name", W / 2, 20, { align: "center" });
  doc.setFontSize(8);
  doc.setFont("helvetica", "normal");
  const contact = [data.school.schoolAddress, data.school.schoolPhone, data.school.schoolEmail].filter(Boolean).join("  |  ");
  if (contact) doc.text(contact, W / 2, 26, { align: "center" });

  // ─── FEE RECEIPT title ──────────────────────────────────────────
  doc.setTextColor(...p);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("FEE RECEIPT", W / 2, 42, { align: "center" });
  doc.setDrawColor(...p);
  doc.setLineWidth(1.2);
  doc.line(78, 45, 132, 45);

  // ─── Student info + Invoice info ────────────────────────────────
  const infoY = 53;

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(...p);
  doc.text("INVOICE TO", 14, infoY);

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text(data.studentName, 14, infoY + 8);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(80, 80, 80);
  doc.text(`Class: ${data.studentClass}${data.studentSection ? ` - ${data.studentSection}` : ""}`, 14, infoY + 14);
  if (data.rollNumber) doc.text(`Roll No: ${data.rollNumber}`, 14, infoY + 20);
  if (data.studentId) doc.text(`Student ID: ${data.studentId}`, 14, infoY + 26);

  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(40, 40, 40);
  doc.text("Invoice No:", 135, infoY);
  doc.setFont("helvetica", "normal");
  doc.text(data.receiptNumber, 165, infoY);

  doc.setFont("helvetica", "bold");
  doc.text("Invoice Date:", 135, infoY + 7);
  doc.setFont("helvetica", "normal");
  doc.text(data.paymentDate, 165, infoY + 7);

  // ─── FEE TABLE ──────────────────────────────────────────────────
  const tableY = infoY + 34;

  autoTable(doc, {
    startY: tableY,
    head: [["NO.", "FEE DESCRIPTION", "AMOUNT"]],
    body: data.feeHeadTotals.map((f, i) => [String(i + 1).padStart(2, "0"), f.feeHead, `Rs. ${(f.amount || 0).toLocaleString("en-IN")}`]),
    theme: "grid",
    headStyles: { fillColor: p, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 10, halign: "center", cellPadding: 5 },
    columnStyles: {
      0: { cellWidth: 16, halign: "center", textColor: p, fontStyle: "bold" },
      1: { cellWidth: 118 },
      2: { cellWidth: 42, halign: "right", fontStyle: "bold" },
    },
    alternateRowStyles: { fillColor: [250, 248, 245] },
    styles: { fontSize: 9, textColor: [50, 50, 50], cellPadding: 5, halign: "left" },
    margin: { left: 14, right: 14 },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || tableY + 20;

  // ─── SUMMARY ──────────────────────────────────────────────────
  const totalBase = data.feeHeadTotals.reduce((sum, f) => sum + (f.amount || 0), 0);
  const totalLateFee = data.feeHeadTotals.reduce((sum, f) => sum + (f.lateFee || 0), 0);
  const totalConcession = data.feeHeadTotals.reduce((sum, f) => sum + (f.concession || 0), 0);

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

  drawRow("Subtotal:", `Rs. ${totalBase.toLocaleString("en-IN")}`, [245, 245, 250], [80, 80, 80]);

  const concessionStr = totalConcession > 0 ? `-Rs. ${totalConcession.toLocaleString("en-IN")}` : "Rs. 0";
  drawRow("Concessions:", concessionStr, [240, 255, 240], [30, 140, 60]);

  const lateFeeStr = totalLateFee > 0 ? `+Rs. ${totalLateFee.toLocaleString("en-IN")}` : "Rs. 0";
  drawRow("Late Fee:", lateFeeStr, [255, 245, 245], [200, 50, 50]);

  sy += 2;
  doc.setFillColor(...p);
  doc.rect(sumX, sy - 6, sumW, rowH + 2, "F");
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL:", sumX + 4, sy + 1);
  doc.text(`Rs. ${data.grandTotal.toLocaleString("en-IN")}`, sumX + sumW - 4, sy + 1, { align: "right" });

  // ─── Payment Method ──────────────────────────────────────
  const bottomY = sy + 18;
  doc.setTextColor(...p);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Payment Method:", 14, bottomY);

  doc.setTextColor(60, 60, 60);
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text(`Mode: ${data.paymentMode}`, 14, bottomY + 6);

  // ─── Terms & Conditions ─────────────────────────────────────────
  doc.setTextColor(...p);
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.text("Terms & Conditions:", 14, bottomY + 18);

  doc.setTextColor(120, 120, 120);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("1. This is a computer-generated receipt and does not require a signature.", 14, bottomY + 24);
  doc.text("2. Please retain this receipt for your records.", 14, bottomY + 29);
  doc.text("3. For any queries, contact the school office.", 14, bottomY + 34);

  // ─── FOOTER ─────────────────────────────────────────────────────
  doc.setFillColor(...p);
  doc.rect(0, H - 16, W, 16, "F");
  doc.setFillColor(...s);
  doc.triangle(0, H - 26, W, H - 26, 0, H - 16, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(7);
  doc.setFont("helvetica", "normal");
  doc.text("This is a computer-generated receipt.", W / 2, H - 9, { align: "center" });

  return doc;
}

export function downloadReceipt(data: ReceiptData): void {
  const doc = buildReceiptDoc(data);
  doc.save(`${data.receiptNumber}.pdf`);
}

export function previewReceipt(data: ReceiptData): string {
  const doc = buildReceiptDoc(data);
  return doc.output("bloburl") as unknown as string;
}

// Fallback receipt number for client-built receipts that don't yet have a
// server-assigned one (e.g. a just-created group before its FeePayment
// documents are re-fetched). Lives outside any component so the impure
// Date.now() call isn't attributed to render.
export function generateReceiptNumber(): string {
  return `RCP-${Date.now().toString(36).toUpperCase()}`;
}
