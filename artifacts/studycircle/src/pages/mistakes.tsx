import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { MathText } from "@/components/math-text";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link } from "wouter";
import {
  BookMarked, Crown, Lock, CheckCircle2, XCircle,
  ChevronDown, RotateCcw, Sparkles, AlertCircle
} from "lucide-react";
import { useExamPreference } from "@/hooks/use-exam-preference";

const LABELS = ["A", "B", "C", "D", "E"];

type Mistake = {
  questionId: string;
  kind: "mcq" | "msq" | "nat";
  body: string;
  imageUrl?: string | null;
  topic: string;
  subject?: string | null;
  subtopic?: string | null;
  source?: string | null;
  marks: number;
  optionsJson: { id: string; body: string }[];
  correctIds: string[];
  explanation?: string | null;
  natAnswer?: number | null;
  yourSelectedIds: string[];
  yourNatValue?: number | null;
  yourStatus: string;
  exam: string;
  examTitle: string;
  takenAt?: string | null;
};

type MistakesResponse = { mistakes: Mistake[]; total: number; hasMore: boolean; isPro: boolean };

function MistakeCard({ m, index }: { m: Mistake; index: number }) {
  const [reattemptMode, setReattemptMode]   = useState(false);
  const [selected, setSelected]             = useState<string[]>([]);
  const [natInput, setNatInput]             = useState("");
  const [reattemptDone, setReattemptDone]   = useState(false);
  const [showExplanation, setShowExplanation] = useState(false);

  const reattemptCorrect = () => {
    if (m.kind === "nat") {
      const v = parseFloat(natInput);
      return !isNaN(v) && m.natAnswer !== null && m.natAnswer !== undefined && Math.abs(v - m.natAnswer) <= 0.01;
    }
    const correct = new Set(m.correctIds);
    const given   = new Set(selected);
    return correct.size === given.size && [...correct].every(id => given.has(id));
  };

  const optionLabel = (id: string) => {
    const i = m.optionsJson.findIndex(o => o.id === id);
    return i >= 0 ? LABELS[i] : id;
  };

  const yourWasUnanswered = m.yourStatus === "unanswered";

  return (
    <Card className="border-border">
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">#{index + 1}</span>
          <Badge className="text-[11px] bg-primary/10 text-primary border-primary/20">{m.exam}</Badge>
          {m.source  && <Badge variant="outline" className="text-[11px]">{m.source}</Badge>}
          {m.topic   && <Badge variant="outline" className="text-[11px] text-muted-foreground">{m.topic}</Badge>}
          {m.takenAt && (
            <span className="ml-auto text-[11px] text-muted-foreground">
              {new Date(m.takenAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
            </span>
          )}
        </div>

        {/* Question body */}
        <p className="text-sm leading-relaxed text-foreground"><MathText text={m.body} /></p>
        {m.imageUrl && <img src={m.imageUrl} alt="diagram" className="max-w-full max-h-40 rounded border object-contain" />}

        {/* Your answer vs Correct answer (review mode) */}
        {!reattemptMode && !reattemptDone && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20">
              <p className="text-[10px] font-bold text-rose-500 uppercase tracking-wide mb-1">Your Answer</p>
              {yourWasUnanswered ? (
                <p className="text-xs text-rose-600 dark:text-rose-400 font-medium">Not attempted</p>
              ) : m.kind === "nat" ? (
                <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">{m.yourNatValue ?? "—"}</p>
              ) : (
                <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">
                  {m.yourSelectedIds.length === 0 ? "—" : m.yourSelectedIds.map(optionLabel).join(", ")}
                </p>
              )}
            </div>
            <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-wide mb-1">Correct Answer</p>
              {m.kind === "nat" ? (
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">{m.natAnswer}</p>
              ) : (
                <p className="text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                  {m.correctIds.map(optionLabel).join(", ")}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Re-attempt mode */}
        {reattemptMode && !reattemptDone && (
          <div className="space-y-2 border-t pt-4">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Re-attempt</p>
            {m.kind === "mcq" && (
              <div className="space-y-2">
                {m.optionsJson.map((opt, i) => {
                  const sel = selected[0] === opt.id;
                  return (
                    <button key={opt.id} onClick={() => setSelected([opt.id])}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left text-sm transition-colors
                        ${sel ? "bg-primary/10 border-primary/40" : "border-border hover:bg-muted/50"}`}>
                      <span className={`w-5 h-5 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0
                        ${sel ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {LABELS[i]}
                      </span>
                      <MathText text={opt.body} />
                    </button>
                  );
                })}
              </div>
            )}
            {m.kind === "msq" && (
              <div className="space-y-2">
                {m.optionsJson.map((opt, i) => {
                  const sel = selected.includes(opt.id);
                  return (
                    <button key={opt.id}
                      onClick={() => setSelected(p => sel ? p.filter(x => x !== opt.id) : [...p, opt.id])}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-lg border text-left text-sm transition-colors
                        ${sel ? "bg-primary/10 border-primary/40" : "border-border hover:bg-muted/50"}`}>
                      <span className={`w-5 h-5 rounded text-[11px] font-bold flex items-center justify-center shrink-0
                        ${sel ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                        {sel ? "✓" : LABELS[i]}
                      </span>
                      <MathText text={opt.body} />
                    </button>
                  );
                })}
              </div>
            )}
            {m.kind === "nat" && (
              <input type="number" step="any" placeholder="Your answer"
                value={natInput} onChange={e => setNatInput(e.target.value)}
                className="h-10 px-3 rounded-lg border border-border bg-background text-sm w-48 focus:outline-none focus:ring-1 focus:ring-primary" />
            )}
            <div className="flex gap-2 pt-1">
              <Button size="sm"
                disabled={(m.kind !== "nat" && selected.length === 0) || (m.kind === "nat" && !natInput)}
                onClick={() => setReattemptDone(true)}>
                Submit
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setReattemptMode(false); setSelected([]); setNatInput(""); }}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        {/* Re-attempt result */}
        {reattemptDone && (
          <div className={`p-3 rounded-lg border flex items-center gap-3 ${reattemptCorrect() ? "bg-emerald-500/10 border-emerald-500/30" : "bg-rose-500/10 border-rose-500/30"}`}>
            {reattemptCorrect()
              ? <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0" />
              : <XCircle      className="w-5 h-5 text-rose-500 shrink-0" />}
            <div className="flex-1 text-sm">
              <p className={`font-semibold ${reattemptCorrect() ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
                {reattemptCorrect() ? "You got it! Great improvement." : "Still incorrect — review the solution below."}
              </p>
              {!reattemptCorrect() && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  Correct: {m.kind === "nat" ? m.natAnswer : m.correctIds.map(optionLabel).join(", ")}
                </p>
              )}
            </div>
            <Button size="sm" variant="ghost" className="shrink-0"
              onClick={() => { setReattemptDone(false); setReattemptMode(false); setSelected([]); setNatInput(""); }}>
              <RotateCcw className="w-3.5 h-3.5" />
            </Button>
          </div>
        )}

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap border-t pt-3">
          {!reattemptMode && !reattemptDone && (
            <Button size="sm" variant="outline" className="gap-1.5"
              onClick={() => setReattemptMode(true)}>
              <RotateCcw className="w-3.5 h-3.5" /> Re-attempt
            </Button>
          )}
          {m.explanation && (
            <Button size="sm" variant="ghost" className="gap-1 ml-auto"
              onClick={() => setShowExplanation(v => !v)}>
              {showExplanation ? <ChevronDown className="w-3.5 h-3.5 rotate-180" /> : <ChevronDown className="w-3.5 h-3.5" />}
              {showExplanation ? "Hide" : "Show"} Explanation
            </Button>
          )}
        </div>

        {showExplanation && m.explanation && (
          <div className="p-3 rounded-lg bg-muted/40 border border-border text-sm text-muted-foreground leading-relaxed">
            <p className="font-semibold text-foreground mb-1 text-xs uppercase tracking-wide">Explanation</p>
            <MathText text={m.explanation} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function MistakeNotebook() {
  const [examFilter,  setExamFilter]  = useExamPreference();
  const [topicFilter, setTopicFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [allMistakes, setAllMistakes] = useState<Mistake[]>([]);

  useEffect(() => { setPage(1); setAllMistakes([]); }, [examFilter, topicFilter]);

  const params = new URLSearchParams();
  if (examFilter  !== "ALL") params.set("exam",  examFilter);
  if (topicFilter !== "all") params.set("topic", topicFilter);
  params.set("page", String(page));

  const { data: resp, isLoading, isFetching } = useQuery<MistakesResponse>({
    queryKey: ["mistakes", examFilter, topicFilter, page],
    queryFn:  () => customFetch(`/api/mistakes?${params}`),
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!resp) return;
    if (page === 1) setAllMistakes(resp.mistakes);
    else setAllMistakes(prev => {
      const ids = new Set(prev.map(m => m.questionId));
      return [...prev, ...resp.mistakes.filter(m => !ids.has(m.questionId))];
    });
  }, [resp, page]);

  const isPro  = resp?.isPro ?? false;
  const total  = resp?.total ?? 0;

  // Extract unique exams + topics for filters
  const exams  = [...new Set(allMistakes.map(m => m.exam))].sort();
  const topics = [...new Set(allMistakes.map(m => m.topic))].sort();

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BookMarked className="w-6 h-6 text-rose-500" /> Mistake Notebook
            {!isPro && (
              <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/30 gap-1 text-xs">
                <Lock className="w-3 h-3" /> Free Preview
              </Badge>
            )}
            {isPro && (
              <Badge className="bg-primary/10 text-primary border-primary/20 gap-1 text-xs">
                <Crown className="w-3 h-3" /> Pro
              </Badge>
            )}
          </h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            {total > 0
              ? `${total}${!isPro && total >= 10 ? "+" : ""} questions you got wrong — review and fix them`
              : "Wrong answers from your mock tests appear here automatically"}
          </p>
        </div>
        {!isPro && (
          <Link href="/settings">
            <Button size="sm" className="gap-1.5 bg-amber-500 hover:bg-amber-400 text-white border-0">
              <Sparkles className="w-3.5 h-3.5" /> Upgrade to Pro
            </Button>
          </Link>
        )}
      </div>

      {/* Stats row */}
      {total > 0 && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[
            { label: "Total Mistakes",   value: isPro ? total : `${total}+`, color: "text-rose-500",   bg: "bg-rose-500/10"   },
            { label: "Exams Covered",    value: exams.length,                color: "text-primary",    bg: "bg-primary/10"    },
            { label: "Topics to Fix",    value: topics.length,               color: "text-amber-500",  bg: "bg-amber-500/10"  },
          ].map(s => (
            <div key={s.label} className={`${s.bg} rounded-xl p-4 border border-white/5`}>
              <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      {/* Free limit banner */}
      {!isPro && total >= 10 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm">
          <span className="text-amber-700 dark:text-amber-400">
            Showing your 10 most recent mistakes. Upgrade to Pro to see all {total}+ and unlock explanations.
          </span>
          <Link href="/settings">
            <Button size="sm" className="shrink-0 bg-amber-500 hover:bg-amber-400 text-white border-0 gap-1">
              <Crown className="w-3.5 h-3.5" /> Go Pro
            </Button>
          </Link>
        </div>
      )}

      {/* Filters */}
      {(exams.length > 1 || topics.length > 1) && (
        <div className="flex flex-wrap items-center gap-2">
          {exams.length > 1 && (
            <Select value={examFilter} onValueChange={(v) => setExamFilter(v as typeof examFilter)}>
              <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Exam" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Exams</SelectItem>
                {exams.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {topics.length > 1 && (
            <Select value={topicFilter} onValueChange={setTopicFilter}>
              <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Topic" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Topics</SelectItem>
                {topics.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* List */}
      {isLoading && page === 1 ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      ) : allMistakes.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 border-dashed text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <p className="font-semibold text-muted-foreground">No mistakes found</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Complete a mock test and submit it — wrong answers will automatically appear here.
          </p>
          <Link href="/exams" className="mt-4">
            <Button variant="outline" size="sm">Browse Mock Exams</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {allMistakes.map((m, i) => (
            <MistakeCard key={m.questionId} m={m} index={i} />
          ))}

          {resp?.hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" className="gap-2" disabled={isFetching}
                onClick={() => setPage(p => p + 1)}>
                {isFetching ? "Loading…" : <><ChevronDown className="w-4 h-4" /> Load more</>}
              </Button>
            </div>
          )}

          {!isPro && !resp?.hasMore && total >= 10 && (
            <div className="text-center py-6 space-y-3">
              <p className="text-muted-foreground text-sm">You've reached the free preview limit of 10 mistakes.</p>
              <Link href="/settings">
                <Button className="gap-2 bg-amber-500 hover:bg-amber-400 text-white border-0">
                  <Crown className="w-4 h-4" /> Upgrade to Pro — unlock all {total}+ mistakes
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
