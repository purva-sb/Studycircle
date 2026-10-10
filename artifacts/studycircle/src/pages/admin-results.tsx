import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Trophy, Medal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";

type Exam = {
  id: string; title: string; exam: string; kind: string;
  totalQuestions: number; totalMarks: number; attemptCount: number;
};

type Result = {
  attemptId: string; userId: string;
  score: number | null; startedAt: string;
  displayName: string; avatarUrl: string;
};

function ExamLeaderboard({ exam, onBack }: { exam: Exam; onBack: () => void }) {
  const { data: results = [], isLoading } = useQuery<Result[]>({
    queryKey: ["admin-results", exam.id],
    queryFn: () => customFetch(`/api/admin/exams/${exam.id}/results`),
  });

  const rankColor = (i: number) => {
    if (i === 0) return "text-yellow-400";
    if (i === 1) return "text-slate-400";
    if (i === 2) return "text-amber-600";
    return "text-muted-foreground";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={onBack}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div>
          <h2 className="font-bold text-xl">{exam.title}</h2>
          <p className="text-sm text-muted-foreground">{exam.exam} · {exam.totalMarks} marks · {results.length} submissions</p>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {isLoading && (
          <div className="p-4 space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}
          </div>
        )}
        {results.map((r, i) => (
          <div key={r.attemptId} className="flex items-center gap-4 px-5 py-3.5">
            <span className={`text-sm font-bold w-6 shrink-0 ${rankColor(i)}`}>
              {i < 3 ? <Medal className="w-4 h-4" /> : `#${i + 1}`}
            </span>
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarImage src={r.avatarUrl} />
              <AvatarFallback className="text-xs">{r.displayName?.substring(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{r.displayName}</p>
              <p className="text-xs text-muted-foreground">{format(new Date(r.startedAt), "MMM d, h:mm a")}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold text-sm">
                {r.score ?? "—"}<span className="text-muted-foreground font-normal">/{exam.totalMarks}</span>
              </p>
              {r.score !== null && (
                <p className="text-xs text-muted-foreground">
                  {((r.score / exam.totalMarks) * 100).toFixed(1)}%
                </p>
              )}
            </div>
          </div>
        ))}
        {!isLoading && results.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">No submissions yet.</div>
        )}
      </div>
    </div>
  );
}

export default function AdminResults() {
  const [selected, setSelected] = useState<Exam | null>(null);

  const { data: exams = [], isLoading } = useQuery<Exam[]>({
    queryKey: ["admin-exams"],
    queryFn: () => customFetch("/api/admin/exams"),
  });

  if (selected) return <ExamLeaderboard exam={selected} onBack={() => setSelected(null)} />;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Results</h1>
        <p className="text-muted-foreground text-sm mt-1">Click a test to see the leaderboard</p>
      </div>

      <div className="rounded-xl border border-border bg-card divide-y divide-border">
        {isLoading && (
          <div className="p-4 space-y-3">
            {[1,2,3].map(i => <div key={i} className="h-14 bg-muted animate-pulse rounded-lg" />)}
          </div>
        )}
        {exams.map(exam => (
          <button key={exam.id} onClick={() => setSelected(exam)}
            className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition-colors text-left">
            <Trophy className="w-4 h-4 text-muted-foreground shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{exam.title}</p>
              <p className="text-xs text-muted-foreground">{exam.totalQuestions} questions · {exam.totalMarks} marks</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <Badge variant="outline" className="text-xs">{exam.exam}</Badge>
              <span className="text-xs text-muted-foreground">{exam.attemptCount} attempts</span>
            </div>
          </button>
        ))}
        {!isLoading && exams.length === 0 && (
          <div className="py-12 text-center text-sm text-muted-foreground">No exams yet.</div>
        )}
      </div>
    </div>
  );
}
