import { useState } from "react";
import { useSearch, Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  CheckCircle2, XCircle, ArrowRight, RotateCcw,
  Target, BookOpen, ChevronLeft, Lightbulb, AlertCircle,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type Option = { id: string; body: string };
type PracticeQuestion = {
  id: string;
  kind: "mcq" | "msq" | "nat";
  body: string;
  imageUrl?: string | null;
  topic: string;
  subtopic?: string | null;
  subject?: string | null;
  source?: string | null;
  marks: number;
  negativeMarks: number;
  options: Option[];
};

type CheckResult = {
  questionId: string;
  correct: boolean;
  skipped: boolean;
  correctOptionIds: string[];
  natAnswer?: number | null;
  explanation?: string | null;
};

type UserAnswer = {
  questionId: string;
  selectedOptionIds: string[];
  natValue?: number;
};

// ── Question Card ─────────────────────────────────────────────────────────────

function QuestionCard({
  question,
  index,
  total,
  onAnswer,
}: {
  question: PracticeQuestion;
  index: number;
  total: number;
  onAnswer: (answer: UserAnswer) => void;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [natInput, setNatInput] = useState("");
  const isNat = question.kind === "nat";
  const isMsq = question.kind === "msq";

  const toggleOption = (id: string) => {
    if (isMsq) {
      setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
    } else {
      setSelected([id]);
    }
  };

  const handleSubmit = () => {
    if (isNat) {
      const v = parseFloat(natInput);
      onAnswer({ questionId: question.id, selectedOptionIds: [], natValue: isNaN(v) ? undefined : v });
    } else {
      onAnswer({ questionId: question.id, selectedOptionIds: selected });
    }
  };

  const canSubmit = isNat ? natInput.trim() !== "" : selected.length > 0;

  return (
    <motion.div
      key={question.id}
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Progress */}
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Question {index + 1} of {total}</span>
          <span>{question.topic}{question.subtopic ? ` · ${question.subtopic}` : ""}</span>
        </div>
        <Progress value={((index) / total) * 100} className="h-1.5" />
      </div>

      {/* Question */}
      <div className="rounded-2xl border bg-card p-6 space-y-5">
        <div className="flex items-start gap-3">
          <span className="shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center mt-0.5">
            {index + 1}
          </span>
          <div className="flex-1 space-y-3">
            <p className="text-base font-medium leading-relaxed whitespace-pre-wrap">{question.body}</p>
            {question.imageUrl && (
              <img src={question.imageUrl} alt="Question diagram" className="max-w-full rounded-lg border" />
            )}
            <div className="flex flex-wrap gap-2 mt-1">
              <Badge variant="outline" className="text-[10px]">{question.kind.toUpperCase()}</Badge>
              {question.marks > 0 && <Badge variant="outline" className="text-[10px]">+{question.marks}M</Badge>}
              {question.negativeMarks > 0 && (
                <Badge variant="outline" className="text-[10px] text-rose-400 border-rose-500/30">
                  -{question.negativeMarks}M
                </Badge>
              )}
              {question.source && <Badge variant="outline" className="text-[10px] text-muted-foreground">{question.source}</Badge>}
            </div>
          </div>
        </div>

        {/* Options or NAT input */}
        {isNat ? (
          <div className="pl-10">
            <label className="text-sm font-medium text-muted-foreground block mb-2">Enter your answer:</label>
            <input
              type="number"
              step="any"
              value={natInput}
              onChange={e => setNatInput(e.target.value)}
              placeholder="Numerical answer"
              className="w-48 px-4 py-2.5 rounded-xl border bg-muted/40 text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              onKeyDown={e => e.key === "Enter" && canSubmit && handleSubmit()}
            />
          </div>
        ) : (
          <div className="pl-10 space-y-2.5">
            {isMsq && (
              <p className="text-xs text-amber-500 font-medium">Select all correct options</p>
            )}
            {question.options.map((opt) => (
              <button
                key={opt.id}
                onClick={() => toggleOption(opt.id)}
                className={cn(
                  "w-full text-left flex items-start gap-3 px-4 py-3 rounded-xl border text-sm transition-all",
                  selected.includes(opt.id)
                    ? "border-primary bg-primary/10 text-primary font-medium"
                    : "border-border bg-muted/20 hover:bg-muted/50 hover:border-muted-foreground/40"
                )}
              >
                <span className={cn(
                  "shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold mt-0.5",
                  selected.includes(opt.id) ? "border-primary bg-primary text-white" : "border-muted-foreground/40"
                )}>
                  {isMsq
                    ? (selected.includes(opt.id) ? "✓" : "")
                    : String.fromCharCode(65 + question.options.indexOf(opt))}
                </span>
                <span className="leading-relaxed">{opt.body}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="text-muted-foreground text-xs"
          onClick={() => onAnswer({ questionId: question.id, selectedOptionIds: [] })}
        >
          Skip
        </Button>
        <Button onClick={handleSubmit} disabled={!canSubmit} className="gap-2 px-6">
          {index < total - 1 ? "Next" : "Finish"} <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}

// ── Review Card (shows correct/wrong after submit) ────────────────────────────

function ReviewCard({
  question,
  result,
  userAnswer,
  index,
  total,
  onNext,
}: {
  question: PracticeQuestion;
  result: CheckResult;
  userAnswer: UserAnswer;
  index: number;
  total: number;
  onNext: () => void;
}) {
  const isLast = index === total - 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div className="space-y-2">
        <div className="flex justify-between text-xs text-muted-foreground">
          <span>Question {index + 1} of {total}</span>
          <span>{question.topic}{question.subtopic ? ` · ${question.subtopic}` : ""}</span>
        </div>
        <Progress value={((index + 1) / total) * 100} className="h-1.5" />
      </div>

      {/* Result banner */}
      <div className={cn(
        "flex items-center gap-3 px-4 py-3 rounded-xl font-semibold text-sm",
        result.skipped ? "bg-muted/50 text-muted-foreground" :
        result.correct ? "bg-emerald-500/10 text-emerald-500 border border-emerald-500/20" :
        "bg-rose-500/10 text-rose-400 border border-rose-500/20"
      )}>
        {result.skipped
          ? <AlertCircle className="w-5 h-5 shrink-0" />
          : result.correct
          ? <CheckCircle2 className="w-5 h-5 shrink-0" />
          : <XCircle className="w-5 h-5 shrink-0" />}
        {result.skipped ? "Skipped" : result.correct ? "Correct! 🎉" : "Incorrect"}
        {!result.skipped && !result.correct && question.negativeMarks > 0 && (
          <span className="ml-auto text-xs opacity-70">-{question.negativeMarks}M</span>
        )}
        {result.correct && (
          <span className="ml-auto text-xs opacity-70">+{question.marks}M</span>
        )}
      </div>

      {/* Question + highlighted answer */}
      <div className="rounded-2xl border bg-card p-6 space-y-4">
        <p className="text-base font-medium leading-relaxed whitespace-pre-wrap">{question.body}</p>

        {question.kind === "nat" ? (
          <div className="space-y-2">
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">Your answer:</span>
              <span className={cn("font-bold", result.correct ? "text-emerald-500" : "text-rose-400")}>
                {userAnswer.natValue ?? "—"}
              </span>
            </div>
            <div className="flex items-center gap-3 text-sm">
              <span className="text-muted-foreground">Correct answer:</span>
              <span className="font-bold text-emerald-500">{result.natAnswer ?? "—"}</span>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {question.options.map((opt) => {
              const isCorrect = result.correctOptionIds.includes(opt.id);
              const wasSelected = userAnswer.selectedOptionIds.includes(opt.id);
              return (
                <div key={opt.id} className={cn(
                  "flex items-start gap-3 px-4 py-3 rounded-xl border text-sm",
                  isCorrect ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-400" :
                  wasSelected && !isCorrect ? "border-rose-500/30 bg-rose-500/10 text-rose-400" :
                  "border-border/50 text-muted-foreground opacity-60"
                )}>
                  <span className={cn(
                    "shrink-0 w-5 h-5 rounded-full border-2 flex items-center justify-center text-[10px] font-bold mt-0.5",
                    isCorrect ? "border-emerald-500 bg-emerald-500 text-white" :
                    wasSelected ? "border-rose-500 bg-rose-500/20 text-rose-400" :
                    "border-current/40"
                  )}>
                    {isCorrect ? "✓" : wasSelected ? "✗" : String.fromCharCode(65 + question.options.indexOf(opt))}
                  </span>
                  <span>{opt.body}</span>
                </div>
              );
            })}
          </div>
        )}

        {/* Explanation */}
        {result.explanation && (
          <div className="flex gap-3 p-4 rounded-xl bg-amber-500/5 border border-amber-500/20 text-sm">
            <Lightbulb className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <p className="text-foreground/80 leading-relaxed">{result.explanation}</p>
          </div>
        )}
      </div>

      <div className="flex justify-end">
        <Button onClick={onNext} className="gap-2 px-6">
          {isLast ? "See Results" : "Next Question"} <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </motion.div>
  );
}

// ── Results Screen ────────────────────────────────────────────────────────────

function ResultsScreen({
  questions,
  results,
  topic,
  totalScore,
  onRetry,
}: {
  questions: PracticeQuestion[];
  results: CheckResult[];
  topic: string;
  totalScore: number;
  onRetry: () => void;
}) {
  const correct = results.filter(r => r.correct).length;
  const wrong = results.filter(r => !r.correct && !r.skipped).length;
  const skipped = results.filter(r => r.skipped).length;
  const pct = Math.round((correct / questions.length) * 100);

  const pctColor =
    pct >= 80 ? "text-emerald-500" :
    pct >= 60 ? "text-amber-500" :
    pct >= 40 ? "text-orange-500" : "text-rose-500";

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8">
      {/* Score hero */}
      <div className="rounded-2xl border bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 p-8 text-center space-y-3">
        <p className="text-sm text-muted-foreground font-medium uppercase tracking-wider">Practice Complete</p>
        <p className="font-bold text-lg">{topic}</p>
        <p className={cn("text-6xl font-black tabular-nums", pctColor)}>{pct}%</p>
        <p className="text-sm text-muted-foreground">
          {correct} correct · {wrong} wrong · {skipped} skipped
          {totalScore !== 0 && (
            <span className={cn("ml-2 font-semibold", totalScore >= 0 ? "text-emerald-500" : "text-rose-400")}>
              · Score: {totalScore > 0 ? "+" : ""}{totalScore.toFixed(1)}
            </span>
          )}
        </p>
      </div>

      {/* Stat row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Correct", value: correct, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/20" },
          { label: "Wrong", value: wrong, color: "text-rose-400 bg-rose-500/10 border-rose-500/20" },
          { label: "Skipped", value: skipped, color: "text-muted-foreground bg-muted/30 border-border" },
        ].map(s => (
          <div key={s.label} className={cn("rounded-xl border p-4 text-center", s.color)}>
            <p className="text-2xl font-black">{s.value}</p>
            <p className="text-xs font-medium mt-1 opacity-70">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Button onClick={onRetry} variant="outline" className="gap-2 flex-1">
          <RotateCcw className="w-4 h-4" /> Try Again
        </Button>
        <Link href="/analytics">
          <Button className="gap-2 flex-1 w-full">
            <Target className="w-4 h-4" /> View Analytics
          </Button>
        </Link>
      </div>
    </motion.div>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

type Phase = "loading" | "question" | "review" | "done";

export default function PracticePage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const topic = params.get("topic") ?? "";
  const attemptId = params.get("attemptId") ?? "";
  const limitParam = parseInt(params.get("limit") ?? "10") || 10;
  const isRetryMode = !!attemptId;

  const [phase, setPhase] = useState<Phase>("loading");
  const [current, setCurrent] = useState(0);
  const [userAnswers, setUserAnswers] = useState<UserAnswer[]>([]);
  const [checkResults, setCheckResults] = useState<CheckResult[]>([]);
  const [totalScore, setTotalScore] = useState(0);
  const [sessionKey, setSessionKey] = useState(0);

  const { data, isLoading, isError, refetch } = useQuery<{ questions: PracticeQuestion[] }>({
    queryKey: ["practice-questions", topic, attemptId, limitParam, sessionKey],
    queryFn: () => isRetryMode
      ? customFetch(`/api/practice/retry?attemptId=${encodeURIComponent(attemptId)}`)
      : customFetch(`/api/practice/questions?topic=${encodeURIComponent(topic)}&limit=${limitParam}`),
    enabled: isRetryMode ? !!attemptId : !!topic,
    staleTime: 0,
  });

  const questions = data?.questions ?? [];

  const checkMutation = useMutation({
    mutationFn: (answers: UserAnswer[]) =>
      customFetch<{ results: CheckResult[]; totalScore: number }>("/api/practice/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      }),
    onSuccess: (res) => {
      setCheckResults(res.results);
      setTotalScore(res.totalScore);
      setPhase("review");
      setCurrent(0);
    },
  });

  const handleAnswer = (answer: UserAnswer) => {
    const next = [...userAnswers, answer];
    setUserAnswers(next);

    if (next.length === questions.length) {
      checkMutation.mutate(next);
    } else {
      setCurrent(c => c + 1);
    }
  };

  const handleRetry = () => {
    setSessionKey(k => k + 1);
    setPhase("loading");
    setCurrent(0);
    setUserAnswers([]);
    setCheckResults([]);
    setTotalScore(0);
    refetch();
  };

  if (!topic) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center space-y-4">
        <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto" />
        <p className="text-lg font-semibold">No topic selected</p>
        <p className="text-sm text-muted-foreground">Go to Analytics or the Dashboard to pick a weak topic to practice.</p>
        <Link href="/analytics"><Button>Go to Analytics</Button></Link>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center space-y-4">
        <AlertCircle className="w-12 h-12 text-rose-400 mx-auto" />
        <p className="text-lg font-semibold">Failed to load questions</p>
        <Button onClick={() => refetch()}>Try Again</Button>
      </div>
    );
  }

  if (isLoading || checkMutation.isPending) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-5">
        <Skeleton className="h-8 w-48 rounded-xl" />
        <Skeleton className="h-2 w-full rounded-full" />
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-14 rounded-xl" />
        <Skeleton className="h-14 rounded-xl" />
      </div>
    );
  }

  if (questions.length === 0) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center space-y-4">
        <BookOpen className="w-12 h-12 text-muted-foreground/30 mx-auto" />
        <p className="text-lg font-semibold">{isRetryMode ? "No wrong answers!" : "No questions found"}</p>
        <p className="text-sm text-muted-foreground">
          {isRetryMode
            ? "You got everything right — nothing to retry."
            : `No questions exist for "${topic}" yet.`}
        </p>
        <Link href={isRetryMode ? "/exams" : "/analytics"}>
          <Button variant="outline">{isRetryMode ? "Back to Exams" : "Back to Analytics"}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-6 space-y-6 pb-12">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Link href={isRetryMode ? "/exams" : "/analytics"}>
          <button className="text-muted-foreground hover:text-foreground transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </button>
        </Link>
        <div>
          <h1 className="text-lg font-bold">{isRetryMode ? "Retry Wrong Answers" : "Topic Practice"}</h1>
          <p className="text-sm text-muted-foreground">
            {isRetryMode ? `${questions.length} questions you got wrong` : `${topic} · ${questions.length} questions`}
          </p>
        </div>
      </div>

      {/* Phase: question → review → done */}
      <AnimatePresence mode="wait">
        {phase === "loading" || (phase === "question" && current < questions.length) ? (
          <QuestionCard
            key={`q-${current}-${sessionKey}`}
            question={questions[current]}
            index={current}
            total={questions.length}
            onAnswer={handleAnswer}
          />
        ) : phase === "review" && current < questions.length ? (
          <ReviewCard
            key={`r-${current}`}
            question={questions[current]}
            result={checkResults[current]}
            userAnswer={userAnswers[current]}
            index={current}
            total={questions.length}
            onNext={() => {
              if (current < questions.length - 1) {
                setCurrent(c => c + 1);
              } else {
                setPhase("done");
              }
            }}
          />
        ) : phase === "done" ? (
          <ResultsScreen
            key="results"
            questions={questions}
            results={checkResults}
            topic={topic}
            totalScore={totalScore}
            onRetry={handleRetry}
          />
        ) : null}
      </AnimatePresence>
    </div>
  );
}
