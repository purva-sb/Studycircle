import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, ExternalLink, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useExamPreference } from "@/hooks/use-exam-preference";

type ExamEvent = {
  id: string;
  exam: string;
  category: "GATE" | "JEE" | "NEET" | "CAT" | "UPSC" | "SSC" | "Banking" | "Other";
  event: string;
  date: string;       // ISO date string
  endDate?: string;   // for date ranges
  registrationDeadline?: string;
  official: string;
  confirmed: boolean; // false = estimated
};

const EXAM_EVENTS: ExamEvent[] = [
  // JEE
  { id: "jee-main-s1-reg", exam: "JEE Main 2026", category: "JEE", event: "Session 1 Registration", date: "2025-11-01", endDate: "2025-12-01", official: "https://jeemain.nta.ac.in", confirmed: false },
  { id: "jee-main-s1", exam: "JEE Main 2026", category: "JEE", event: "Session 1 Exam", date: "2026-01-22", endDate: "2026-02-01", official: "https://jeemain.nta.ac.in", confirmed: false },
  { id: "jee-main-s2", exam: "JEE Main 2026", category: "JEE", event: "Session 2 Exam", date: "2026-04-03", endDate: "2026-04-13", official: "https://jeemain.nta.ac.in", confirmed: false },
  { id: "jee-adv", exam: "JEE Advanced 2026", category: "JEE", event: "Exam Day", date: "2026-06-01", official: "https://jeeadv.ac.in", confirmed: false },
  // NEET
  { id: "neet-ug", exam: "NEET UG 2026", category: "NEET", event: "Exam Day", date: "2026-05-03", official: "https://neet.nta.nic.in", confirmed: false },
  { id: "neet-pg", exam: "NEET PG 2026", category: "NEET", event: "Exam Day", date: "2026-07-05", official: "https://natboard.edu.in", confirmed: false },
  // GATE
  { id: "gate-reg", exam: "GATE 2026", category: "GATE", event: "Application Opens", date: "2025-09-01", endDate: "2025-10-15", official: "https://gate2026.iitd.ac.in", confirmed: false },
  { id: "gate-exam", exam: "GATE 2026", category: "GATE", event: "Exam", date: "2026-02-07", endDate: "2026-02-22", official: "https://gate2026.iitd.ac.in", confirmed: false },
  // CAT
  { id: "cat-reg", exam: "CAT 2026", category: "CAT", event: "Registration Opens", date: "2026-08-01", official: "https://iimcat.ac.in", confirmed: false },
  { id: "cat-exam", exam: "CAT 2026", category: "CAT", event: "Exam Day", date: "2026-11-29", official: "https://iimcat.ac.in", confirmed: false },
  // XAT
  { id: "xat-exam", exam: "XAT 2026", category: "CAT", event: "Exam Day", date: "2026-01-05", official: "https://xatonline.in", confirmed: false },
  // UPSC
  { id: "upsc-prelims-reg", exam: "UPSC CSE 2026", category: "UPSC", event: "Prelims Registration", date: "2026-02-15", endDate: "2026-03-07", official: "https://upsc.gov.in", confirmed: false },
  { id: "upsc-prelims", exam: "UPSC CSE 2026", category: "UPSC", event: "Prelims", date: "2026-05-24", official: "https://upsc.gov.in", confirmed: false },
  { id: "upsc-mains", exam: "UPSC CSE 2026", category: "UPSC", event: "Mains", date: "2026-09-18", official: "https://upsc.gov.in", confirmed: false },
  // SSC
  { id: "ssc-cgl-reg", exam: "SSC CGL 2026", category: "SSC", event: "Registration Opens", date: "2026-06-01", official: "https://ssc.nic.in", confirmed: false },
  { id: "ssc-cgl-tier1", exam: "SSC CGL 2026", category: "SSC", event: "Tier 1 Exam", date: "2026-09-01", endDate: "2026-09-20", official: "https://ssc.nic.in", confirmed: false },
  { id: "ssc-chsl", exam: "SSC CHSL 2026", category: "SSC", event: "Exam", date: "2026-07-01", endDate: "2026-07-15", official: "https://ssc.nic.in", confirmed: false },
  // Banking
  { id: "ibps-po-reg", exam: "IBPS PO 2026", category: "Banking", event: "Registration Opens", date: "2026-08-01", official: "https://ibps.in", confirmed: false },
  { id: "ibps-po", exam: "IBPS PO 2026", category: "Banking", event: "Prelims Exam", date: "2026-10-03", endDate: "2026-10-11", official: "https://ibps.in", confirmed: false },
  { id: "sbi-po-reg", exam: "SBI PO 2026", category: "Banking", event: "Registration", date: "2026-04-01", official: "https://sbi.co.in/careers", confirmed: false },
  { id: "sbi-po", exam: "SBI PO 2026", category: "Banking", event: "Prelims Exam", date: "2026-06-13", official: "https://sbi.co.in/careers", confirmed: false },
  { id: "rbi-grade-b", exam: "RBI Grade B 2026", category: "Banking", event: "Phase 1 Exam", date: "2026-03-14", official: "https://rbi.org.in", confirmed: false },
];

const CATEGORY_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  GATE:    { bg: "bg-violet-500/10", text: "text-violet-400", border: "border-violet-500/30", dot: "bg-violet-500" },
  JEE:     { bg: "bg-blue-500/10",   text: "text-blue-400",   border: "border-blue-500/30",   dot: "bg-blue-500" },
  NEET:    { bg: "bg-rose-500/10",   text: "text-rose-400",   border: "border-rose-500/30",   dot: "bg-rose-500" },
  CAT:     { bg: "bg-amber-500/10",  text: "text-amber-400",  border: "border-amber-500/30",  dot: "bg-amber-500" },
  UPSC:    { bg: "bg-emerald-500/10",text: "text-emerald-400",border: "border-emerald-500/30",dot: "bg-emerald-500" },
  SSC:     { bg: "bg-cyan-500/10",   text: "text-cyan-400",   border: "border-cyan-500/30",   dot: "bg-cyan-500" },
  Banking: { bg: "bg-orange-500/10", text: "text-orange-400", border: "border-orange-500/30", dot: "bg-orange-500" },
  Other:   { bg: "bg-muted",         text: "text-muted-foreground", border: "border-border",  dot: "bg-muted-foreground" },
};

const CATEGORIES = ["ALL", "GATE", "JEE", "NEET", "CAT", "UPSC", "SSC", "Banking"] as const;

function formatDate(dateStr: string, endDateStr?: string): string {
  const fmt = (s: string) => new Date(s).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
  if (!endDateStr) return fmt(dateStr);
  const start = new Date(dateStr);
  const end = new Date(endDateStr);
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return `${start.getDate()}–${end.getDate()} ${start.toLocaleDateString("en-IN", { month: "short", year: "numeric" })}`;
  }
  return `${fmt(dateStr)} – ${fmt(endDateStr)}`;
}

function daysUntil(dateStr: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(dateStr); target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function DaysChip({ days }: { days: number }) {
  if (days < 0) return <span className="text-[11px] text-muted-foreground/60">Past</span>;
  if (days === 0) return <span className="text-[11px] font-bold text-rose-500 animate-pulse">Today!</span>;
  if (days <= 7)  return <span className="text-[11px] font-semibold text-rose-400">{days}d left</span>;
  if (days <= 30) return <span className="text-[11px] font-semibold text-amber-400">{days}d left</span>;
  return <span className="text-[11px] text-muted-foreground">{days}d left</span>;
}

export default function ExamCalendar() {
  const [category, setCategory] = useExamPreference();

  const today = new Date(); today.setHours(0, 0, 0, 0);

  const filtered = EXAM_EVENTS
    .filter(e => category === "ALL" || e.category === category)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Group by month
  const grouped = new Map<string, ExamEvent[]>();
  for (const e of filtered) {
    const d = new Date(e.date);
    const key = d.toLocaleDateString("en-IN", { month: "long", year: "numeric" });
    const arr = grouped.get(key) ?? [];
    arr.push(e);
    grouped.set(key, arr);
  }

  const upcoming = filtered.filter(e => daysUntil(e.date) >= 0);
  const next30 = upcoming.filter(e => daysUntil(e.date) <= 30);

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <CalendarDays className="w-6 h-6 text-primary" /> Exam Calendar 2026
        </h2>
        <p className="text-muted-foreground text-sm mt-0.5 flex items-center gap-1.5">
          <AlertCircle className="w-3.5 h-3.5" />
          Dates are estimated — always verify on official websites before applying.
        </p>
      </div>

      {/* Upcoming soon */}
      {next30.length > 0 && (
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 space-y-2">
          <p className="text-sm font-semibold text-amber-400 flex items-center gap-1.5">
            <Clock className="w-4 h-4" /> Coming up in the next 30 days
          </p>
          <div className="flex flex-wrap gap-2">
            {next30.map(e => {
              const c = CATEGORY_COLORS[e.category];
              return (
                <div key={e.id} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium ${c.bg} ${c.text} ${c.border}`}>
                  <div className={`w-1.5 h-1.5 rounded-full ${c.dot} shrink-0`} />
                  {e.exam} · {e.event}
                  <span className="opacity-70">— {formatDate(e.date)}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Category filter */}
      <div className="flex flex-wrap gap-2">
        {CATEGORIES.map(cat => {
          const c = CATEGORY_COLORS[cat] ?? CATEGORY_COLORS.Other;
          const active = category === cat;
          return (
            <button
              key={cat}
              onClick={() => setCategory(cat)}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all",
                active
                  ? `${c.bg} ${c.text} ${c.border}`
                  : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
              )}
            >
              {cat === "ALL" ? "All Exams" : cat}
            </button>
          );
        })}
      </div>

      {/* Timeline by month */}
      <div className="space-y-8">
        {[...grouped.entries()].map(([month, events]) => (
          <div key={month}>
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-2">
              <div className="h-px flex-1 bg-border" />
              {month}
              <div className="h-px flex-1 bg-border" />
            </h3>
            <div className="space-y-3">
              {events.map(event => {
                const c = CATEGORY_COLORS[event.category];
                const days = daysUntil(event.date);
                const isPast = days < 0;
                return (
                  <Card key={event.id} className={cn(
                    "border transition-all",
                    isPast ? "opacity-50 border-border" : "border-border hover:border-primary/30",
                  )}>
                    <CardContent className="p-4 flex items-start gap-4">
                      {/* Color dot */}
                      <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${c.dot}`} />

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2 mb-1">
                          <span className="font-semibold text-sm">{event.exam}</span>
                          <Badge variant="outline" className={`text-[11px] ${c.text} ${c.border} ${c.bg}`}>
                            {event.category}
                          </Badge>
                          {!event.confirmed && (
                            <span className="text-[10px] text-muted-foreground/60 italic">est.</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{event.event}</p>
                        <p className="text-xs text-muted-foreground/70 mt-1 flex items-center gap-1">
                          <CalendarDays className="w-3 h-3" />
                          {formatDate(event.date, event.endDate)}
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2 shrink-0">
                        <DaysChip days={days} />
                        <a
                          href={event.official}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] text-muted-foreground hover:text-primary flex items-center gap-1 transition-colors"
                        >
                          Official <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <p className="text-center text-xs text-muted-foreground/50 pb-4">
        Dates are approximations based on previous year patterns. Verify at official websites before making decisions.
      </p>
    </div>
  );
}
