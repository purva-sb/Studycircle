import { useState, useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { MathText } from "@/components/math-text";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link } from "wouter";
import {
  Library, Lock, ChevronDown, ChevronUp, CheckCircle2,
  XCircle, Sparkles, Crown, BookOpen, Filter, Bookmark, BookmarkCheck
} from "lucide-react";
import { useExamPreference } from "@/hooks/use-exam-preference";

const LABELS = ["A", "B", "C", "D", "E"];

type PYQQuestion = {
  id: string;
  kind: "mcq" | "msq" | "nat";
  body: string;
  imageUrl?: string | null;
  marks: number;
  negativeMarks: number;
  topic: string;
  subject?: string | null;
  subtopic?: string | null;
  source?: string | null;
  optionsJson: { id: string; body: string }[];
  correctOptionIds: string[];
  explanation?: string | null;
  natAnswer?: number | null;
  exam: string;
  examTitle: string;
};

type PYQMeta = { years: string[]; subjects: string[]; topics: string[]; exams: string[] };
type PYQResponse = { questions: PYQQuestion[]; total: number; page: number; hasMore: boolean; isPro: boolean };

function QuestionCard({
  q, isPro, index, bookmarked, onToggleBookmark,
}: {
  q: PYQQuestion; isPro: boolean; index: number;
  bookmarked: boolean; onToggleBookmark: () => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [natInput, setNatInput]  = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [showSolution, setShowSolution] = useState(false);

  const isCorrect = () => {
    if (q.kind === "nat") {
      const given = parseFloat(natInput);
      return !isNaN(given) && q.natAnswer !== null && q.natAnswer !== undefined && Math.abs(given - q.natAnswer) <= 0.01;
    }
    const correct = new Set(q.correctOptionIds);
    const given   = new Set(selected);
    return correct.size === given.size && [...correct].every(id => given.has(id));
  };

  const handleSubmit = () => { if (selected.length > 0 || natInput) setSubmitted(true); };
  const handleReset  = () => { setSelected([]); setNatInput(""); setSubmitted(false); setShowSolution(false); };

  const correct = submitted && isCorrect();
  const wrong   = submitted && !isCorrect();

  return (
    <Card className={`border transition-colors ${submitted ? (correct ? "border-emerald-500/40 bg-emerald-500/5" : "border-rose-500/40 bg-rose-500/5") : "border-border"}`}>
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded">Q{index + 1}</span>
          <Badge className="text-[11px] bg-primary/10 text-primary border-primary/20">{q.exam}</Badge>
          {q.source && <Badge variant="outline" className="text-[11px]">{q.source}</Badge>}
          {q.topic  && <Badge variant="outline" className="text-[11px] text-muted-foreground">{q.topic}</Badge>}
          <span className="ml-auto flex items-center gap-2">
            <span className="text-[11px] text-muted-foreground font-medium">+{q.marks} / −{q.negativeMarks}</span>
            <button
              onClick={onToggleBookmark}
              className="p-1 rounded hover:bg-muted transition-colors text-muted-foreground hover:text-primary"
              title={bookmarked ? "Remove bookmark" : "Bookmark this question"}
            >
              {bookmarked
                ? <BookmarkCheck className="w-4 h-4 text-primary" />
                : <Bookmark className="w-4 h-4" />}
            </button>
          </span>
        </div>

        {/* Body */}
        <p className="text-sm leading-relaxed text-foreground">
          <MathText text={q.body} />
        </p>
        {q.imageUrl && <img src={q.imageUrl} alt="diagram" className="max-w-full max-h-48 rounded border object-contain" />}

        {/* Options — MCQ */}
        {q.kind === "mcq" && (
          <div className="space-y-2">
            {q.optionsJson.map((opt, i) => {
              const sel = selected[0] === opt.id;
              const isRight = submitted && q.correctOptionIds.includes(opt.id);
              const isWrong = submitted && sel && !q.correctOptionIds.includes(opt.id);
              return (
                <button key={opt.id} disabled={submitted}
                  onClick={() => setSelected([opt.id])}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left text-sm transition-colors
                    ${isRight  ? "bg-emerald-500/10 border-emerald-500/40 text-emerald-700 dark:text-emerald-400" :
                      isWrong  ? "bg-rose-500/10 border-rose-500/40 text-rose-700 dark:text-rose-400" :
                      sel      ? "bg-primary/10 border-primary/40" :
                      "border-border hover:bg-muted/50"}`}>
                  <span className={`w-6 h-6 rounded-full text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5
                    ${sel || isRight ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {LABELS[i]}
                  </span>
                  <MathText text={opt.body} />
                  {isRight && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 ml-auto mt-0.5" />}
                  {isWrong && <XCircle     className="w-4 h-4 text-rose-500 shrink-0 ml-auto mt-0.5" />}
                </button>
              );
            })}
          </div>
        )}

        {/* Options — MSQ */}
        {q.kind === "msq" && (
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground italic">Select all that apply.</p>
            {q.optionsJson.map((opt, i) => {
              const sel    = selected.includes(opt.id);
              const isRight = submitted && q.correctOptionIds.includes(opt.id);
              const isWrong = submitted && sel && !q.correctOptionIds.includes(opt.id);
              return (
                <button key={opt.id} disabled={submitted}
                  onClick={() => setSelected(p => sel ? p.filter(x => x !== opt.id) : [...p, opt.id])}
                  className={`w-full flex items-start gap-3 p-3 rounded-lg border text-left text-sm transition-colors
                    ${isRight  ? "bg-emerald-500/10 border-emerald-500/40" :
                      isWrong  ? "bg-rose-500/10 border-rose-500/40" :
                      sel      ? "bg-primary/10 border-primary/40" :
                      "border-border hover:bg-muted/50"}`}>
                  <span className={`w-5 h-5 rounded text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5
                    ${sel || isRight ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                    {sel ? "✓" : LABELS[i]}
                  </span>
                  <MathText text={opt.body} />
                  {isRight && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 ml-auto mt-0.5" />}
                  {isWrong && <XCircle     className="w-4 h-4 text-rose-500 shrink-0 ml-auto mt-0.5" />}
                </button>
              );
            })}
          </div>
        )}

        {/* NAT */}
        {q.kind === "nat" && (
          <div className="space-y-2 max-w-xs">
            <p className="text-xs text-muted-foreground italic">Enter a numerical value.</p>
            <input type="number" step="any" disabled={submitted}
              placeholder="Your answer"
              value={natInput}
              onChange={e => setNatInput(e.target.value)}
              className="w-full h-10 px-3 rounded-lg border border-border bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary" />
            {submitted && (
              <p className={`text-xs font-semibold ${correct ? "text-emerald-500" : "text-rose-500"}`}>
                Correct answer: {q.natAnswer}
              </p>
            )}
          </div>
        )}

        {/* Action row */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          {!submitted ? (
            <Button size="sm" onClick={handleSubmit}
              disabled={(q.kind !== "nat" && selected.length === 0) || (q.kind === "nat" && !natInput)}>
              Check Answer
            </Button>
          ) : (
            <>
              <span className={`flex items-center gap-1.5 text-sm font-semibold ${correct ? "text-emerald-500" : "text-rose-500"}`}>
                {correct ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />}
                {correct ? "Correct!" : "Incorrect"}
              </span>
              <Button size="sm" variant="outline" onClick={handleReset}>Try Again</Button>
            </>
          )}

          {/* Solution reveal */}
          {(submitted || true) && (
            isPro ? (
              q.explanation ? (
                <Button size="sm" variant="ghost" className="ml-auto gap-1"
                  onClick={() => setShowSolution(v => !v)}>
                  {showSolution ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  {showSolution ? "Hide Solution" : "Show Solution"}
                </Button>
              ) : null
            ) : (
              <Link href="/settings" className="ml-auto">
                <Button size="sm" variant="outline" className="gap-1.5 border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10">
                  <Lock className="w-3 h-3" /> Unlock Solution — Pro
                </Button>
              </Link>
            )
          )}
        </div>

        {/* Solution */}
        {showSolution && isPro && q.explanation && (
          <div className="mt-2 p-3 rounded-lg bg-muted/40 border border-border text-sm text-muted-foreground leading-relaxed">
            <p className="font-semibold text-foreground mb-1 text-xs uppercase tracking-wide">Solution</p>
            <MathText text={q.explanation} />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function PYQBank() {
  const [examFilter,    setExamFilter]    = useExamPreference();
  const [yearFilter,    setYearFilter]    = useState("all");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [topicFilter,   setTopicFilter]   = useState("all");
  const [kindFilter,    setKindFilter]    = useState("all");
  const [page, setPage] = useState(1);
  const [allQuestions, setAllQuestions]   = useState<PYQQuestion[]>([]);
  const [bookmarkedIds, setBookmarkedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    customFetch<{ questionId: string }[]>("/api/bookmarks")
      .then(rows => setBookmarkedIds(new Set(rows.map(r => r.questionId))))
      .catch(() => {});
  }, []);

  const toggleBookmark = useCallback((questionId: string) => {
    const isBookmarked = bookmarkedIds.has(questionId);
    setBookmarkedIds(prev => {
      const next = new Set(prev);
      isBookmarked ? next.delete(questionId) : next.add(questionId);
      return next;
    });
    const url = `/api/bookmarks/${questionId}`;
    customFetch(url, { method: isBookmarked ? "DELETE" : "POST" }).catch(() => {
      // revert on failure
      setBookmarkedIds(prev => {
        const next = new Set(prev);
        isBookmarked ? next.add(questionId) : next.delete(questionId);
        return next;
      });
    });
  }, [bookmarkedIds]);

  // Reset on filter change
  useEffect(() => { setPage(1); setAllQuestions([]); }, [examFilter, yearFilter, subjectFilter, topicFilter, kindFilter]);

  const { data: meta } = useQuery<PYQMeta>({
    queryKey: ["pyqs-meta"],
    queryFn:  () => customFetch("/api/pyqs/meta"),
    staleTime: 5 * 60_000,
  });

  const params = new URLSearchParams();
  if (examFilter    !== "ALL") params.set("exam",    examFilter);
  if (yearFilter    !== "all") params.set("year",    yearFilter);
  if (subjectFilter !== "all") params.set("subject", subjectFilter);
  if (topicFilter   !== "all") params.set("topic",   topicFilter);
  if (kindFilter    !== "all") params.set("kind",    kindFilter);
  params.set("page", String(page));

  const { data: resp, isLoading, isFetching } = useQuery<PYQResponse>({
    queryKey: ["pyqs-questions", examFilter, yearFilter, subjectFilter, topicFilter, kindFilter, page],
    queryFn:  () => customFetch(`/api/pyqs/questions?${params}`),
    staleTime: 2 * 60_000,
  });

  useEffect(() => {
    if (!resp) return;
    if (page === 1) setAllQuestions(resp.questions);
    else setAllQuestions(prev => {
      const ids = new Set(prev.map(q => q.id));
      return [...prev, ...resp.questions.filter(q => !ids.has(q.id))];
    });
  }, [resp, page]);

  const isPro  = resp?.isPro ?? false;
  const total  = resp?.total ?? 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Library className="w-6 h-6 text-primary" /> PYQ Bank
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
            {total > 0 ? `${total}${!isPro ? "+" : ""} questions from past exams` : "Practice previous year questions"}
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

      {/* Free limit banner */}
      {!isPro && total > 0 && (
        <div className="flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-sm">
          <span className="text-amber-700 dark:text-amber-400">
            Showing 10 of {total}+ questions. Upgrade to Pro to access all years, solutions, and explanations.
          </span>
          <Link href="/settings">
            <Button size="sm" className="shrink-0 bg-amber-500 hover:bg-amber-400 text-white border-0 gap-1">
              <Crown className="w-3.5 h-3.5" /> Go Pro
            </Button>
          </Link>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2 p-3 bg-card rounded-xl border">
        <Filter className="w-4 h-4 text-muted-foreground shrink-0" />

        {/* Exam */}
        <Select value={examFilter} onValueChange={(v) => setExamFilter(v as typeof examFilter)}>
          <SelectTrigger className="h-8 w-32 text-xs"><SelectValue placeholder="Exam" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Exams</SelectItem>
            {meta?.exams.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Year */}
        <Select value={yearFilter} onValueChange={setYearFilter}>
          <SelectTrigger className="h-8 w-28 text-xs"><SelectValue placeholder="Year" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {meta?.years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>

        {/* Subject */}
        {(meta?.subjects.length ?? 0) > 0 && (
          <Select value={subjectFilter} onValueChange={setSubjectFilter}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue placeholder="Subject" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Subjects</SelectItem>
              {meta?.subjects.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {/* Topic */}
        {(meta?.topics.length ?? 0) > 0 && (
          <Select value={topicFilter} onValueChange={setTopicFilter}>
            <SelectTrigger className="h-8 w-40 text-xs"><SelectValue placeholder="Topic" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Topics</SelectItem>
              {meta?.topics.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        )}

        {/* Kind */}
        <Tabs value={kindFilter} onValueChange={setKindFilter} className="ml-auto">
          <TabsList className="h-8">
            <TabsTrigger value="all"  className="text-xs px-3">All</TabsTrigger>
            <TabsTrigger value="mcq"  className="text-xs px-3">MCQ</TabsTrigger>
            <TabsTrigger value="msq"  className="text-xs px-3">MSQ</TabsTrigger>
            <TabsTrigger value="nat"  className="text-xs px-3">NAT</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Questions */}
      {isLoading && page === 1 ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : allQuestions.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-12 border-dashed text-center">
          <BookOpen className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <p className="font-semibold text-muted-foreground">No PYQ questions found</p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Admin can add PYQ exams by setting exam type to "pyq" and tagging questions with a source year.
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {allQuestions.map((q, i) => (
            <QuestionCard
              key={q.id} q={q} isPro={isPro} index={i}
              bookmarked={bookmarkedIds.has(q.id)}
              onToggleBookmark={() => toggleBookmark(q.id)}
            />
          ))}

          {resp?.hasMore && (
            <div className="flex justify-center pt-2">
              <Button variant="outline" className="gap-2" disabled={isFetching}
                onClick={() => setPage(p => p + 1)}>
                {isFetching ? "Loading…" : <><ChevronDown className="w-4 h-4" /> Load more</>}
              </Button>
            </div>
          )}

          {!isPro && !resp?.hasMore && total > 10 && (
            <div className="text-center py-6 space-y-3">
              <p className="text-muted-foreground text-sm">You've reached the free preview limit.</p>
              <Link href="/settings">
                <Button className="gap-2 bg-amber-500 hover:bg-amber-400 text-white border-0">
                  <Crown className="w-4 h-4" /> Upgrade to Pro — unlock all {total}+ questions
                </Button>
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
