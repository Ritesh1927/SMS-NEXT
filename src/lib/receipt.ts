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

type RGB = [number, number, number];

const W = 210;
const H = 297;

function hexToRgb(hex: string): RGB {
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

function fitText(doc: jsPDF, txt: string, x: number, y: number, maxW: number, size: number, minSize: number): void {
  let s = size;
  doc.setFontSize(s);
  while (s > minSize && doc.getTextWidth(txt) > maxW) {
    s = Math.max(minSize, s - 0.5);
    doc.setFontSize(s);
  }
  doc.text(txt, x, y);
}

function gradientRect(doc: jsPDF, x: number, y: number, w: number, h: number, c1: RGB, c2: RGB): void {
  const steps = Math.max(2, Math.round(w));
  const sw = w / steps;
  for (let i = 0; i < steps; i++) {
    const t = i / (steps - 1);
    doc.setFillColor(
      Math.round(c1[0] + (c2[0] - c1[0]) * t),
      Math.round(c1[1] + (c2[1] - c1[1]) * t),
      Math.round(c1[2] + (c2[2] - c1[2]) * t)
    );
    doc.rect(x + i * sw, y, Math.min(sw + 0.5, w - i * sw), h, "F");
  }
}

function roundedGradientRect(doc: jsPDF, x: number, y: number, w: number, h: number, r: number, c1: RGB, c2: RGB): void {
  gradientRect(doc, x, y, w, h, c1, c2);
  const k = 0.5523 * r;
  doc.setFillColor(255, 255, 255);
  doc.lines([[r, 0], [-k, 0, -r, r - k, -r, r], [0, -r]], x, y, [1, 1], "F", true);
  doc.lines([[-r, 0], [k, 0, r, r - k, r, r], [0, -r]], x + w, y, [1, 1], "F", true);
  doc.lines([[0, -r], [0, k, -r + k, r, -r, r], [r, 0]], x + w, y + h, [1, 1], "F", true);
  doc.lines([[r, 0], [-k, 0, -r, -r + k, -r, -r], [0, r]], x, y + h, [1, 1], "F", true);
}

function headColor(name: string): RGB {
  const n = name.toLowerCase();
  if (n.includes("tuit") || n.includes("class") || n.includes("academic")) return [59, 130, 246];
  if (n.includes("exam") || n.includes("test")) return [139, 92, 246];
  if (n.includes("transport") || n.includes("bus")) return [16, 185, 129];
  if (n.includes("admis") || n.includes("regist") || n.includes("form")) return [245, 158, 11];
  if (n.includes("lab") || n.includes("computer")) return [20, 184, 166];
  if (n.includes("sport") || n.includes("activ")) return [244, 63, 94];
  if (n.includes("hostel")) return [249, 115, 22];
  if (n.includes("librar") || n.includes("book")) return [14, 165, 233];
  if (n.includes("annual") || n.includes("develop")) return [236, 72, 153];
  return [99, 102, 241];
}

function drawHeader(doc: jsPDF, data: ReceiptData, p: RGB, s: RGB): void {
  gradientRect(doc, 0, 0, W, 44, p, s);
  doc.setFillColor(255, 255, 255);
  doc.lines([[70, 7, 140, -5, 210, 4], [0, 14], [-210, 0]], 0, 33, [1, 1], "F", true);

  doc.setDrawColor(255, 255, 255);
  doc.setFillColor(255, 255, 255);
  doc.setLineWidth(0.5);
  doc.circle(148, 9, 2.4, "F");
  doc.circle(152, 8.3, 3, "F");
  doc.circle(156, 9.4, 2.2, "F");
  doc.circle(164, 6.5, 1.7, "F");
  doc.circle(167, 6, 2.1, "F");
  doc.lines([[13, -8], [13, 8]], 175, 14, [1, 1], "S");
  doc.rect(175, 14, 26, 14, "S");
  doc.rect(185, 20, 5, 8, "S");
  doc.rect(178, 17, 4, 4, "S");
  doc.rect(194, 17, 4, 4, "S");
  doc.rect(178, 23, 4, 4, "S");
  doc.rect(194, 23, 4, 4, "S");
  doc.lines([[0, -4.5]], 188, 6, [1, 1], "S");
  doc.lines([[4, 1.2], [-4, 1.2]], 188, 1.5, [1, 1], "F", true);

  doc.setFillColor(255, 255, 255);
  doc.circle(26, 16, 9.5, "F");
  doc.setFillColor(...p);
  doc.circle(26, 16, 8, "F");
  const hasLogo = data.school.logo ? drawLogo(doc, data.school.logo, 20.5, 10.5, 11, 11) : false;
  if (!hasLogo) {
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(24.3, 16.4, 3.4, 2.6, 0.7, 0.7, "F");
    doc.lines([[6, 2.3], [-6, 2.3], [-6, -2.3]], 26, 13.5, [1, 1], "F", true);
    doc.setDrawColor(255, 255, 255);
    doc.setLineWidth(0.6);
    doc.line(32, 15.8, 31.5, 19.8);
    doc.setFillColor(255, 255, 255);
    doc.circle(31.5, 20.3, 0.7, "F");
  }

  doc.setFont("helvetica", "bold");
  doc.setTextColor(255, 255, 255);
  fitText(doc, data.school.schoolName || "School Name", 42, 15.5, 100, 15, 9);
  const contact = [data.school.schoolAddress, data.school.schoolPhone, data.school.schoolEmail].filter(Boolean).join("  |  ");
  if (contact) {
    doc.setFont("helvetica", "normal");
    fitText(doc, contact, 42, 21.5, 100, 7.5, 5.5);
  }
}

function drawFooter(doc: jsPDF, p: RGB, s: RGB): void {
  gradientRect(doc, 0, H - 25, W, 25, p, s);
  doc.setFillColor(255, 255, 255);
  doc.lines([[210, 0], [0, 15], [-70, 7, -140, -5, -210, -4]], 0, H - 33, [1, 1], "F", true);

  doc.setFillColor(255, 255, 255);
  doc.roundedRect(73.8, 287.6, 2.6, 1.6, 0.5, 0.5, "F");
  doc.lines([[3, 1.1], [-3, 1.1], [-3, -1.1]], 76, 284.9, [1, 1], "F", true);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text("Thank you for your continued support.", 107, 289.5, { align: "center" });
}

function drawInfoGlyph(doc: jsPDF, index: number, x: number, y: number, p: RGB): void {
  if (index === 0) {
    doc.setFillColor(...p);
    doc.roundedRect(x + 2, y + 1, 4, 6, 0.7, 0.7, "F");
    doc.setFillColor(255, 255, 255);
    doc.rect(x + 2.8, y + 2.3, 2.4, 0.5, "F");
    doc.rect(x + 2.8, y + 3.5, 2.4, 0.5, "F");
    doc.rect(x + 2.8, y + 4.7, 1.6, 0.5, "F");
  } else if (index === 1) {
    doc.setFillColor(...p);
    doc.roundedRect(x + 1.5, y + 1.5, 5.5, 5.5, 0.7, 0.7, "F");
    doc.setFillColor(255, 255, 255);
    doc.rect(x + 1.5, y + 1.5, 5.5, 1.4, "F");
    doc.rect(x + 2.4, y + 0.5, 0.7, 1.6, "F");
    doc.rect(x + 5.4, y + 0.5, 0.7, 1.6, "F");
  } else {
    doc.setFillColor(...p);
    doc.roundedRect(x + 1.3, y + 2, 6, 4.6, 0.7, 0.7, "F");
    doc.setFillColor(255, 255, 255);
    doc.rect(x + 1.3, y + 3, 6, 0.9, "F");
  }
}

function buildReceiptDoc(data: ReceiptData): jsPDF {
  const doc = new jsPDF("p", "mm", "a4");
  const p = hexToRgb(data.school.themeColor || "#6366f1");
  const s = hexToRgb(data.school.secondaryColor || "#8B5CF6");

  drawHeader(doc, data, p, s);

  // ─── TITLE ─────────────────────────────────────────────────────
  doc.setFillColor(233, 238, 255);
  doc.roundedRect(30, 40, 150, 15, 4, 4, "F");
  doc.setFillColor(...p);
  doc.roundedRect(36, 42.5, 10, 10, 2.5, 2.5, "F");
  doc.setFillColor(255, 255, 255);
  doc.roundedRect(38.6, 44.1, 4.8, 6.8, 0.8, 0.8, "F");
  doc.setFillColor(...p);
  doc.rect(39.6, 45.6, 2.8, 0.6, "F");
  doc.rect(39.6, 47, 2.8, 0.6, "F");
  doc.rect(39.6, 48.4, 1.8, 0.6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(19);
  doc.setTextColor(30, 56, 139);
  doc.text("FEE RECEIPT", W / 2 + 6, 49.9, { align: "center" });

  const sub = "OFFICIAL PAYMENT RECEIPT";
  doc.setFontSize(8);
  const subW = doc.getTextWidth(sub) + sub.length * 1.4;
  const subX = W / 2 - subW / 2;
  doc.setDrawColor(...p);
  doc.setLineWidth(0.4);
  doc.line(32, 59.6, subX - 6, 59.6);
  doc.line(subX + subW + 6, 59.6, W - 32, 59.6);
  doc.setTextColor(100, 110, 150);
  doc.text(sub, subX, 61, { charSpace: 1.4 });

  // ─── INFO CARDS ────────────────────────────────────────────────
  const cardY = 66;
  const cardH = 40;

  doc.setFillColor(236, 241, 253);
  doc.roundedRect(14, cardY, 87, cardH, 3, 3, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(...p);
  doc.text("INVOICE TO", 21, 75.5, { charSpace: 1 });
  doc.setFillColor(...p);
  doc.circle(28, 92, 6.5, "F");
  doc.setFillColor(255, 255, 255);
  doc.circle(28, 89.6, 2, "F");
  doc.roundedRect(25.2, 92.6, 5.6, 3.4, 1.6, 1.6, "F");
  doc.setTextColor(30, 35, 55);
  fitText(doc, data.studentName, 40, 89.5, 55, 12, 8);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(95, 100, 115);
  const cls = `Class: ${data.studentClass}${data.studentSection ? ` - ${data.studentSection}` : ""}${
    data.rollNumber ? `  |  Roll No: ${data.rollNumber}` : ""
  }`;
  fitText(doc, cls, 40, 97, 55, 9, 6.5);
  if (data.studentId) fitText(doc, `ID: ${data.studentId}`, 40, 102.5, 55, 8.5, 6.5);

  doc.setFillColor(243, 244, 247);
  doc.roundedRect(109, cardY, 87, cardH, 3, 3, "F");
  const infoRows: [string, string][] = [
    ["Invoice No:", data.receiptNumber],
    ["Invoice Date:", data.paymentDate],
    ["Payment Mode:", data.paymentMode],
  ];
  infoRows.forEach(([label, value], i) => {
    const ry = 78 + i * 12;
    doc.setFillColor(224, 230, 255);
    doc.roundedRect(115, ry - 4.5, 8, 8, 2, 2, "F");
    drawInfoGlyph(doc, i, 115, ry - 4.5, p);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(55, 60, 75);
    doc.text(label, 128, ry);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(80, 85, 100);
    fitText(doc, value, 156, ry, 38, 9, 6.5);
  });

  // ─── FEE TABLE ─────────────────────────────────────────────────
  const monthLabel = (m: string) => {
    if (!m || m === "one-time") return "One-time";
    const match = /^(\d{4})-(\d{2})$/.exec(m);
    if (match) return new Date(Number(match[1]), Number(match[2]) - 1).toLocaleString("en", { month: "short", year: "numeric" });
    return m;
  };
  // One-time rows first, then chronological (Apr 2026 → May 2026 → …)
  const sortedRows = [...data.feeHeadTotals].sort((a, b) => {
    const ak = a.month && a.month !== "one-time" ? a.month : "";
    const bk = b.month && b.month !== "one-time" ? b.month : "";
    if (ak === "" || bk === "") return ak === bk ? 0 : ak === "" ? -1 : 1;
    return ak.localeCompare(bk);
  });

  autoTable(doc, {
    startY: 112,
    head: [["No.", "Fee Description", "Amount (Rs.)"]],
    body: sortedRows.map((f, i) => [
      String(i + 1).padStart(2, "0"),
      `${f.feeHead} — ${monthLabel(f.month)}`,
      `Rs. ${(f.amount || 0).toLocaleString("en-IN")}`,
    ]),
    theme: "grid",
    headStyles: { fillColor: p, textColor: [255, 255, 255], fontStyle: "bold", fontSize: 10, cellPadding: 3 },
    alternateRowStyles: { fillColor: [248, 250, 254] },
    columnStyles: {
      0: { cellWidth: 18, halign: "center", cellPadding: 2.2, fontStyle: "bold", textColor: p },
      1: { cellWidth: 116, halign: "left", cellPadding: { top: 2.2, bottom: 2.2, left: 14, right: 4 } },
      2: { cellWidth: 48, halign: "right", fontStyle: "bold", textColor: [35, 40, 55], cellPadding: 2.2 },
    },
    styles: {
      fontSize: 10,
      textColor: [60, 65, 80],
      lineColor: [226, 230, 238],
      lineWidth: 0.2,
      cellPadding: 2.2,
      valign: "middle",
      font: "helvetica",
    },
    margin: { left: 14, right: 14 },
    didParseCell: (d) => {
      if (d.section === "head") {
        d.cell.styles.halign = d.column.index === 0 ? "center" : d.column.index === 1 ? "left" : "right";
      }
    },
    didDrawCell: (d) => {
      if (d.section !== "body") return;
      const cell = d.cell;
      if (d.column.index === 0) {
        const pw = 11.5;
        const ph = Math.max(4, cell.height - 2.6);
        doc.setFillColor(224, 230, 255);
        doc.roundedRect(cell.x + (cell.width - pw) / 2, cell.y + (cell.height - ph) / 2, pw, ph, 1.6, 1.6, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...p);
        doc.text(String(d.row.index + 1).padStart(2, "0"), cell.x + cell.width / 2, cell.y + cell.height / 2 + 1.1, {
          align: "center",
        });
      } else if (d.column.index === 1) {
        const desc = cell.text.join(" ");
        const head = desc.split("—")[0].trim();
        const letter = (head.match(/[A-Za-z]/) || ["F"])[0].toUpperCase();
        const bs = Math.max(5, Math.min(8, cell.height - 1.6));
        doc.setFillColor(...headColor(head));
        doc.roundedRect(cell.x + 4, cell.y + (cell.height - bs) / 2, bs, bs, 1.8, 1.8, "F");
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9.5);
        doc.setTextColor(255, 255, 255);
        doc.text(letter, cell.x + 4 + bs / 2, cell.y + cell.height / 2 + 1.15, { align: "center" });
      }
    },
  });

  const finalY = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY || 132;
  let bottomY = finalY + 8;
  if (bottomY + 56 > 271) {
    doc.addPage();
    drawHeader(doc, data, p, s);
    bottomY = 52;
  }

  // ─── NOTE CARD ─────────────────────────────────────────────────
  doc.setFillColor(240, 244, 254);
  doc.roundedRect(14, bottomY, 87, 27, 3, 3, "F");
  doc.setFillColor(...p);
  doc.circle(21, bottomY + 7, 2.6, "F");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text("i", 21, bottomY + 8.4, { align: "center" });
  doc.setFontSize(10);
  doc.setTextColor(...p);
  doc.text("Note", 27, bottomY + 8.3);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(90, 95, 110);
  fitText(doc, "Please keep this receipt for your records.", 21, bottomY + 16.5, 76, 7.5, 6);
  fitText(doc, "For any queries, contact the school office.", 21, bottomY + 21.5, 76, 7.5, 6);

  // ─── SIGNATURE ─────────────────────────────────────────────────
  const sigY = bottomY + 36;
  doc.setDrawColor(50, 70, 150);
  doc.setLineWidth(0.7);
  doc.lines(
    [
      [3, -4, 7, 3, 11, -2],
      [4, -4, 8, 5, 12, -1],
      [4, -4, 8, 5, 12, 2],
      [3, 2, 6, 1, 8, -2],
    ],
    20,
    sigY,
    [1, 1],
    "S"
  );
  doc.setDrawColor(150, 155, 170);
  doc.setLineWidth(0.4);
  doc.line(16, sigY + 9, 66, sigY + 9);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(40, 45, 60);
  doc.text("Authorized Signatory", 16, sigY + 14.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(100, 105, 120);
  fitText(doc, data.school.schoolName || "", 16, sigY + 20, 50, 8, 6);

  // ─── SUMMARY ───────────────────────────────────────────────────
  const totalBase = data.feeHeadTotals.reduce((sum, f) => sum + (f.amount || 0), 0);
  const totalLateFee = data.feeHeadTotals.reduce((sum, f) => sum + (f.lateFee || 0), 0);
  const totalConcession = data.feeHeadTotals.reduce((sum, f) => sum + (f.concession || 0), 0);

  const sx = 109;
  const sw = 87;
  let sy = bottomY;
  const sumRow = (label: string, value: string, bg: RGB, fg: RGB) => {
    doc.setFillColor(...bg);
    doc.roundedRect(sx, sy, sw, 9, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...fg);
    doc.text(label, sx + 5, sy + 6);
    doc.text(value, sx + sw - 5, sy + 6, { align: "right" });
    sy += 10.5;
  };

  sumRow("Subtotal:", `Rs. ${totalBase.toLocaleString("en-IN")}`, [241, 245, 252], [51, 65, 85]);
  sumRow("Concession:", totalConcession > 0 ? `-Rs. ${totalConcession.toLocaleString("en-IN")}` : "Rs. 0", [236, 253, 245], [
    5, 150, 105,
  ]);
  sumRow("Late Fee:", totalLateFee > 0 ? `+Rs. ${totalLateFee.toLocaleString("en-IN")}` : "Rs. 0", [254, 242, 242], [
    220, 38, 38,
  ]);

  sy += 1.5;
  roundedGradientRect(doc, sx, sy, sw, 11, 2.5, p, s);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.setTextColor(255, 255, 255);
  doc.text("TOTAL:", sx + 5, sy + 7.5);
  doc.text(`Rs. ${data.grandTotal.toLocaleString("en-IN")}`, sx + sw - 5, sy + 7.5, { align: "right" });

  // ─── FOOTER ────────────────────────────────────────────────────
  drawFooter(doc, p, s);

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
