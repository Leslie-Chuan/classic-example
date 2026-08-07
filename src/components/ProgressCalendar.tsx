"use client";

import { useMemo } from "react";
import { format, subDays, startOfWeek, addDays } from "date-fns";

interface Props {
  calendarData: Record<string, number>;
}

export default function ProgressCalendar({ calendarData }: Props) {
  const weeks = useMemo(() => {
    const today = new Date();
    const days: (string | null)[][] = [];
    const startDate = startOfWeek(subDays(today, 364), { weekStartsOn: 1 });

    let currentWeek: (string | null)[] = [];
    let currentDate = startDate;

    while (currentDate <= today) {
      if (currentWeek.length === 7) {
        days.push(currentWeek);
        currentWeek = [];
      }
      const dateStr = format(currentDate, "yyyy-MM-dd");
      currentWeek.push(dateStr <= format(today, "yyyy-MM-dd") ? dateStr : null);
      currentDate = addDays(currentDate, 1);
    }
    if (currentWeek.length > 0) days.push(currentWeek);
    return days;
  }, []);

  const months = useMemo(() => {
    const today = new Date();
    const labels: { label: string; col: number }[] = [];
    let lastMonth = -1;

    weeks.forEach((week, i) => {
      const firstDay = week.find((d) => d !== null);
      if (firstDay) {
        const month = new Date(firstDay).getMonth();
        if (month !== lastMonth) {
          labels.push({
            label: format(new Date(firstDay), "M月"),
            col: i,
          });
          lastMonth = month;
        }
      }
    });
    return labels;
  }, [weeks]);

  return (
    <div className="overflow-x-auto">
      <div className="min-w-[700px]">
        {/* Month labels */}
        <div className="flex mb-1 text-xs text-zinc-500">
          <div className="w-8" />
          <div className="flex-1 relative h-4">
            {months.map((m, i) => (
              <span key={i} className="absolute" style={{ left: `${(m.col / weeks.length) * 100}%` }}>
                {m.label}
              </span>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="flex gap-[3px]">
          {/* Day labels */}
          <div className="flex flex-col gap-[3px] text-[10px] text-zinc-500 pt-[2px]">
            {["一", "二", "三", "四", "五", "六", "日"].map((d, i) => (
              <div key={i} className="h-[11px] w-8 flex items-center">
                {i % 2 === 0 ? d : ""}
              </div>
            ))}
          </div>

          {/* Contribution grid */}
          <div className="flex gap-[3px]">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((date, di) => {
                  const isActive = date !== null && calendarData[date];
                  return (
                    <div
                      key={di}
                      className={`h-[11px] w-[11px] rounded-[2px] ${
                        date === null
                          ? "bg-transparent"
                          : isActive
                          ? "bg-emerald-500"
                          : "bg-zinc-800"
                      }`}
                      title={date ? `${date}${calendarData[date] ? " ✓" : ""}` : ""}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
