// Shared helpers for the fee collection engine (student-status, pay-multi,
// and the fee reports) — ported from SMS-BACKEND's fee.controller.js so the
// late-fee/concession math stays identical across every consumer.

export interface LateFeeConfig {
  enabled?: boolean;
  gracePeriod?: number;
  type?: "fixed" | "percentage";
  amount?: number;
  percent?: number;
  maxAmount?: number;
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

// Late fee = daily charge × days after grace period, capped at maxAmount
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
  const maxCap = lateFeeConfig.maxAmount ?? 500;
  const fee = type === "fixed" ? fixedPerDay * chargeableDays : Math.round((baseAmount * pctPerDay) / 100 * chargeableDays);
  return Math.min(fee, maxCap);
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

// Resolves the actual due date for one occurrence of a recurring fee. A
// FeeStructure stores a single dueDate as a day-of-month convention (e.g.
// "pay by the 15th"), so each month's real due date is that day carried
// into the target month -- not the structure's literal stored date, which
// is just one sample instance (and, for "one-time" fees, its own due date
// as-is). Used everywhere a month is checked against "has this become due
// yet" so a future month never inherits an already-passed sample date.
export function dueDateForMonth(structureDueDate: Date | string | null | undefined, month: string): Date | null {
  if (!structureDueDate) return null;
  const base = new Date(structureDueDate);
  if (month === "one-time") return base;
  const [year, mo] = month.split("-").map(Number);
  if (!year || !mo) return base;
  const daysInMonth = new Date(year, mo, 0).getDate();
  return new Date(year, mo - 1, Math.min(base.getDate(), daysInMonth));
}

// True once this occurrence's own month has started relative to `now` --
// the fee *period* gates payability (a fee becomes payable as soon as its
// month begins), not the exact day-of-month due date, which only marks
// when it turns late. So September's fee is payable all through
// September; October's isn't payable (or shown as due) until October
// itself arrives, however far off its 10th/15th falls.
export function isMonthUpcoming(structureDueDate: Date | string | null | undefined, month: string, now: Date = new Date()): boolean {
  const due = dueDateForMonth(structureDueDate, month);
  if (!due) return false;
  const dueMonthKey = `${due.getFullYear()}-${String(due.getMonth() + 1).padStart(2, "0")}`;
  const currentMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  return dueMonthKey > currentMonthKey;
}

// Drops session months that fall before the student's admission date.
export function filterMonthsByAdmission(months: string[], admissionDate: Date | string | null | undefined): string[] {
  if (!admissionDate) return months;
  const admDate = new Date(admissionDate);
  const admMonth = `${admDate.getFullYear()}-${String(admDate.getMonth() + 1).padStart(2, "0")}`;
  const idx = months.indexOf(admMonth);
  return idx > 0 ? months.slice(idx) : months;
}
