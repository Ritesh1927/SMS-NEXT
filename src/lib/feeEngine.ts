// Shared helpers for the fee collection engine (student-status, pay-multi,
// and the fee reports) — ported from SMS-BACKEND's fee.controller.js so the
// late-fee/concession math stays identical across every consumer.

export interface LateFeeConfig {
  enabled?: boolean;
  gracePeriod?: number;
  type?: "fixed" | "percentage";
  amount?: number;
  percent?: number;
}

export interface ConcessionLike {
  _id: unknown;
  feeStructure?: unknown;
  duration: "recurring" | "one-time" | "until-date";
  validUntil?: Date | string | null;
  isPct: boolean;
  value: number;
  appliedMonths?: string[];
}

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

// month format: "2026-09" or "one-time"
export function concessionAppliesToMonth(concession: ConcessionLike, month: string): boolean {
  if (concession.duration === "one-time") {
    return !(concession.appliedMonths && concession.appliedMonths.length > 0);
  }
  if (concession.duration === "until-date" && concession.validUntil) {
    const [y, m] = month.split("-").map(Number);
    const monthEnd = new Date(y, m, 0);
    if (monthEnd > new Date(concession.validUntil)) return false;
  }
  return true;
}

export function concessionAmount(base: number, c: { isPct: boolean; value: number }): number {
  return Math.min(base, c.isPct ? Math.round((base * c.value) / 100) : c.value);
}

// Late fee = daily charge × days after grace period (no cap)
export function calcProjectedLateFee(
  lateFeeConfig: LateFeeConfig,
  baseAmount: number,
  dueDate: Date | string | null | undefined,
): number {
  const enabled = lateFeeConfig.enabled !== false;
  if (!enabled || !dueDate) return 0;
  const due = new Date(dueDate);
  const now = new Date();
  if (now <= due) return 0;
  const daysOverdue = Math.floor((now.getTime() - due.getTime()) / (1000 * 60 * 60 * 24));
  const graceDays = lateFeeConfig.gracePeriod ?? 7;
  const chargeableDays = daysOverdue - graceDays;
  if (chargeableDays <= 0) return 0;
  const type = lateFeeConfig.type || "fixed";
  const fixedPerDay = lateFeeConfig.amount ?? 100;
  const pctPerDay = lateFeeConfig.percent ?? 2;
  return type === "fixed" ? fixedPerDay * chargeableDays : Math.round((baseAmount * pctPerDay) / 100 * chargeableDays);
}

// Generates the 12 months of the current academic session (e.g. Apr 2026 –
// Mar 2027), starting from the school's configured sessionStartMonth.
export function generateSessionMonths(sessionStartMonth: string, year: number): string[] {
  const startMonthIdx = MONTH_NAMES.indexOf(sessionStartMonth || "April");
  const months: string[] = [];
  for (let i = 0; i < 12; i++) {
    const m = (startMonthIdx + i) % 12;
    const y = m >= startMonthIdx ? year : year + 1;
    months.push(`${y}-${String(m + 1).padStart(2, "0")}`);
  }
  return months;
}

// Drops session months that fall before the student's admission date.
export function filterMonthsByAdmission(months: string[], admissionDate: Date | string | null | undefined): string[] {
  if (!admissionDate) return months;
  const admDate = new Date(admissionDate);
  const admMonth = `${admDate.getFullYear()}-${String(admDate.getMonth() + 1).padStart(2, "0")}`;
  const idx = months.indexOf(admMonth);
  return idx > 0 ? months.slice(idx) : months;
}

export function resolveFeeMonths(
  frequency: string,
  applicableMonths: string[],
  allSessionMonths: string[],
  dueDate?: Date | string | null,
): string[] {
  if (frequency !== "quarterly") return applicableMonths;
  const inSession = new Set(applicableMonths);
  let quarterKeys: string[] = [];
  if (dueDate) {
    const d = new Date(dueDate);
    quarterKeys = [0, 3, 6, 9]
      .map((off) => {
        const m = d.getMonth() + off;
        return `${d.getFullYear() + Math.floor(m / 12)}-${String((m % 12) + 1).padStart(2, "0")}`;
      })
      .filter((k) => inSession.has(k));
  }
  if (quarterKeys.length === 0) {
    quarterKeys = [0, 3, 6, 9].map((i) => allSessionMonths[i]).filter((k) => !!k && inSession.has(k));
  }
  return quarterKeys;
}

export function effectiveDueDate(
  frequency: string,
  month: string,
  dueDate: Date | string | null | undefined,
): Date | string | null | undefined {
  if (frequency !== "quarterly" || !dueDate || !month || month === "one-time") return dueDate;
  const [y, m] = month.split("-").map(Number);
  if (!y || !m) return dueDate;
  const day = new Date(dueDate).getDate();
  return new Date(y, m - 1, Math.min(day, new Date(y, m, 0).getDate()));
}
