import { useRoute, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useUser, SignInButton } from "@clerk/clerk-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Clock, FileQuestion, BarChart3, AlertCircle, PlayCircle, LogIn } from "lucide-react";

type ExamPreview = {
  id: string; title: string; exam: string; kind: string;
  durationMinutes: number; totalQuestions: number; totalMarks: number;
  difficulty: string; description: string; negativeMarking: number;
  attemptCount: number;
};

const DIFFICULTY_COLOR: Record<string, string> = {
  easy: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  hard: "bg-rose-500/10 text-rose-400 border-rose-500/20",
};

export default function ExamJoinPage() {
  const [, params] = useRoute("/e/:code");
  const code = params?.code ?? "";
  const [, setLocation] = useLocation();
  const { user, isLoaded } = useUser();

  const { data: exam, isLoading, isError } = useQuery<ExamPreview>({
    queryKey: ["exam-join", code],
    queryFn: () => customFetch(`/api/e/${code}`),
    enabled: !!code,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-[#060612] flex items-center justify-center p-4">
        <div className="w-full max-w-md space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-48 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  if (isError || !exam) {
    return (
      <div className="min-h-screen bg-[#060612] flex items-center justify-center p-4">
        <div className="text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-rose-400 mx-auto" />
          <h2 className="text-lg font-bold text-white">Link not found</h2>
          <p className="text-sm text-gray-400">This exam link may have expired or been removed.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#060612] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background glow */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-violet-600/15 rounded-full blur-[120px] pointer-events-none" />

      <div className="relative w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center gap-2 bg-violet-500/10 border border-violet-500/20 rounded-full px-4 py-1.5 text-xs font-semibold text-violet-400 mb-4">
            <PlayCircle className="w-3.5 h-3.5" /> StudyCircle — Mock Exam
          </div>
          <h1 className="text-2xl font-extrabold text-white mb-1">{exam.title}</h1>
          <p className="text-sm text-gray-400">{exam.exam} · {exam.kind}</p>
        </div>

        {/* Exam card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-6 space-y-5 backdrop-blur-xl mb-6">
          {/* Stats row */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Clock,        label: "Duration",   value: `${exam.durationMinutes} min` },
              { icon: FileQuestion, label: "Questions",  value: String(exam.totalQuestions) },
              { icon: BarChart3,    label: "Total Marks", value: String(exam.totalMarks) },
            ].map(({ icon: Icon, label, value }) => (
              <div key={label} className="bg-white/5 rounded-xl p-3 text-center">
                <Icon className="w-4 h-4 text-violet-400 mx-auto mb-1" />
                <p className="text-base font-bold text-white">{value}</p>
                <p className="text-[11px] text-gray-500 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-2">
            <Badge variant="outline" className={DIFFICULTY_COLOR[exam.difficulty] ?? "text-gray-400"}>
              {exam.difficulty}
            </Badge>
            {exam.negativeMarking > 0 && (
              <Badge variant="outline" className="text-rose-400 border-rose-500/20 bg-rose-500/10">
                −{exam.negativeMarking} negative marking
              </Badge>
            )}
            {exam.attemptCount > 0 && (
              <Badge variant="outline" className="text-gray-400 border-white/10">
                {exam.attemptCount.toLocaleString()} attempts
              </Badge>
            )}
          </div>

          {/* Description */}
          {exam.description && (
            <p className="text-sm text-gray-400 leading-relaxed">{exam.description}</p>
          )}
        </div>

        {/* CTA */}
        {isLoaded && !user ? (
          <SignInButton mode="modal" forceRedirectUrl={`/e/${code}`} fallbackRedirectUrl={`/e/${code}`}>
            <Button className="w-full h-12 text-base font-bold bg-violet-600 hover:bg-violet-700 text-white rounded-xl gap-2">
              <LogIn className="w-5 h-5" /> Sign in to Start Exam
            </Button>
          </SignInButton>
        ) : (
          <Button className="w-full h-12 text-base font-bold bg-violet-600 hover:bg-violet-700 text-white rounded-xl gap-2"
            onClick={() => setLocation(`/exams/${exam.id}`)}>
            <PlayCircle className="w-5 h-5" /> Start Test
          </Button>
        )}

        <p className="text-center text-xs text-gray-600 mt-4">
          Powered by <span className="text-violet-400">StudyCircle</span> — India's Social Study Platform
        </p>
      </div>
    </div>
  );
}
