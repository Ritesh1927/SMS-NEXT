"use client";

import { useEffect, useState } from "react";
import { CalendarDays } from "lucide-react";
import { getToken } from "@/contexts/AuthContext";
import { apiGet } from "@/lib/api";
import { getHolidayInfo, getEventInfo, type CalendarData } from "@/lib/holidays";
import { DashboardSectionHeader, HeaderWaveGlyph } from "./DashboardSectionHeader";

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

// Month-grid calendar colored from /school/holidays -- weekly off-days and
// declared holidays in their established colors, plus events in a third,
// distinct color. Shared across the admin, teacher and parent dashboards
// since the endpoint it reads is open to all three roles.
export function SchoolCalendar() {
  const today = new Date();
  const [month, setMonth] = useState(today.getMonth());
  const [year, setYear] = useState(today.getFullYear());
  const [holidayConfig, setHolidayConfig] = useState<CalendarData | null>(null);

  useEffect(() => {
    const token = getToken();
    if (!token) return;
    apiGet<{ success: boolean; data: CalendarData }>("/school/holidays", token)
      .then((res) => setHolidayConfig(res.data))
      .catch(() => {});
  }, []);

  const changeMonth = (delta: number) => {
    let m = month + delta;
    let y = year;
    if (m < 0) { m = 11; y -= 1; }
    if (m > 11) { m = 0; y += 1; }
    setMonth(m);
    setYear(y);
  };

  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(firstWeekday).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const isToday = (d: number) => year === today.getFullYear() && month === today.getMonth() && d === today.getDate();

  return (
    <div className="bg-card overflow-hidden rounded-[20px] h-full" style={{ border: "1px solid rgba(59,130,246,0.18)", boxShadow: "0 10px 30px rgba(15,23,42,0.08)" }}>
      <DashboardSectionHeader
        icon={CalendarDays}
        title="School Calendar"
        subtitle="Track important dates and events"
        accent="green"
        variant="dark"
        decoration={<HeaderWaveGlyph />}
      />
      <div className="bg-card p-6">
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => changeMonth(-1)} className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted" aria-label="Previous month">
          ‹
        </button>
        <p className="text-sm font-semibold text-foreground">{MONTH_NAMES[month]} {year}</p>
        <button type="button" onClick={() => changeMonth(1)} className="h-7 w-7 flex items-center justify-center rounded-full text-muted-foreground hover:bg-muted" aria-label="Next month">
          ›
        </button>
      </div>
      <div className="grid grid-cols-7 gap-1 mb-1">
        {WEEKDAYS.map((d) => (
          <p key={d} className="text-center text-[11px] font-medium text-muted-foreground/70">{d}</p>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 mb-4">
        {cells.map((day, i) => {
          const holiday = day && holidayConfig ? getHolidayInfo(new Date(year, month, day), holidayConfig) : null;
          // Holiday takes visual priority over event -- a day can only have
          // one entry by design (see Settings calendar), but this keeps the
          // render defensive either way.
          const event = day && holidayConfig && !holiday ? getEventInfo(new Date(year, month, day), holidayConfig.events) : null;
          const holidayStyle = holiday?.type === "custom" ? "bg-violet-100 text-violet-700 font-semibold" : "bg-slate-200 text-slate-600 font-semibold";
          return (
            <div
              key={i}
              title={holiday?.name || event?.name}
              className={`h-9 rounded-lg flex items-center justify-center text-sm ${
                day
                  ? holiday
                    ? holidayStyle
                    : event
                      ? "bg-sky-100 text-sky-700 font-semibold"
                      : isToday(day)
                        ? "bg-primary text-white font-semibold"
                        : "text-foreground hover:bg-muted"
                  : ""
              }`}
            >
              {day}
            </div>
          );
        })}
      </div>
      {holidayConfig && (holidayConfig.weeklyOffDays.length > 0 || holidayConfig.dates.length > 0 || holidayConfig.events.length > 0) && (
        <div className="flex items-center gap-3 mb-1 text-[11px] text-muted-foreground flex-wrap">
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-400" /> Weekly Off</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-violet-500" /> Holiday</span>
          <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-500" /> Event</span>
        </div>
      )}
      </div>
    </div>
  );
}
