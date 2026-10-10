import { useState } from "react";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { MathText } from "@/components/math-text";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Trophy, CheckCircle2, XCircle, MinusCircle, ChevronDown, ChevronUp,
  Share2, BarChart3, RotateCcw, Medal, MessageCircle, Loader2,
  TrendingUp, AlertTriangle, Clock, Copy,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import { motion } from "framer-motion";
import { z } from "zod";

/* ── Types ── */
const GetExamResultResponse = z.object({
  attemptId: z.string(),
  examId: z.string(),
  examTitle: z.string(),
  examName: z.string().optional(),
  score: z.number(),
  totalMarks: z.number(),
  accuracy: z.number(),
  percentile: z.number(),
  rank: z.number(),
  totalParticipants: z.number(),
  correctCount: z.number(),
  wrongCount: z.number(),
  skippedCount: z.number(),
  timeSpentMinutes: z.number(),
  classAverageScore: z.number().default(0),
  topScore: z.number().default(0),
  topicBreakdown: z.array(z.object({ topic: z.string(), correct: z.number(), total: z.number() })),
  subjectBreakdown: z.array(z.object({ subject: z.string(), correct: z.number(), total: z.number() })).default([]),
  subtopicBreakdown: z.array(z.object({ subtopic: z.string(), parentTopic: z.string(), correct: z.number(), total: z.number() })).default([]),
  questions: z.array(z.object({
    id: z.string(), no: z.number(),
    kind: z.enum(["mcq", "msq", "nat"]),
    body: z.string(),
    imageUrl: z.string().nullable().optional(),
    explanation: z.string().nullable().optional(),
    solutionVideoUrl: z.string().nullable().optional(),
    solutionArticleUrl: z.string().nullable().optional(),
    options: z.array(z.object({ id: z.string(), body: z.string() })),
    marks: z.number(), negativeMarks: z.number(), topic: z.string(),
    subject: z.string().nullable().optional(),
    subtopic: z.string().nullable().optional(),
    source: z.string().nullable().optional(),
    correctOptionIds: z.array(z.string()),
    natAnswer: z.number().nullable().optional(),
    yourSelectedIds: z.array(z.string()),
    yourNatValue: z.number().nullable().optional(),
    verdict: z.enum(["correct", "wrong", "skipped"]),
    timeSpentSeconds: z.number().nullable().optional(),
  })),
});
type Result = z.infer<typeof GetExamResultResponse>;
type Question = Result["questions"][number];

const LABELS = ["A", "B", "C", "D", "E"];

/* ── Verdict colours ── */
const V = {
  correct: { bg: "#d4edda", border: "#28a745", text: "#155724", icon: "#28a745" },
  wrong:   { bg: "#f8d7da", border: "#dc3545", text: "#721c24", icon: "#dc3545" },
  skipped: { bg: "#e2e3e5", border: "#adb5bd", text: "#383d41", icon: "#6c757d" },
};

/* ── Subject → Topic → Subtopic drill-down ── */
function bar(accuracy: number) {
  return accuracy >= 70 ? "#28a745" : accuracy >= 40 ? "#ffc107" : "#dc3545";
}
function pct(c: number, t: number) {
  return t > 0 ? Math.round((c / t) * 100) : 0;
}

function SubjectDrillDown({
  subjects, topics, subtopics, questions,
}: {
  subjects: Result["subjectBreakdown"];
  topics: Result["topicBreakdown"];
  subtopics: Result["subtopicBreakdown"];
  questions: Result["questions"];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);

  // Sort weakest → strongest so the focus area is at the top
  const sorted = [...subjects].sort((a, b) => pct(a.correct, a.total) - pct(b.correct, b.total));
  const weakest = sorted[0];

  // For an expanded subject, find topics + subtopics that belong to it
  const subjectQs = (subjectName: string) => questions.filter((q) => q.subject === subjectName);
  const topicsForSubject = (subjectName: string) => {
    const qs = subjectQs(subjectName);
    const agg = new Map<string, { correct: number; total: number }>();
    for (const q of qs) {
      const cur = agg.get(q.topic) ?? { correct: 0, total: 0 };
      cur.total++;
      if (q.verdict === "correct") cur.correct++;
      agg.set(q.topic, cur);
    }
    return [...agg.entries()].map(([topic, v]) => ({ topic, ...v })).sort((a, b) => pct(a.correct, a.total) - pct(b.correct, b.total));
  };
  const subtopicsForTopic = (subjectName: string, topicName: string) => {
    const qs = subjectQs(subjectName).filter((q) => q.topic === topicName);
    const agg = new Map<string, { correct: number; total: number }>();
    for (const q of qs) {
      if (!q.subtopic) continue;
      const cur = agg.get(q.subtopic) ?? { correct: 0, total: 0 };
      cur.total++;
      if (q.verdict === "correct") cur.correct++;
      agg.set(q.subtopic, cur);
    }
    return [...agg.entries()].map(([subtopic, v]) => ({ subtopic, ...v })).sort((a, b) => pct(a.correct, a.total) - pct(b.correct, b.total));
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
      <div className="px-5 py-4 border-b border-gray-100">
        <h2 className="font-bold text-gray-800 flex items-center gap-2">
          🎓 Subject-wise breakdown
        </h2>
        {weakest && pct(weakest.correct, weakest.total) < 60 && (
          <p className="text-xs text-gray-500 mt-1">
            Focus next on <strong className="text-red-600">{weakest.subject}</strong> — you scored
            {" "}<strong>{pct(weakest.correct, weakest.total)}%</strong> ({weakest.correct}/{weakest.total}).
          </p>
        )}
      </div>

      <div className="divide-y divide-gray-50">
        {sorted.map((s) => {
          const acc = pct(s.correct, s.total);
          const isOpen = expanded === s.subject;
          const subjectTopics = isOpen ? topicsForSubject(s.subject) : [];
          return (
            <div key={s.subject}>
              <button
                onClick={() => setExpanded(isOpen ? null : s.subject)}
                className="w-full flex items-center gap-3 px-5 py-3 text-left hover:bg-gray-50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-semibold text-gray-800 truncate">{s.subject}</span>
                    <span className="text-xs font-bold tabular-nums" style={{ color: bar(acc) }}>
                      {acc}% <span className="text-gray-400 font-normal ml-1">({s.correct}/{s.total})</span>
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full rounded-full transition-all" style={{ width: `${acc}%`, background: bar(acc) }} />
                  </div>
                </div>
                {isOpen ? <ChevronUp className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />}
              </button>

              {isOpen && subjectTopics.length > 0 && (
                <div className="bg-gray-50 px-5 py-3 space-y-2.5 border-t border-gray-100">
                  {subjectTopics.map((t) => {
                    const ta = pct(t.correct, t.total);
                    const sts = subtopicsForTopic(s.subject, t.topic);
                    return (
                      <div key={t.topic} className="pl-4 border-l-2" style={{ borderColor: bar(ta) }}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm font-medium text-gray-700">{t.topic}</span>
                          <span className="text-xs font-bold tabular-nums" style={{ color: bar(ta) }}>
                            {ta}% <span className="text-gray-400 font-normal">({t.correct}/{t.total})</span>
                          </span>
                        </div>
                        {sts.length > 0 && (
                          <div className="space-y-1 mt-2">
                            {sts.map((st) => {
                              const sta = pct(st.correct, st.total);
                              return (
                                <div key={st.subtopic} className="flex items-center gap-3 text-xs pl-3">
                                  <span className="text-gray-400">↳</span>
                                  <span className="text-gray-600 flex-1 truncate">{st.subtopic}</span>
                                  <span className="font-bold tabular-nums" style={{ color: bar(sta) }}>
                                    {sta}% <span className="text-gray-300 font-normal">({st.correct}/{st.total})</span>
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Percentile Banner ── */
function PercentileBanner({ percentile, rank, totalParticipants }: {
  percentile: number; rank: number; totalParticipants: number;
}) {
  if (totalParticipants < 2) return null;

  const p = Math.round(percentile);
  const beaten = p;
  const top    = 100 - p;

  const { emoji, title, titleColor, barColor, bg, border } =
    p >= 95 ? { emoji: "🏆", title: "Exceptional — Top 5%!", titleColor: "#b45309", barColor: "#f59e0b", bg: "#fffbeb", border: "#fcd34d" } :
    p >= 85 ? { emoji: "🥇", title: "Elite Performance",      titleColor: "#7c3aed", barColor: "#8b5cf6", bg: "#f5f3ff", border: "#c4b5fd" } :
    p >= 70 ? { emoji: "🎯", title: "Above Average",           titleColor: "#1d4ed8", barColor: "#3b82f6", bg: "#eff6ff", border: "#93c5fd" } :
    p >= 50 ? { emoji: "📈", title: "Better than half!",       titleColor: "#047857", barColor: "#10b981", bg: "#ecfdf5", border: "#6ee7b7" } :
              { emoji: "📚", title: "Keep Practising",         titleColor: "#374151", barColor: "#9ca3af", bg: "#f9fafb", border: "#e5e7eb" };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
      <div className="rounded-2xl border shadow-sm overflow-hidden" style={{ background: bg, borderColor: border }}>
        <div className="px-6 py-5 space-y-4">
          {/* Headline */}
          <div className="flex items-center gap-3">
            <span className="text-4xl">{emoji}</span>
            <div>
              <p className="font-black text-lg leading-tight" style={{ color: titleColor }}>{title}</p>
              <p className="text-sm text-gray-600 mt-0.5">
                You scored better than <span className="font-bold" style={{ color: titleColor }}>{beaten}%</span> of students who attempted this exam.
                {top <= 15 && <span className="ml-1 font-semibold" style={{ color: titleColor }}>You're in the top {top}%!</span>}
              </p>
            </div>
          </div>

          {/* Position bar */}
          <div>
            <div className="relative h-5 bg-gray-200 rounded-full overflow-visible">
              <div className="h-full rounded-full transition-all duration-1000" style={{ width: `${Math.max(2, p)}%`, background: barColor }} />
              {/* Marker */}
              <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 flex flex-col items-center"
                style={{ left: `${Math.max(4, Math.min(96, p))}%` }}>
                <div className="w-4 h-4 rounded-full border-2 border-white shadow-md" style={{ background: barColor }} />
              </div>
            </div>
            <div className="flex justify-between text-[10px] text-gray-400 font-medium mt-1.5 px-0.5">
              <span>0%</span>
              <span>25%</span>
              <span>50%</span>
              <span>75%</span>
              <span>100%</span>
            </div>
          </div>

          {/* Footer stats */}
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-gray-500">
            <span>📋 <strong className="text-gray-700">{totalParticipants}</strong> students attempted</span>
            <span>🏅 Your rank: <strong className="text-gray-700">#{rank}</strong></span>
            <span>📊 Percentile: <strong style={{ color: titleColor }}>{percentile.toFixed(1)}</strong></span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}

/* ── Score Comparison Panel ── */
function ComparisonPanel({
  score, totalMarks, classAvg, topScore, totalParticipants,
}: {
  score: number; totalMarks: number; classAvg: number; topScore: number; totalParticipants: number;
}) {
  if (totalParticipants < 2) return null;
  const rows = [
    { label: "Topper", value: topScore, color: "#f59e0b" },
    { label: "You",    value: score,    color: "#3b5fe3" },
    { label: "Class Avg", value: classAvg, color: "#6b7280" },
  ];
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-4 flex items-center gap-2">
        <TrendingUp className="w-4 h-4" /> Score Comparison
      </h2>
      <div className="space-y-3.5">
        {rows.map((r) => {
          const p = totalMarks > 0 ? Math.round((r.value / totalMarks) * 100) : 0;
          const isYou = r.label === "You";
          return (
            <div key={r.label}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium" style={{ color: isYou ? r.color : "#374151", fontWeight: isYou ? 700 : 500 }}>
                  {r.label}
                </span>
                <span className="text-sm tabular-nums" style={{ color: r.color, fontWeight: isYou ? 700 : 500 }}>
                  {r.value}
                  <span className="text-gray-400 font-normal text-xs ml-1">/{totalMarks} ({p}%)</span>
                </span>
              </div>
              <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all"
                  style={{ width: `${p}%`, background: r.color, opacity: isYou ? 1 : 0.7 }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Marks Breakdown Card ── */
function MarksBreakdown({ questions, totalMarks }: { questions: Question[]; totalMarks: number }) {
  const earned   = questions.filter(q => q.verdict === "correct").reduce((s, q) => s + q.marks, 0);
  const deducted = parseFloat(questions.filter(q => q.verdict === "wrong").reduce((s, q) => s + q.negativeMarks, 0).toFixed(2));
  const missed   = questions.filter(q => q.verdict === "skipped").reduce((s, q) => s + q.marks, 0);
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5">
      <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-4">Marks Breakdown</h2>
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" />
            Marks earned (correct)
          </span>
          <span className="text-sm font-bold text-green-600">+{earned}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600 flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" />
            Marks deducted (wrong)
          </span>
          <span className="text-sm font-bold text-red-600">−{deducted}</span>
        </div>
        <div className="border-t border-gray-100 pt-2.5 flex items-center justify-between">
          <span className="text-sm font-semibold text-gray-800">Net Score</span>
          <span className="text-sm font-bold text-blue-700">
            {parseFloat((earned - deducted).toFixed(2))}
            <span className="text-gray-400 font-normal ml-1">/ {totalMarks}</span>
          </span>
        </div>
        {missed > 0 && (
          <div className="flex items-center justify-between pt-0.5">
            <span className="text-xs text-gray-400 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-gray-300 shrink-0" />
              Potential marks left (skipped)
            </span>
            <span className="text-xs font-medium text-gray-400">{missed} pts</span>
          </div>
        )}
      </div>
    </div>
  );
}

/* ── Focus Areas ── */
function FocusAreas({ topicBreakdown }: { topicBreakdown: Result["topicBreakdown"] }) {
  const weak = [...topicBreakdown]
    .map(t => ({ ...t, acc: t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0 }))
    .filter(t => t.acc < 70)
    .sort((a, b) => a.acc - b.acc)
    .slice(0, 5);
  if (weak.length === 0) return null;
  return (
    <div className="bg-white rounded-xl border border-amber-100 shadow-sm p-5">
      <h2 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
        <AlertTriangle className="w-5 h-5 text-amber-500" />
        Focus Areas — Revise before your next attempt
      </h2>
      <div className="space-y-3.5">
        {weak.map((t) => {
          const color = t.acc < 40 ? "#dc3545" : "#f59e0b";
          const bg    = t.acc < 40 ? "#fff5f5" : "#fffbeb";
          const needed = t.total - t.correct;
          return (
            <div key={t.topic}>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-sm font-medium text-gray-800">{t.topic}</span>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-gray-400">{t.correct}/{t.total}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ background: bg, color }}>
                    {t.acc}%
                  </span>
                </div>
              </div>
              <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${t.acc}%`, background: color }} />
              </div>
              {needed > 0 && (
                <p className="text-[11px] text-gray-400 mt-1">
                  Practice {needed} more question{needed > 1 ? "s" : ""} in this topic
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ── Question Review Card ── */
type DoubtRef = {
  id: string; title: string; askedBy: string; bountyXp: number;
  answerCount: number; createdAt: string; resolved: boolean;
};
function QuestionCard({ q, examId, examTitle }: { q: Question; examId: string; examTitle: string }) {
  const [open, setOpen] = useState(false);
  const [, setLocation] = useLocation();
  const [creating, setCreating] = useState(false);
  const c = V[q.verdict];

  // Lazy: only fetch linked doubts once the card opens (one query per opened question)
  const { data: doubts = [] } = useQuery<DoubtRef[]>({
    queryKey: ["question-doubts", q.id],
    queryFn: () => customFetch(`/api/questions/${q.id}/doubts`),
    enabled: open,
    staleTime: 60_000,
  });

  // Auto-recommended doubts: topic/subtopic match (Part 4 Layer 2)
  const { data: relatedDoubts = [] } = useQuery<DoubtRef[]>({
    queryKey: ["question-related-doubts", q.id, q.topic, q.subtopic],
    queryFn: () => {
      const params = new URLSearchParams();
      if (q.topic)    params.set("topic",    q.topic);
      if (q.subtopic) params.set("subtopic", q.subtopic);
      return customFetch(`/api/questions/${q.id}/related-doubts?${params}`);
    },
    enabled: open,
    staleTime: 60_000,
  });

  const askInCommunity = async () => {
    setCreating(true);
    // Pre-fill title from question body's first 80 chars
    const title = q.body.replace(/\s+/g, " ").trim().slice(0, 80) + (q.body.length > 80 ? "…" : "");
    const yourAnswerLine = q.verdict === "wrong"
      ? `\n\n**My (wrong) answer:** ${q.yourSelectedIds.length ? `Selected option(s) ${q.yourSelectedIds.join(", ")}` : q.yourNatValue ?? "—"}`
      : q.verdict === "skipped" ? "\n\n**I skipped this question.**" : "";
    const body = `**From [${examTitle}], Question ${q.no}**\n\n${q.body}${yourAnswerLine}\n\n*Can someone explain the correct approach?*`;

    try {
      const created = await customFetch<{ id: string }>("/api/doubts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title, body,
          topic: q.topic || "General",
          exam: examTitle.slice(0, 100),
          bountyXp: 50,
          questionId: q.id,
          examId,
        }),
      });
      toast.success("Discussion created!");
      setLocation(`/doubts/${created.id}`);
    } catch (err: any) {
      toast.error(err?.message?.slice(0, 200) || "Failed to create discussion");
    } finally {
      setCreating(false);
    }
  };

  return (
    <div style={{ border: `1.5px solid ${c.border}`, background: open ? "#fff" : c.bg, borderRadius: 8 }}
      className="overflow-hidden transition-colors">
      {/* Header row */}
      <button className="w-full flex items-center gap-3 px-4 py-3 text-left hover:opacity-90"
        onClick={() => setOpen((v) => !v)}>
        <span style={{ background: c.border, color: "#fff", minWidth: 28, height: 28, borderRadius: "50%", fontSize: 12, fontWeight: 700 }}
          className="flex items-center justify-center shrink-0">{q.no}</span>
        <span className="flex-1 text-sm font-medium text-gray-800 line-clamp-2">
          <MathText text={q.body} />
        </span>
        <div className="flex items-center gap-2 shrink-0">
          {q.timeSpentSeconds != null && q.timeSpentSeconds > 0 && (
            <span className="hidden sm:flex items-center gap-0.5 text-xs text-gray-400">
              <Clock className="w-3 h-3" />
              {q.timeSpentSeconds >= 60
                ? `${Math.floor(q.timeSpentSeconds / 60)}m ${q.timeSpentSeconds % 60}s`
                : `${q.timeSpentSeconds}s`}
            </span>
          )}
          {q.verdict === "correct" && <span className="text-xs font-bold text-green-700">+{q.marks}</span>}
          {q.verdict === "wrong"   && <span className="text-xs font-bold text-red-700">−{q.negativeMarks}</span>}
          {q.verdict === "skipped" && <span className="text-xs font-bold text-gray-500">0</span>}
          {q.verdict === "correct" ? <CheckCircle2 className="w-4 h-4" style={{ color: c.icon }} />
            : q.verdict === "wrong" ? <XCircle className="w-4 h-4" style={{ color: c.icon }} />
            : <MinusCircle className="w-4 h-4" style={{ color: c.icon }} />}
          {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>

      {/* Expanded body */}
      {open && (
        <div className="border-t px-4 pb-4 pt-3 space-y-3 bg-white" style={{ borderColor: c.border }}>
          {q.imageUrl && (
            <img src={q.imageUrl} alt="" className="max-h-48 max-w-full object-contain rounded border" />
          )}

          {/* Options for MCQ/MSQ */}
          {(q.kind === "mcq" || q.kind === "msq") && (
            <div className="space-y-1.5">
              {q.options.map((opt, i) => {
                const isCorrect = q.correctOptionIds.includes(opt.id);
                const isYours   = q.yourSelectedIds.includes(opt.id);
                let bg = "#fff", border = "#dee2e6", textColor = "#212529";
                if (isCorrect) { bg = "#d4edda"; border = "#28a745"; textColor = "#155724"; }
                else if (isYours && !isCorrect) { bg = "#f8d7da"; border = "#dc3545"; textColor = "#721c24"; }
                return (
                  <div key={opt.id} style={{ background: bg, border: `1px solid ${border}`, borderRadius: 4 }}
                    className="flex items-start gap-2.5 px-3 py-2">
                    <span style={{
                      minWidth: 22, height: 22, borderRadius: "50%", fontSize: 11, fontWeight: 700,
                      background: isCorrect ? "#28a745" : isYours ? "#dc3545" : "#e9ecef",
                      color: isCorrect || isYours ? "#fff" : "#495057",
                      display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
                    }}>{LABELS[i]}</span>
                    <span style={{ color: textColor }} className="text-sm leading-relaxed">
                      <MathText text={opt.body} />
                    </span>
                    {isCorrect && <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0 mt-0.5 ml-auto" />}
                    {isYours && !isCorrect && <XCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5 ml-auto" />}
                  </div>
                );
              })}
            </div>
          )}

          {/* NAT answer */}
          {q.kind === "nat" && (
            <div className="flex gap-4 text-sm">
              <div style={{ background: "#d4edda", border: "1px solid #28a745" }} className="rounded px-3 py-2">
                <span className="text-green-700 font-semibold">Correct: </span>
                <span className="text-green-800 font-bold">{q.natAnswer ?? "—"}</span>
              </div>
              <div style={{ background: q.verdict === "correct" ? "#d4edda" : "#f8d7da", border: `1px solid ${q.verdict === "correct" ? "#28a745" : "#dc3545"}` }} className="rounded px-3 py-2">
                <span style={{ color: q.verdict === "correct" ? "#155724" : "#721c24" }} className="font-semibold">Your answer: </span>
                <span style={{ color: q.verdict === "correct" ? "#155724" : "#721c24" }} className="font-bold">
                  {q.yourNatValue ?? "—"}
                </span>
              </div>
            </div>
          )}

          {/* Explanation */}
          {q.explanation && (
            <div style={{ background: "#fff8e1", border: "1px solid #ffd54f" }} className="rounded px-3 py-2.5 text-sm text-yellow-900">
              <span className="font-semibold">Explanation: </span>{q.explanation}
            </div>
          )}

          {/* Solution links + Discuss in Community */}
          <div className="flex flex-wrap gap-2">
            {q.solutionVideoUrl && (
              <a href={q.solutionVideoUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-red-50 text-red-700 border border-red-200 hover:bg-red-100">
                📹 Watch Video Solution
              </a>
            )}
            {q.solutionArticleUrl && (
              <a href={q.solutionArticleUrl} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100">
                📄 Read Article Solution
              </a>
            )}
            <button
              onClick={askInCommunity}
              disabled={creating}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200 hover:bg-purple-100 disabled:opacity-60">
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <MessageCircle className="w-3.5 h-3.5" />}
              {doubts.length > 0
                ? `💬 ${doubts.length} discussion${doubts.length === 1 ? "" : "s"} — add yours`
                : "💬 Discuss in Community"}
            </button>
          </div>

          {/* Existing linked discussions */}
          {doubts.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Existing Discussions</p>
              {doubts.slice(0, 3).map((d) => (
                <Link key={d.id} href={`/doubts/${d.id}`}>
                  <a className="block px-3 py-2 rounded border border-gray-100 hover:border-purple-300 hover:bg-purple-50 transition-colors text-xs">
                    <p className="font-semibold text-gray-800 truncate">{d.title}</p>
                    <p className="text-gray-500 mt-0.5">
                      by {d.askedBy} · {d.answerCount} answer{d.answerCount === 1 ? "" : "s"}
                      {d.resolved && <span className="ml-1.5 text-green-600 font-semibold">✓ Resolved</span>}
                    </p>
                  </a>
                </Link>
              ))}
              {doubts.length > 3 && (
                <p className="text-[10px] text-gray-400 px-1">+ {doubts.length - 3} more</p>
              )}
            </div>
          )}

          {/* Related discussions (topic/subtopic match) */}
          {relatedDoubts.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Related Discussions</p>
              {relatedDoubts.map((d) => (
                <Link key={d.id} href={`/doubts/${d.id}`}>
                  <a className="block px-3 py-2 rounded border border-gray-100 hover:border-blue-200 hover:bg-blue-50 transition-colors text-xs">
                    <p className="font-semibold text-gray-800 truncate">{d.title}</p>
                    <p className="text-gray-500 mt-0.5">
                      by {d.askedBy}
                      {d.resolved && <span className="ml-1.5 text-green-600 font-semibold">✓ Resolved</span>}
                    </p>
                  </a>
                </Link>
              ))}
            </div>
          )}

          <div className="text-xs text-gray-400">Topic: {q.topic}{q.subtopic && ` · ${q.subtopic}`}</div>
        </div>
      )}
    </div>
  );
}

/* ── Share Card Modal ── */
function ShareCardModal({
  open, onClose, result, shareText, waUrl, twUrl,
}: {
  open: boolean; onClose: () => void;
  result: Result; shareText: string; waUrl: string; twUrl: string;
}) {
  const trophy = result.percentile >= 90 ? "🏆" : result.percentile >= 75 ? "🥇" : result.percentile >= 50 ? "🎯" : "📚";
  const medal  = result.percentile >= 90 ? "Legendary" : result.percentile >= 75 ? "Elite" : result.percentile >= 50 ? "Good" : "Keep Going";
  const copyShare = async () => {
    try { await navigator.clipboard.writeText(shareText); toast.success("Copied — paste anywhere!"); }
    catch { toast.error("Copy failed"); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden border-0 bg-transparent shadow-2xl">
        {/* ── Shareable card (screenshot this) ── */}
        <div
          className="relative select-none"
          style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e1b4b 50%, #0f172a 100%)" }}
        >
          {/* accent blobs */}
          <div className="absolute top-0 left-0 w-40 h-40 bg-violet-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-40 h-40 bg-indigo-600/20 rounded-full blur-3xl pointer-events-none" />

          <div className="relative px-6 pt-6 pb-5 space-y-4">
            {/* Brand row */}
            <div className="flex items-center justify-between">
              <span className="text-white/40 text-[10px] font-bold uppercase tracking-widest">StudyCircle</span>
              <span className="text-white/40 text-[10px]">studycircle.app</span>
            </div>

            {/* Trophy + title */}
            <div className="text-center space-y-1">
              <div className="text-5xl">{trophy}</div>
              <p className="text-white font-black text-lg leading-snug">{result.examTitle}</p>
              <span className="inline-block px-3 py-0.5 rounded-full text-[11px] font-bold"
                style={{ background: result.percentile >= 75 ? "rgba(251,191,36,0.2)" : "rgba(139,92,246,0.2)",
                  color: result.percentile >= 75 ? "#fbbf24" : "#a78bfa" }}>
                {medal}
              </span>
            </div>

            {/* Big score */}
            <div className="text-center">
              <span className="text-6xl font-black text-white tabular-nums">{result.score}</span>
              <span className="text-white/40 text-xl font-bold ml-2">/ {result.totalMarks}</span>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: "Accuracy", value: `${result.accuracy.toFixed(0)}%`, color: "#34d399" },
                { label: "Percentile", value: `${result.percentile.toFixed(1)}`, color: "#818cf8" },
                { label: "Rank", value: `#${result.rank}`, color: "#fb923c" },
              ].map((s) => (
                <div key={s.label} className="rounded-xl py-3 text-center"
                  style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}>
                  <p className="font-black text-xl tabular-nums" style={{ color: s.color }}>{s.value}</p>
                  <p className="text-white/40 text-[10px] mt-0.5 font-medium">{s.label}</p>
                </div>
              ))}
            </div>

            {/* Attempts row */}
            <div className="flex items-center justify-center gap-4 text-xs">
              <span className="text-green-400 font-bold">✅ {result.correctCount} Correct</span>
              <span className="text-white/20">·</span>
              <span className="text-red-400 font-bold">❌ {result.wrongCount} Wrong</span>
              <span className="text-white/20">·</span>
              <span className="text-gray-400 font-bold">⏭ {result.skippedCount} Skip</span>
            </div>

            {/* CTA hint */}
            <p className="text-center text-white/30 text-[10px] pb-1">
              📸 Screenshot & share · or use the buttons below
            </p>
          </div>
        </div>

        {/* ── Action row ── */}
        <div className="bg-zinc-900 px-4 py-3 flex gap-2">
          <button onClick={copyShare}
            className="flex-1 flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold text-white/70 hover:text-white border border-white/10 hover:border-white/20 transition-colors">
            <Copy className="w-3.5 h-3.5" /> Copy text
          </button>
          <a href={waUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
            <button className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold text-white"
              style={{ background: "#25d366" }}>
              💬 WhatsApp
            </button>
          </a>
          <a href={twUrl} target="_blank" rel="noopener noreferrer" className="flex-1">
            <button className="w-full flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-semibold text-white bg-black border border-white/10">
              𝕏 Tweet
            </button>
          </a>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main page ── */
export default function ExamResult() {
  const [, params] = useRoute("/attempts/:id/result");
  const id = params?.id || "";
  const [filter, setFilter] = useState<"all" | "correct" | "wrong" | "skipped">("all");
  const [shareOpen, setShareOpen] = useState(false);

  const { data: result, isLoading, error } = useQuery<Result>({
    queryKey: ["exam-result", id],
    queryFn: () => customFetch(`/api/attempts/${id}/result`),
    enabled: !!id,
    staleTime: Infinity,
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto p-6 space-y-6">
        <Skeleton className="h-48 w-full rounded-xl" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !result) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center space-y-4">
        <p className="text-lg font-semibold text-gray-700">Results not available yet.</p>
        <p className="text-sm text-gray-500">The exam may not have been submitted, or results are loading.</p>
        <Link href="/exams"><Button variant="outline">Back to Exams</Button></Link>
      </div>
    );
  }

  const pieData = [
    { name: "Correct",  value: result.correctCount,  color: "#28a745" },
    { name: "Wrong",    value: result.wrongCount,     color: "#dc3545" },
    { name: "Skipped",  value: result.skippedCount,   color: "#adb5bd" },
  ].filter((d) => d.value > 0);

  const barData = result.topicBreakdown.map((t) => ({
    topic: t.topic.length > 14 ? t.topic.slice(0, 12) + "…" : t.topic,
    fullTopic: t.topic,
    accuracy: t.total > 0 ? Math.round((t.correct / t.total) * 100) : 0,
    correct: t.correct,
    total: t.total,
  }));

  // Growth loop: brag text + direct challenge link to the same exam
  const examLink = `${window.location.origin}/exams/${result.examId}`;
  const trophy = result.percentile >= 90 ? "🏆"
    : result.percentile >= 75 ? "🥇"
    : result.percentile >= 50 ? "🎯" : "📚";
  const shareText = [
    `${trophy} I scored ${result.score}/${result.totalMarks} in ${result.examTitle} on StudyCircle!`,
    `📊 Rank #${result.rank} of ${result.totalParticipants}  ·  ${result.percentile.toFixed(1)} percentile`,
    `✅ ${result.correctCount} correct  ·  ❌ ${result.wrongCount} wrong  ·  ⏱ ${result.timeSpentMinutes} min`,
    ``,
    `Think you can beat me? Take the same mock 👇`,
    examLink,
  ].join("\n");
  const waUrl  = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
  const twUrl  = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText.split("\n").slice(0, 4).join("\n"))}&url=${encodeURIComponent(examLink)}`;

  const filtered = filter === "all" ? result.questions : result.questions.filter((q) => q.verdict === filter);

  return (
    <div className="min-h-screen bg-gray-50" style={{ colorScheme: "light" }}>
      <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* ── Hero ── */}
        <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-md border border-gray-100 overflow-hidden">
          <div style={{ background: "linear-gradient(135deg, #212c5e 0%, #3b5fe3 100%)" }}
            className="px-8 py-6 flex items-center gap-5">
            <div style={{ background: "rgba(255,255,255,0.15)", border: "2px solid rgba(255,255,255,0.3)" }}
              className="w-16 h-16 rounded-full flex items-center justify-center shrink-0">
              <Trophy className="w-8 h-8 text-yellow-300" />
            </div>
            <div className="min-w-0">
              <p className="text-white/70 text-sm">Exam Completed</p>
              <h1 className="text-white font-extrabold text-2xl leading-tight truncate">{result.examTitle}</h1>
              {result.examName && <p className="text-white/60 text-xs mt-0.5">{result.examName}</p>}
            </div>
            <div className="ml-auto shrink-0">
              <button
                onClick={() => setShareOpen(true)}
                style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.3)", color: "#fff" }}
                className="h-9 px-4 rounded-lg text-sm font-semibold hover:bg-white/25 transition-colors flex items-center gap-2">
                <Share2 className="w-4 h-4" /> Share Result
              </button>
            </div>
          </div>

          {/* Score row */}
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y md:divide-y-0 divide-gray-100">
            <div className="p-5 text-center">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Score</p>
              <p className="text-4xl font-black text-blue-700">{result.score}</p>
              <p className="text-xs text-gray-400 mt-1">out of {result.totalMarks}</p>
            </div>
            <div className="p-5 text-center">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Accuracy</p>
              <p className="text-4xl font-black text-gray-800">{result.accuracy.toFixed(1)}%</p>
              <p className="text-xs text-gray-400 mt-1">{result.correctCount} correct</p>
            </div>
            <div className="p-5 text-center">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Percentile</p>
              <p className="text-4xl font-black text-indigo-600">{result.percentile.toFixed(1)}</p>
              <p className="text-xs text-gray-400 mt-1">
                {result.totalParticipants >= 2
                  ? `Beat ${Math.round(result.percentile)}% of students`
                  : `Rank #${result.rank}`}
              </p>
            </div>
            <div className="p-5 text-center">
              <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Time</p>
              <p className="text-4xl font-black text-gray-800">{result.timeSpentMinutes}m</p>
              <p className="text-xs text-gray-400 mt-1">
                ~{Math.round((result.timeSpentMinutes * 60) / result.questions.length)}s / question
              </p>
            </div>
          </div>
        </motion.div>

        {/* ── Percentile Banner ── */}
        <PercentileBanner
          percentile={result.percentile}
          rank={result.rank}
          totalParticipants={result.totalParticipants}
        />

        {/* ── Comparison + Marks row ── */}
        <div className={result.totalParticipants >= 2 ? "grid grid-cols-1 md:grid-cols-2 gap-6" : ""}>
          {result.totalParticipants >= 2 && (
            <ComparisonPanel
              score={result.score}
              totalMarks={result.totalMarks}
              classAvg={result.classAverageScore}
              topScore={result.topScore}
              totalParticipants={result.totalParticipants}
            />
          )}
          <MarksBreakdown questions={result.questions} totalMarks={result.totalMarks} />
        </div>

        {/* ── Charts row ── */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Pie */}
          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-5 flex flex-col">
            <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-4">Attempt Breakdown</h2>
            <div className="flex-1 flex items-center justify-center">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" innerRadius={48} outerRadius={68}
                    paddingAngle={3} dataKey="value" nameKey="name">
                    {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Tooltip formatter={(v, n) => [`${v}`, n]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-2">
              {[
                { label: "Correct",  count: result.correctCount,  color: "#28a745", Icon: CheckCircle2 },
                { label: "Wrong",    count: result.wrongCount,     color: "#dc3545", Icon: XCircle },
                { label: "Skipped",  count: result.skippedCount,   color: "#adb5bd", Icon: MinusCircle },
              ].map(({ label, count, color, Icon }) => (
                <div key={label} className="flex items-center justify-between text-sm">
                  <span className="flex items-center gap-1.5 text-gray-600">
                    <Icon className="w-4 h-4" style={{ color }} /> {label}
                  </span>
                  <span className="font-bold text-gray-800">{count}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Topic bar chart */}
          <div className="md:col-span-2 bg-white rounded-xl border border-gray-100 shadow-sm p-5">
            <h2 className="text-sm font-bold text-gray-600 uppercase tracking-wider mb-4 flex items-center gap-2">
              <BarChart3 className="w-4 h-4" /> Topic-wise Accuracy
            </h2>
            {barData.length === 0 ? (
              <p className="text-sm text-gray-400 mt-8 text-center">No topic data available.</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={barData} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
                  <XAxis dataKey="topic" axisLine={false} tickLine={false} tick={{ fontSize: 11 }} />
                  <YAxis domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10 }} unit="%" />
                  <Tooltip
                    formatter={(v: any, _: any, props: any) => [`${v}% (${props.payload?.correct}/${props.payload?.total})`, "Accuracy"]}
                    labelFormatter={(l: any, p: any) => p?.[0]?.payload?.fullTopic || l}
                    contentStyle={{ borderRadius: 8, border: "1px solid #e9ecef", fontSize: 12 }}
                  />
                  <Bar dataKey="accuracy" radius={[4, 4, 0, 0]} maxBarSize={40}>
                    {barData.map((d, i) => (
                      <Cell key={i} fill={d.accuracy >= 70 ? "#28a745" : d.accuracy >= 40 ? "#ffc107" : "#dc3545"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
            <div className="flex gap-3 mt-2 text-xs text-gray-500">
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-green-500" /> ≥70%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-yellow-400" /> 40–69%</span>
              <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-sm inline-block bg-red-500" /> &lt;40%</span>
            </div>
          </div>
        </div>

        {/* ── Focus Areas ── */}
        <FocusAreas topicBreakdown={result.topicBreakdown} />

        {/* ── Subject drill-down — only shown if questions are tagged with subjects ── */}
        {result.subjectBreakdown.length > 0 && (
          <SubjectDrillDown
            subjects={result.subjectBreakdown}
            topics={result.topicBreakdown}
            subtopics={result.subtopicBreakdown}
            questions={result.questions}
          />
        )}

        {/* ── Question Review ── */}
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 px-5 py-4 border-b border-gray-100">
            <h2 className="font-bold text-gray-800">Question Review</h2>
            <div className="flex flex-wrap gap-1.5">
              {(["all", "correct", "wrong", "skipped"] as const).map((f) => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{
                    background: filter === f
                      ? (f === "correct" ? "#28a745" : f === "wrong" ? "#dc3545" : f === "skipped" ? "#6c757d" : "#212c5e")
                      : "#f0f0f0",
                    color: filter === f ? "#fff" : "#555",
                  }}
                  className="h-7 px-3 rounded-full text-xs font-semibold capitalize transition-colors hover:opacity-90">
                  {f === "all" ? `All (${result.questions.length})` :
                    f === "correct" ? `✓ ${result.correctCount}` :
                    f === "wrong"   ? `✗ ${result.wrongCount}` :
                    `— ${result.skippedCount}`}
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 space-y-2">
            {filtered.length === 0 ? (
              <p className="text-center text-sm text-gray-400 py-6">No questions in this category.</p>
            ) : (
              filtered.map((q) => <QuestionCard key={q.id} q={q} examId={result.examId} examTitle={result.examTitle} />)
            )}
          </div>
        </div>

        {/* ── Footer actions ── */}
        <div className="flex flex-wrap gap-3 justify-center pb-6">
          {result.wrongCount > 0 && (
            <Link href={`/practice?attemptId=${result.attemptId}`}>
              <Button variant="outline" className="gap-2 border-rose-500/40 text-rose-400 hover:bg-rose-500/10">
                <RotateCcw className="w-4 h-4" /> Retry {result.wrongCount} Wrong
              </Button>
            </Link>
          )}
          <Link href="/exams">
            <Button variant="outline" className="gap-2">
              <RotateCcw className="w-4 h-4" /> Take Another Exam
            </Button>
          </Link>
          <Link href={`/exams/${result.examId}/leaderboard`}>
            <Button variant="outline" className="gap-2">
              <Medal className="w-4 h-4" /> View Leaderboard
            </Button>
          </Link>
          <Link href="/analytics">
            <Button className="gap-2">
              <BarChart3 className="w-4 h-4" /> View Analytics
            </Button>
          </Link>
        </div>
      </div>

      <ShareCardModal
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        result={result}
        shareText={shareText}
        waUrl={waUrl}
        twUrl={twUrl}
      />
    </div>
  );
}
