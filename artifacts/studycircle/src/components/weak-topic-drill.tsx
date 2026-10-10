import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { MathText } from "@/components/math-text";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, ArrowRight, RotateCcw, Trophy, Zap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

type PracticeQuestion = {
  id: string;
  kind: string;
  body: string;
  imageUrl?: string | null;
  topic: string;
  subtopic?: string | null;
  marks: number;
  negativeMarks: number;
  options: { id: string; body: string }[];
};

type CheckResult = {
  questionId: string;
  correct: boolean;
  skipped: boolean;
  correctOptionIds: string[];
  natAnswer?: number | null;
  explanation?: string | null;
};

const LABELS = ["A", "B", "C", "D", "E"];

export function WeakTopicDrill({
  open,
  onClose,
  topic,
}: {
  open: boolean;
  onClose: () => void;
  topic: string;
}) {
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [results, setResults] = useState<CheckResult[] | null>(null);
  const [totalScore, setTotalScore] = useState(0);
  const [currentIdx, setCurrentIdx] = useState(0);

  const { data, isLoading } = useQuery<{ questions: PracticeQuestion[] }>({
    queryKey: ["practice-drill", topic],
    queryFn: () => customFetch(`/api/practice/questions?topic=${encodeURIComponent(topic)}&limit=10`),
    enabled: open && !!topic,
    staleTime: 60_000,
  });

  const checkMutation = useMutation({
    mutationFn: (payload: { answers: { questionId: string; selectedOptionIds: string[] }[] }) =>
      customFetch<{ results: CheckResult[]; totalScore: number }>("/api/practice/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }),
    onSuccess: (res) => {
      setResults(res.results);
      setTotalScore(res.totalScore);
    },
  });

  const questions = data?.questions ?? [];
  const total = questions.length;

  const handleSelect = (qId: string, optId: string) => {
    if (results) return;
    setAnswers((prev) => ({ ...prev, [qId]: [optId] }));
  };

  const handleSubmit = () => {
    const payload = questions.map((q) => ({
      questionId: q.id,
      selectedOptionIds: answers[q.id] ?? [],
    }));
    checkMutation.mutate({ answers: payload });
  };

  const handleReset = () => {
    setAnswers({});
    setResults(null);
    setTotalScore(0);
    setCurrentIdx(0);
  };

  const handleClose = () => {
    handleReset();
    onClose();
  };

  const answered = Object.keys(answers).length;
  const correctCount = results?.filter((r) => r.correct).length ?? 0;
  const pct = total > 0 ? Math.round((correctCount / total) * 100) : 0;

  const currentQ = questions[currentIdx];
  const currentResult = results?.find((r) => r.questionId === currentQ?.id);

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) handleClose(); }}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto p-0">
        <DialogHeader className="px-6 pt-5 pb-0">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Zap className="w-4 h-4 text-primary" />
            Quick Drill — {topic}
          </DialogTitle>
        </DialogHeader>

        {isLoading && (
          <div className="flex items-center justify-center py-16 text-muted-foreground text-sm">
            Loading questions…
          </div>
        )}

        {!isLoading && total === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center px-6">
            <p className="text-sm text-muted-foreground">No practice questions found for <strong>{topic}</strong> yet.</p>
            <p className="text-xs text-muted-foreground/60">Ask an admin to add questions for this topic.</p>
            <Button variant="outline" size="sm" onClick={handleClose}>Close</Button>
          </div>
        )}

        {!isLoading && total > 0 && (
          <div className="px-6 pb-6 pt-4 space-y-5">
            {/* Progress */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Question {Math.min(currentIdx + 1, total)} of {total}</span>
                <span>{answered}/{total} answered</span>
              </div>
              <Progress value={(answered / total) * 100} className="h-1.5" />
            </div>

            {/* Results summary (shown after submit) */}
            {results && (
              <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
                className={`rounded-xl border p-4 text-center space-y-1 ${
                  pct >= 70 ? "bg-emerald-500/10 border-emerald-500/30" :
                  pct >= 40 ? "bg-amber-500/10 border-amber-500/30" :
                  "bg-rose-500/10 border-rose-500/30"
                }`}>
                <div className="text-3xl">{pct >= 70 ? "🎉" : pct >= 40 ? "📈" : "💪"}</div>
                <p className="font-black text-xl">{correctCount}/{total} correct</p>
                <p className="text-sm text-muted-foreground">
                  {pct >= 70 ? "Great work! Keep it up." :
                   pct >= 40 ? "Getting there — review the explanations below." :
                   "This topic needs more practice. Check the explanations."}
                </p>
                <p className="text-xs font-semibold text-primary">Score: {totalScore > 0 ? `+${totalScore}` : totalScore}</p>
              </motion.div>
            )}

            {/* Question navigator pills */}
            {total > 1 && (
              <div className="flex flex-wrap gap-1.5">
                {questions.map((q, i) => {
                  const r = results?.find((r) => r.questionId === q.id);
                  const isAnswered = !!answers[q.id];
                  return (
                    <button
                      key={q.id}
                      onClick={() => setCurrentIdx(i)}
                      className={`w-7 h-7 rounded-full text-xs font-bold transition-all border ${
                        i === currentIdx ? "ring-2 ring-primary ring-offset-1" : ""
                      } ${
                        r ? (r.correct ? "bg-emerald-500 text-white border-emerald-500" : "bg-rose-500 text-white border-rose-500") :
                        isAnswered ? "bg-primary/20 text-primary border-primary/40" :
                        "bg-muted text-muted-foreground border-border"
                      }`}
                    >
                      {i + 1}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Current question */}
            <AnimatePresence mode="wait">
              {currentQ && (
                <motion.div key={currentQ.id}
                  initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
                  className="space-y-4">
                  <div className="text-sm font-medium leading-relaxed">
                    <span className="text-xs font-bold text-muted-foreground mr-2">Q{currentIdx + 1}.</span>
                    <MathText text={currentQ.body} />
                  </div>

                  <div className="space-y-2">
                    {currentQ.options.map((opt, i) => {
                      const selected = (answers[currentQ.id] ?? []).includes(opt.id);
                      const isCorrect = currentResult?.correctOptionIds.includes(opt.id);
                      const isWrong = selected && currentResult && !currentResult.correct;

                      let cls = "border-border bg-muted/30 hover:bg-muted/60 hover:border-primary/40";
                      if (results) {
                        if (isCorrect) cls = "border-emerald-500 bg-emerald-500/10 text-emerald-700";
                        else if (selected && !isCorrect) cls = "border-rose-500 bg-rose-500/10 text-rose-700";
                        else cls = "border-border/40 bg-muted/20 opacity-60";
                      } else if (selected) {
                        cls = "border-primary bg-primary/10 text-primary";
                      }

                      return (
                        <button
                          key={opt.id}
                          onClick={() => handleSelect(currentQ.id, opt.id)}
                          disabled={!!results}
                          className={`w-full flex items-start gap-3 px-4 py-3 rounded-xl border text-left text-sm transition-all ${cls}`}
                        >
                          <span className="w-5 h-5 rounded-full border-2 border-current flex items-center justify-center text-[11px] font-black shrink-0 mt-0.5">
                            {LABELS[i]}
                          </span>
                          <span className="flex-1"><MathText text={opt.body} /></span>
                          {results && isCorrect && <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />}
                          {results && selected && !isCorrect && <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Explanation (after submit) */}
                  {currentResult?.explanation && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                      className="bg-blue-500/10 border border-blue-500/20 rounded-xl px-4 py-3">
                      <p className="text-xs font-bold text-blue-600 mb-1">Explanation</p>
                      <p className="text-sm text-foreground/80 leading-relaxed">
                        <MathText text={currentResult.explanation} />
                      </p>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Navigation + submit */}
            <div className="flex items-center justify-between pt-2 border-t border-border/50">
              <div className="flex gap-2">
                <Button variant="ghost" size="sm" onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))} disabled={currentIdx === 0}>
                  ← Prev
                </Button>
                {currentIdx < total - 1 && (
                  <Button variant="ghost" size="sm" onClick={() => setCurrentIdx((i) => Math.min(total - 1, i + 1))}>
                    Next <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                )}
              </div>

              <div className="flex gap-2">
                {results ? (
                  <>
                    <Button variant="outline" size="sm" onClick={handleReset} className="gap-1.5">
                      <RotateCcw className="w-3.5 h-3.5" /> Retry
                    </Button>
                    <Button size="sm" onClick={handleClose} className="gap-1.5">
                      <Trophy className="w-3.5 h-3.5" /> Done
                    </Button>
                  </>
                ) : (
                  <Button
                    size="sm"
                    onClick={handleSubmit}
                    disabled={answered === 0 || checkMutation.isPending}
                    className="gap-1.5"
                  >
                    {checkMutation.isPending ? "Checking…" : `Submit ${answered > 0 ? `(${answered}/${total})` : ""}`}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
