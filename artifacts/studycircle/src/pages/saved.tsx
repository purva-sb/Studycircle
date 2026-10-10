import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { MathText } from "@/components/math-text";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Bookmark, BookmarkX, BookOpen, ChevronDown, ChevronUp } from "lucide-react";
import { Link } from "wouter";

type SavedQuestion = {
  questionId: string;
  createdAt: string;
  body: string;
  kind: "mcq" | "msq" | "nat";
  topic: string;
  subject?: string | null;
  source?: string | null;
  marks: number;
  optionsJson: { id: string; body: string }[];
  correctOptionIds: string[];
  natAnswer?: number | null;
  explanation?: string | null;
};

function SavedCard({
  q, onRemove,
}: { q: SavedQuestion; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [showAnswer, setShowAnswer] = useState(false);

  return (
    <Card className="border border-border hover:border-primary/30 transition-colors">
      <CardContent className="p-5 space-y-3">
        {/* Header */}
        <div className="flex flex-wrap items-start gap-2">
          <Badge variant="outline" className="text-[11px] uppercase shrink-0">{q.kind}</Badge>
          {q.source && <Badge variant="outline" className="text-[11px]">{q.source}</Badge>}
          {q.topic  && <Badge variant="outline" className="text-[11px] text-muted-foreground">{q.topic}</Badge>}
          {q.subject && <Badge variant="outline" className="text-[11px] text-muted-foreground">{q.subject}</Badge>}
          <div className="ml-auto flex items-center gap-1.5">
            <span className="text-[11px] text-muted-foreground">+{q.marks}m</span>
            <button
              onClick={onRemove}
              className="p-1 rounded hover:bg-rose-500/10 transition-colors text-muted-foreground hover:text-rose-500"
              title="Remove bookmark"
            >
              <BookmarkX className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Question body (collapsed beyond 3 lines) */}
        <div className={`text-sm leading-relaxed text-foreground ${expanded ? "" : "line-clamp-3"}`}>
          <MathText text={q.body} />
        </div>
        {q.body.length > 200 && (
          <button onClick={() => setExpanded(v => !v)} className="text-xs text-primary flex items-center gap-1">
            {expanded ? <><ChevronUp className="w-3 h-3" /> Show less</> : <><ChevronDown className="w-3 h-3" /> Show more</>}
          </button>
        )}

        {/* Options (MCQ/MSQ) — collapsed until "Show answer" */}
        {q.kind !== "nat" && q.optionsJson.length > 0 && (
          <div className="space-y-1">
            {showAnswer ? (
              <div className="space-y-1">
                {q.optionsJson.map((opt, i) => {
                  const isCorrect = q.correctOptionIds?.includes(opt.id);
                  return (
                    <div key={opt.id}
                      className={`flex items-start gap-2 px-3 py-2 rounded-lg text-xs border ${isCorrect ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400" : "border-border text-muted-foreground"}`}>
                      <span className="font-bold shrink-0">{String.fromCharCode(65 + i)}.</span>
                      <MathText text={opt.body} />
                    </div>
                  );
                })}
                {q.explanation && (
                  <div className="mt-2 p-3 rounded-lg bg-muted/40 border text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">Solution: </span>
                    <MathText text={q.explanation} />
                  </div>
                )}
              </div>
            ) : (
              <button onClick={() => setShowAnswer(true)} className="text-xs text-primary underline-offset-2 underline">
                Reveal answer
              </button>
            )}
          </div>
        )}

        {q.kind === "nat" && showAnswer && (
          <p className="text-sm font-semibold text-emerald-500">Answer: {q.natAnswer}</p>
        )}
        {q.kind === "nat" && !showAnswer && (
          <button onClick={() => setShowAnswer(true)} className="text-xs text-primary underline-offset-2 underline">
            Reveal answer
          </button>
        )}
      </CardContent>
    </Card>
  );
}

export default function SavedQuestions() {
  const queryClient = useQueryClient();

  const { data: questions, isLoading } = useQuery<SavedQuestion[]>({
    queryKey: ["bookmarks"],
    queryFn:  () => customFetch("/api/bookmarks"),
    staleTime: 60_000,
  });

  const removeBookmark = useCallback(async (questionId: string) => {
    queryClient.setQueryData<SavedQuestion[]>(["bookmarks"], prev =>
      (prev ?? []).filter(q => q.questionId !== questionId)
    );
    await customFetch(`/api/bookmarks/${questionId}`, { method: "DELETE" }).catch(() => {
      queryClient.invalidateQueries({ queryKey: ["bookmarks"] });
    });
  }, [queryClient]);

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Bookmark className="w-6 h-6 text-primary" /> Saved Questions
          </h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            {questions ? `${questions.length} bookmarked question${questions.length !== 1 ? "s" : ""}` : "Your bookmarked questions"}
          </p>
        </div>
        <Link href="/pyqs">
          <Button variant="outline" size="sm" className="gap-1.5">
            <BookOpen className="w-4 h-4" /> Browse PYQs
          </Button>
        </Link>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-36 rounded-xl" />)}
        </div>
      ) : !questions || questions.length === 0 ? (
        <Card className="flex flex-col items-center justify-center p-16 border-dashed text-center">
          <Bookmark className="w-12 h-12 text-muted-foreground/40 mb-4" />
          <p className="font-semibold text-muted-foreground">No saved questions yet</p>
          <p className="text-sm text-muted-foreground/70 mt-1 max-w-xs">
            Tap the bookmark icon on any question in the PYQ Bank to save it here.
          </p>
          <Link href="/pyqs" className="mt-4">
            <Button variant="outline" size="sm">Go to PYQ Bank</Button>
          </Link>
        </Card>
      ) : (
        <div className="space-y-4">
          {questions.map(q => (
            <SavedCard key={q.questionId} q={q} onRemove={() => removeBookmark(q.questionId)} />
          ))}
        </div>
      )}
    </div>
  );
}
