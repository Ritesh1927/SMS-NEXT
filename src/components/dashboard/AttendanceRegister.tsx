"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Users, Download, Sheet, FileText, Info, CalendarCheck, CheckCircle2, XCircle, Clock } from "lucide-react";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatFilterCard } from "@/components/StatFilterCard";
import { EmptyState } from "@/components/EmptyState";
import { statusPillClass } from "@/lib/statusStyles";
import { getHolidayInfo, type HolidayConfig } from "@/lib/holidays";

type Status = "present" | "absent" | "late";

export interface RegisterData {
  className: string;
  daysInMonth: number;
  students: { _id: string; name: string; rollNumber: string }[];
  records: Record<string, Record<number, Status>>;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const STATUS_LETTER: Record<Status, string> = { present: "P", absent: "A", late: "L" };
const STATUS_BADGE: Record<Status, string> = {
  present: "bg-green-500",
  absent: "bg-red-500",
  late: "bg-amber-500",
};
const AVATAR_COLORS = ["bg-blue-500", "bg-violet-500", "bg-teal-500", "bg-orange-500", "bg-pink-500", "bg-emerald-500", "bg-indigo-500", "bg-rose-500"];

function rateTone(pct: number) {
  return pct >= 90 ? "success" : pct >= 75 ? "warning" : "destructive";
}

// Month-based attendance register (students × days pivot) for Reports >
// Attendance — mirrors the reference design: 5 stat cards, sticky identity
// columns, one column per day with P/A/L badges, per-row totals + %, legend +
// class-summary footer, and a notes card. Exports: PDF (jsPDF) and Excel
// (exceljs).
export function AttendanceRegister({ data, month, year }: { data: RegisterData; month: number; year: number }) {
  const [holidayConfig, setHolidayConfig] = useState<HolidayConfig | null>(null);
  const [exporting, setExporting] = useState(false);

  // One-off holiday dates can fall in any month and the list is small —
  // fetch once per mount so weekly-off/custom columns gray out correctly.
  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<{ success: boolean; data: HolidayConfig }>("/school/holidays", token)
      .then((res) => setHolidayConfig(res.data))
      .catch(() => {});
  }, []);

  const dayList = Array.from({ length: data.daysInMonth }, (_, i) => {
    const day = i + 1;
    const date = new Date(year, month - 1, day);
    // A day already fully in the past (strictly before today) with no
    // record is treated as Absent in the report — see `pastUnmarked` below.
    const dayStart = new Date(year, month - 1, day);
    dayStart.setHours(0, 0, 0, 0);
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return {
      day,
      dow: date.getDay(),
      holiday: holidayConfig ? getHolidayInfo(date, holidayConfig) : null,
      past: dayStart.getTime() < todayStart.getTime(),
    };
  });

  const rows = data.students.map((student, i) => {
    const rec = data.records[student._id];
    let p = 0;
    let a = 0;
    let l = 0;
    for (const d of dayList) {
      const st = rec?.[d.day];
      if (st === "present") p++;
      else if (st === "absent") a++;
      else if (st === "late") l++;
      // Unmarked past working day (not a holiday/weekly-off) counts as
      // Absent so the report reflects reality: a missed marking session
      // in the past can never read as "no data" forever.
      else if (d.past && !d.holiday) a++;
    }
    const marked = p + a + l;
    return { student, i, rec, p, a, l, marked, pct: marked ? Math.round(((p + l) / marked) * 100) : 0 };
  });

  const totals = rows.reduce(
    (acc, r) => ({ p: acc.p + r.p, a: acc.a + r.a, l: acc.l + r.l, marked: acc.marked + r.marked }),
    { p: 0, a: 0, l: 0, marked: 0 },
  );
  const rate = totals.marked ? Math.round(((totals.p + totals.l) / totals.marked) * 100) : 0;
  const pctOf = (n: number) => (totals.marked ? Math.round((n / totals.marked) * 100) : 0);
  const exportName = `attendance-${data.className.replace(/[^\w]+/g, "-")}-${MONTHS[month - 1]}-${year}`;
  const monthLabel = `${MONTHS[month - 1]} ${year}`;

  if (data.students.length === 0) {
    return <EmptyState icon={Users} message={`No students found in ${data.className}.`} />;
  }

  const exportPDF = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const [{ default: jsPDF }, { default: autoTable }] = await Promise.all([import("jspdf"), import("jspdf-autotable")]);
      const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageWidth = doc.internal.pageSize.getWidth();

      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text(`Class Attendance Register — ${data.className}`, pageWidth / 2, 24, { align: "center" });
      doc.setFont("helvetica", "normal");
      doc.setFontSize(9);
      doc.setTextColor(90);
      doc.text(
        `${monthLabel} · Attendance from 1 ${MONTHS[month - 1]} ${year} to ${data.daysInMonth} ${MONTHS[month - 1]} ${year}`,
        pageWidth / 2,
        36,
        { align: "center" },
      );
      doc.setTextColor(0);

      const columnStyles: Record<number, { cellWidth: number; halign: "left" | "center" }> = {
        0: { cellWidth: 16, halign: "center" },
        1: { cellWidth: 90, halign: "left" },
        2: { cellWidth: 34, halign: "center" },
      };
      dayList.forEach((_, i) => {
        columnStyles[3 + i] = { cellWidth: 16, halign: "center" };
      });
      const tail = 3 + dayList.length;
      columnStyles[tail] = { cellWidth: 24, halign: "center" };
      columnStyles[tail + 1] = { cellWidth: 24, halign: "center" };
      columnStyles[tail + 2] = { cellWidth: 20, halign: "center" };
      columnStyles[tail + 3] = { cellWidth: 34, halign: "center" };

      autoTable(doc, {
        startY: 46,
        head: [
          [
            "#",
            "Student Name",
            "Roll No.",
            ...dayList.map((d) => String(d.day).padStart(2, "0")),
            "Present",
            "Absent",
            "Late",
            "Attendance %",
          ],
        ],
        body: rows.map((r) => [
          String(r.i + 1),
          r.student.name,
          r.student.rollNumber || "-",
          ...dayList.map((d) => {
            const st = r.rec?.[d.day];
            if (st) return STATUS_LETTER[st];
            if (d.holiday) return "-";
            return d.past ? "A" : "";
          }),
          String(r.p),
          String(r.a),
          String(r.l),
          `${r.pct}%`,
        ]),
        styles: { fontSize: 6, cellPadding: 2, halign: "center", lineColor: [226, 232, 240], lineWidth: 0.1 },
        headStyles: { fillColor: [79, 70, 229], textColor: [255, 255, 255], halign: "center", fontSize: 6 },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        columnStyles,
        margin: { left: 14, right: 14 },
      });

      const finalY = (doc as unknown as { lastAutoTable?: { finalY?: number } }).lastAutoTable?.finalY ?? 120;
      doc.setFontSize(8);
      doc.setTextColor(120);
      doc.text(
        `Class Summary — Present: ${totals.p}  |  Absent: ${totals.a}  |  Late: ${totals.l}  |  Total: ${totals.marked}  |  Attendance Rate: ${rate}%`,
        14,
        finalY + 16,
      );
      doc.text("P = Present   A = Absent (incl. unmarked past days)   L = Late   - = Holiday / Weekly Off", 14, finalY + 28);
      doc.text(
        `Generated on ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
        pageWidth - 14,
        doc.internal.pageSize.getHeight() - 12,
        { align: "right" },
      );

      doc.save(`${exportName}.pdf`);
    } catch {
      toast.error("Failed to generate the PDF.");
    } finally {
      setExporting(false);
    }
  };

  const exportExcel = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      const ExcelJS = (await import("exceljs")).default;
      const wb = new ExcelJS.Workbook();
      const ws = wb.addWorksheet(data.className);

      ws.columns = [
        { width: 5 },
        { width: 24 },
        { width: 10 },
        ...dayList.map(() => ({ width: 4.5 })),
        { width: 9 },
        { width: 8 },
        { width: 7 },
        { width: 14 },
      ];

      const title = ws.addRow([`Class Attendance Register — ${data.className}`]);
      title.font = { bold: true, size: 14 };
      const sub = ws.addRow([
        `${monthLabel} · Generated ${new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`,
      ]);
      sub.font = { size: 10, color: { argb: "FF64748B" } };
      ws.addRow([]);

      const header = ws.addRow([
        "#",
        "Student Name",
        "Roll No.",
        ...dayList.map((d) => String(d.day).padStart(2, "0")),
        "Present",
        "Absent",
        "Late",
        "Attendance %",
      ]);
      header.eachCell((cell) => {
        cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 10 };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF4F46E5" } };
        cell.alignment = { horizontal: "center", vertical: "middle" };
      });

      const firstDayCol = 4;
      const lastDayCol = 3 + dayList.length;
      for (const r of rows) {
        const row = ws.addRow([
          r.i + 1,
          r.student.name,
          r.student.rollNumber || "-",
          ...dayList.map((d) => {
            const st = r.rec?.[d.day];
            if (st) return STATUS_LETTER[st];
            if (d.holiday) return "-";
            return d.past ? "A" : "";
          }),
          r.p,
          r.a,
          r.l,
          `${r.pct}%`,
        ]);
        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
          if (colNumber >= firstDayCol && colNumber <= lastDayCol) {
            cell.alignment = { horizontal: "center" };
            if (cell.value === "P") cell.font = { bold: true, color: { argb: "FF16A34A" } };
            else if (cell.value === "A") cell.font = { bold: true, color: { argb: "FFDC2626" } };
            else if (cell.value === "L") cell.font = { bold: true, color: { argb: "FFF59E0B" } };
          }
        });
      }

      ws.addRow([]);
      const summary = ws.addRow([
        "",
        "Class Summary",
        `Present: ${totals.p} | Absent: ${totals.a} | Late: ${totals.l} | Total: ${totals.marked}`,
      ]);
      summary.font = { bold: true };
      const summaryRate = ws.addRow(["", "Attendance Rate", `${rate}%`]);
      summaryRate.font = { bold: true };

      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer as unknown as BlobPart], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${exportName}.xlsx`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to generate the Excel file.");
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
        <StatFilterCard
          icon={Users}
          color="#16A34A"
          colorDark="#15803D"
          value={data.students.length}
          label="Total Students"
          sublabel={`Enrolled in ${data.className}`}
        />
        <StatFilterCard
          icon={CheckCircle2}
          color="#10B981"
          colorDark="#059669"
          value={totals.p}
          label="Present"
          sublabel={`${pctOf(totals.p)}% of total`}
        />
        <StatFilterCard
          icon={XCircle}
          color="#EF4444"
          colorDark="#DC2626"
          value={totals.a}
          label="Absent"
          sublabel={`${pctOf(totals.a)}% of total`}
        />
        <StatFilterCard
          icon={Clock}
          color="#F59E0B"
          colorDark="#D97706"
          value={totals.l}
          label="Late"
          sublabel={`${pctOf(totals.l)}% of total`}
        />
        <StatFilterCard
          icon={CalendarCheck}
          color="#0EA5E9"
          colorDark="#0284C7"
          value={`${rate}%`}
          label="Attendance Rate"
          sublabel="Overall (Selected Period)"
        />
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                <Users className="h-5 w-5 text-primary" />
              </div>
              <div>
                <CardTitle className="text-base">{data.className}</CardTitle>
                <p className="text-xs text-muted-foreground">
                  Attendance from 1 {MONTHS[month - 1]} {year} to {data.daysInMonth} {MONTHS[month - 1]} {year}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" className="gap-1.5" onClick={exportPDF} disabled={exporting}>
                <Download className="h-3.5 w-3.5" /> Export PDF
              </Button>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={exportExcel} disabled={exporting}>
                <Sheet className="h-3.5 w-3.5 text-green-600" /> Export Excel
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            {/* table-fixed + explicit widths: sticky identity columns stay at
                exact left offsets (40 + 176 = 216) and Roll No. never collides
                with the student name / first day column. */}
            <table
              className="w-full table-fixed border-separate border-spacing-0 text-xs"
              style={{ minWidth: 576 + dayList.length * 46 }}
            >
              <thead>
                <tr>
                  <th
                    rowSpan={2}
                    className="sticky left-0 z-20 w-10 bg-card border-b border-border/70 p-2 text-center text-[11px] font-semibold text-muted-foreground"
                  >
                    #
                  </th>
                  <th
                    rowSpan={2}
                    className="sticky left-10 z-20 w-44 bg-card border-b border-r border-border/70 p-2 text-left text-xs font-semibold text-muted-foreground"
                  >
                    Student Name
                  </th>
                  <th
                    rowSpan={2}
                    className="sticky left-[216px] z-20 w-20 bg-card border-b border-r border-border/70 p-2 text-left text-xs font-semibold text-muted-foreground"
                  >
                    Roll No.
                  </th>
                  {dayList.map((d) => (
                    <th
                      key={d.day}
                      className={`bg-card border-b border-r border-border/50 p-1.5 text-center ${
                        d.holiday ? "text-muted-foreground/50" : "text-foreground"
                      }`}
                    >
                      <span className="block text-[10px] font-medium text-muted-foreground">{WEEKDAYS[d.dow]}</span>
                      <span className="block text-xs font-semibold">{String(d.day).padStart(2, "0")}</span>
                    </th>
                  ))}
                  <th
                    rowSpan={2}
                    className="w-16 bg-card border-b border-l border-border/70 p-2 text-center text-xs font-semibold text-muted-foreground"
                  >
                    Present
                  </th>
                  <th
                    rowSpan={2}
                    className="w-16 bg-card border-b border-border/70 p-2 text-center text-xs font-semibold text-muted-foreground"
                  >
                    Absent
                  </th>
                  <th
                    rowSpan={2}
                    className="w-14 bg-card border-b border-border/70 p-2 text-center text-xs font-semibold text-muted-foreground"
                  >
                    Late
                  </th>
                  <th
                    rowSpan={2}
                    className="w-24 bg-card border-b border-border/70 p-2 text-center text-xs font-semibold text-muted-foreground"
                  >
                    Attendance %
                  </th>
                </tr>
                <tr>
                  {dayList.map((d) => (
                    <th
                      key={d.day}
                      className={`border-b border-r border-border/50 p-1 text-[10px] font-medium ${
                        d.holiday ? "bg-muted/40 text-muted-foreground/40" : "bg-muted/20 text-muted-foreground/70"
                      }`}
                    >
                      P/A/L
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.student._id} className="group">
                    <td className="sticky left-0 z-10 bg-card group-hover:bg-muted/40 border-b border-border/50 p-1 text-center text-muted-foreground">
                      {r.i + 1}
                    </td>
                    <td className="sticky left-10 z-10 bg-card group-hover:bg-muted/40 border-b border-r border-border/50 p-1.5">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                            AVATAR_COLORS[r.i % AVATAR_COLORS.length]
                          }`}
                        >
                          {r.student.name
                            .trim()
                            .split(/\s+/)
                            .map((w) => w[0])
                            .slice(0, 2)
                            .join("")}
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-foreground">{r.student.name}</span>
                      </div>
                    </td>
                    <td className="sticky left-[216px] z-10 bg-card group-hover:bg-muted/40 border-b border-r border-border/50 p-1.5 font-mono text-[11px] text-muted-foreground">
                      {r.student.rollNumber || "—"}
                    </td>
                    {dayList.map((d) => {
                      const st = r.rec?.[d.day];
                      return (
                        <td
                          key={d.day}
                          className={`border-b border-r border-border/40 p-1 text-center ${
                            d.holiday ? "bg-muted/40" : ""
                          }`}
                        >
                          {st ? (
                            <span
                              className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-white ${
                                STATUS_BADGE[st]
                              }`}
                            >
                              {STATUS_LETTER[st]}
                            </span>
                          ) : d.holiday ? null : d.past ? (
                            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                              A
                            </span>
                          ) : (
                            <span className="text-muted-foreground/30">–</span>
                          )}
                        </td>
                      );
                    })}
                    <td className="border-b border-l border-border/50 p-1.5 text-center text-[13px] font-semibold text-foreground">
                      {r.p}
                    </td>
                    <td className="border-b border-border/50 p-1.5 text-center text-[13px] font-semibold text-destructive">
                      {r.a}
                    </td>
                    <td className="border-b border-border/50 p-1.5 text-center text-[13px] font-semibold text-warning">
                      {r.l}
                    </td>
                    <td className="border-b border-border/50 p-1.5 text-center">
                      <span
                        className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusPillClass(
                          rateTone(r.pct),
                        )}`}
                      >
                        {r.pct}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend + class summary + rate — mirrors the reference footer. */}
          <div className="flex flex-col gap-3 border-t border-border/70 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/10">
                <Info className="h-3 w-3 text-primary" />
              </span>
              <span>
                <span className="font-semibold text-foreground">P</span> = Present &nbsp;|&nbsp;{" "}
                <span className="font-semibold text-foreground">A</span> = Absent &nbsp;|&nbsp;{" "}
                <span className="font-semibold text-foreground">L</span> = Late
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
              <div className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">Class Summary</span>{" "}
                <span className="ml-2">
                  Present: <span className="font-semibold text-foreground">{totals.p}</span>
                </span>{" "}
                |{" "}
                <span>
                  Absent: <span className="font-semibold text-destructive">{totals.a}</span>
                </span>{" "}
                |{" "}
                <span>
                  Late: <span className="font-semibold text-warning">{totals.l}</span>
                </span>{" "}
                |{" "}
                <span>
                  Total: <span className="font-semibold text-foreground">{totals.marked}</span>
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                Attendance Rate
                <span className={statusPillClass(rateTone(rate))}>{rate}%</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="flex items-start gap-3 px-5 py-4">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
            <FileText className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">Notes &amp; Remarks</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Attendance is updated in real-time. Late means the student arrived after the class start time. Past working
              days without a marking are counted as Absent (shown as A).
            </p>
          </div>
        </CardContent>
      </Card>
    </>
  );
}
