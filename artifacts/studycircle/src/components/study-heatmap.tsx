import { useMemo, useEffect, useRef } from "react";
import { format, subDays, startOfWeek, addDays, getMonth } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { useTheme } from "next-themes";

const COLORS_DARK = [
  "#1a1f2e", // level 0 — no study
  "#0d2e1c", // level 1 — < 3h  (barely there)
  "#0a5c38", // level 2 — 3h+   (faint green)
  "#0d9455", // level 3 — 5h+   (medium green)
  "#16b85e", // level 4 — 7h+   (green)
  "#22c55e", // level 5 — 9h+   (bright green)
];

const COLORS_LIGHT = [
  "#ebedf0", // level 0 — no study
  "#d6f5e3", // level 1 — < 3h  (barely there)
  "#9be9a8", // level 2 — 3h+   (faint green)
  "#40c463", // level 3 — 5h+   (medium green)
  "#2ea44f", // level 4 — 7h+   (green)
  "#216e39", // level 5 — 9h+   (dark green)
];

// Rows are Sunday=0 … Saturday=6; show label only on Mon(1), Wed(3), Fri(5)
const DAY_LABELS = ["", "Mon", "", "Wed", "", "Fri", ""];

const CELL = 13; // px
const GAP  = 3;  // px

function toLevel(mins: number) {
  if (mins === 0)    return 0;
  if (mins < 180)   return 1; // < 3h
  if (mins < 300)   return 2; // 3h – 4h59m
  if (mins < 420)   return 3; // 5h – 6h59m
  if (mins < 540)   return 4; // 7h – 8h59m
  return 5;                   // 9h+
}

export function StudyHeatmap() {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme !== "light";
  const COLORS = isDark ? COLORS_DARK : COLORS_LIGHT;
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data: raw, isLoading } = useQuery({
    queryKey: ["heatmap-stats"],
    queryFn: () => customFetch<{ date: string; minutes: number }[]>("/api/users/stats/heatmap"),
    staleTime: 5 * 60 * 1000,
  });

  const { weeks, monthLabels, totalMinutes, streak } = useMemo(() => {
    const today    = new Date();
    const start    = startOfWeek(subDays(today, 364));
    const dateMap  = new Map((raw || []).map((d) => [d.date, d.minutes]));

    const days: { date: Date; mins: number; level: number }[] = [];
    let cur = start;
    while (cur <= today) {
      const key  = format(cur, "yyyy-MM-dd");
      const mins = dateMap.get(key) || 0;
      days.push({ date: cur, mins, level: toLevel(mins) });
      cur = addDays(cur, 1);
    }

    const weeksArr: (typeof days)[] = [];
    for (let i = 0; i < days.length; i += 7) weeksArr.push(days.slice(i, i + 7));

    // Month label: only show if at least 3 columns away from previous label (prevents overlap)
    const monthLabels: { label: string; col: number }[] = [];
    let lastMonth = -1;
    let lastLabelCol = -99;
    weeksArr.forEach((week, col) => {
      const m = getMonth(week[0].date);
      if (m !== lastMonth) {
        if (col - lastLabelCol >= 3) {
          monthLabels.push({ label: format(week[0].date, "MMM"), col });
          lastLabelCol = col;
        }
        lastMonth = m;
      }
    });

    const totalMinutes = days.reduce((a, d) => a + d.mins, 0);
    let streak = 0;
    for (let i = days.length - 1; i >= 0; i--) {
      if (days[i].mins > 0) streak++;
      else break;
    }

    return { weeks: weeksArr, monthLabels, totalMinutes, streak };
  }, [raw]);

  // Auto-scroll to today (rightmost end) when data loads
  useEffect(() => {
    if (scrollRef.current && weeks.length > 0) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [weeks]);

  if (isLoading) return <Skeleton className="w-full h-40 rounded-xl" />;

  return (
    <div className="w-full select-none">
      {/* ── Stats bar ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex gap-5 text-sm">
          <div>
            <div className="text-[11px] text-muted-foreground mb-0.5">Total study time</div>
            <div className="font-bold text-foreground">
              {Math.floor(totalMinutes / 60)}h {totalMinutes % 60}m
            </div>
          </div>
          <div>
            <div className="text-[11px] text-muted-foreground mb-0.5">Current streak</div>
            <div className="font-bold text-orange-400">{streak} day{streak !== 1 ? "s" : ""} 🔥</div>
          </div>
        </div>

        {/* Legend */}
        <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-muted-foreground">
          <span>Less</span>
          {COLORS.map((c, i) => (
            <div key={i} style={{ width: CELL, height: CELL, backgroundColor: c, borderRadius: 3 }} />
          ))}
          <span>More</span>
        </div>
      </div>

      {/* ── Grid ── */}
      <div ref={scrollRef} className="overflow-x-auto pb-2 scrollbar-thin scrollbar-thumb-border">
        <div className="flex" style={{ gap: GAP }}>

          {/* Day-of-week labels column */}
          <div className="flex flex-col shrink-0 mt-5" style={{ gap: GAP, marginRight: 4 }}>
            {DAY_LABELS.map((label, i) => (
              <div
                key={i}
                style={{ height: CELL, lineHeight: `${CELL}px` }}
                className="text-[10px] text-muted-foreground w-7 text-right pr-1"
              >
                {label}
              </div>
            ))}
          </div>

          {/* Week columns with month labels above */}
          <div className="flex flex-col">
            {/* Month labels row */}
            <div className="flex mb-1" style={{ gap: GAP }}>
              {weeks.map((_, col) => {
                const ml = monthLabels.find((m) => m.col === col);
                return (
                  <div
                    key={col}
                    style={{ width: CELL, fontSize: 10 }}
                    className="text-muted-foreground font-medium shrink-0 overflow-visible whitespace-nowrap"
                  >
                    {ml?.label ?? ""}
                  </div>
                );
              })}
            </div>

            {/* Cell grid */}
            <div className="flex" style={{ gap: GAP }}>
              {weeks.map((week, col) => (
                <div key={col} className="flex flex-col" style={{ gap: GAP }}>
                  {week.map((day, row) => (
                    <div
                      key={row}
                      title={`${format(day.date, "MMM d, yyyy")} — ${
                        day.mins > 0
                          ? `${Math.floor(day.mins / 60)}h ${day.mins % 60}m studied${day.level === 5 ? " 🔥" : ""}`
                          : "No study time"
                      }`}
                      style={{
                        width: CELL,
                        height: CELL,
                        backgroundColor: COLORS[day.level],
                        borderRadius: 3,
                        boxShadow: day.level === 5 ? "0 0 8px rgba(34,197,94,0.6)" : day.level === 4 ? "0 0 5px rgba(34,197,94,0.3)" : undefined,
                      }}
                      className="cursor-pointer transition-transform hover:scale-125 hover:ring-1 hover:ring-green-400 hover:ring-offset-1 hover:ring-offset-background"
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
