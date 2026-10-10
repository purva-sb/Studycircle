import { useState, useEffect } from "react";
import { useRoute, useLocation, Link } from "wouter";
import { useGetExam, useStartExamAttempt, getGetExamQueryKey, customFetch } from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Clock, FileQuestion, BarChart3, AlertCircle, PlayCircle, ShieldAlert, AlertTriangle, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

type MyAttempt = {
  found: boolean;
  attemptId?: string;
  questionsAnswered?: number;
  secondsRemaining?: number;
  startedAt?: string;
};

type View = "detail" | "prestart" | "resume";

function useContestStatus(exam: { kind: string; scheduledAt: Date | null; durationMinutes: number } | undefined) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!exam || exam.kind !== "contest" || !exam.scheduledAt) return "na" as const;
  const start = new Date(exam.scheduledAt).getTime();
  const end = start + exam.durationMinutes * 60_000;
  if (now < start) return "upcoming" as const;
  if (now < end)   return "live" as const;
  return "ended" as const;
}

export default function ExamDetail() {
  const [, params] = useRoute("/exams/:id");
  const id = params?.id || "";
  const [, setLocation] = useLocation();
  const { user } = useUser();

  const { data: exam, isLoading } = useGetExam(id, { query: { enabled: !!id, queryKey: getGetExamQueryKey(id) } });
  const startAttempt = useStartExamAttempt();
  const cs = useContestStatus(exam as any);

  const { data: cohortStats } = useQuery({
    queryKey: ["cohort-stats", id],
    queryFn: () => customFetch<{ totalAttempts: number; beatPercentage: number | null }>(`/api/mock/exams/${id}/cohort-stats`),
    enabled: !!id,
    staleTime: 5 * 60 * 1000,
  });

  const [view, setView] = useState<View>("detail");
  const [existing, setExisting] = useState<MyAttempt | null>(null);
  const [checking, setChecking] = useState(false);

  const fmt = (s: number) => {
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
    const p = (n: number) => String(n).padStart(2, "0");
    return h > 0 ? `${p(h)}h ${p(m)}m` : `${p(m)}m ${p(sec)}s`;
  };

  const handleStartClick = async () => {
    setChecking(true);
    try {
      const data = await customFetch<MyAttempt>(`/api/exams/${id}/my-attempt`);
      if (data.found) {
        setExisting(data);
        setView("resume");
      } else {
        setView("prestart");
      }
    } catch {
      setView("prestart");
    } finally {
      setChecking(false);
    }
  };

  const doStart = () => {
    startAttempt.mutate({ id }, {
      onSuccess: (attempt) => setLocation(`/attempts/${attempt.id}`),
      onError: () => toast.error("Failed to start exam."),
    });
  };

  const doResume = () => {
    if (existing?.attemptId) setLocation(`/attempts/${existing.attemptId}`);
  };

  if (isLoading || !exam) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-[300px] rounded-xl" />
        <Skeleton className="h-[200px] rounded-xl" />
      </div>
    );
  }

  /* ── Pre-start screen (Image 1 style) ── */
  if (view === "prestart") {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-white" style={{ colorScheme: "light" }}>
        {/* Blue header with candidate info */}
        <div style={{ background: "linear-gradient(135deg, #3b5fe3 0%, #2948c8 100%)" }}
          className="px-8 py-5 flex items-center gap-5 shadow-md">
          <img
            src={user?.imageUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user?.fullName || "U")}&background=ffffff&color=3b5fe3`}
            alt="candidate"
            className="w-16 h-16 rounded-full border-4 border-white/40 object-cover shrink-0"
          />
          <div>
            <p className="text-white/80 text-sm font-medium">Candidate Name :</p>
            <p className="text-yellow-300 text-2xl font-bold leading-tight">{user?.fullName || user?.primaryEmailAddress?.emailAddress || "Candidate"}</p>
            <p className="text-white/80 text-sm mt-0.5">
              Subject : <span className="text-yellow-300 font-medium">{exam.exam} | {exam.title}</span>
            </p>
          </div>
        </div>

        {/* White body */}
        <div className="flex-1 flex flex-col items-center justify-center gap-8 p-8">
          <div className="text-center space-y-2">
            <h2 className="text-2xl font-bold text-gray-800">{exam.title}</h2>
            <p className="text-gray-500">{exam.durationMinutes} minutes &nbsp;·&nbsp; {exam.totalQuestions} questions &nbsp;·&nbsp; {exam.totalMarks} marks</p>
          </div>

          <div className="grid grid-cols-2 gap-4 max-w-xs w-full text-sm">
            <div className="bg-green-50 border border-green-200 rounded p-3 text-center">
              <p className="text-green-600 font-bold text-lg">+{exam.marksPerQuestion}</p>
              <p className="text-green-700 text-xs">Correct Answer</p>
            </div>
            <div className="bg-red-50 border border-red-200 rounded p-3 text-center">
              <p className="text-red-600 font-bold text-lg">−{exam.negativeMarking}</p>
              <p className="text-red-700 text-xs">Wrong Answer</p>
            </div>
          </div>

          <Button
            onClick={doStart}
            disabled={startAttempt.isPending}
            style={{ background: "#3b5fe3", color: "#fff", fontSize: 16, padding: "12px 48px" }}
            className="rounded font-bold hover:opacity-90 shadow-lg"
          >
            {startAttempt.isPending ? "Starting…" : "Start"}
          </Button>

          <button onClick={() => setView("detail")} className="text-sm text-gray-400 hover:text-gray-600 underline">
            ← Back to details
          </button>
        </div>
      </div>
    );
  }

  /* ── Previous session found (Image 4 style) ── */
  if (view === "resume" && existing) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
        <div className="bg-white rounded-lg shadow-2xl max-w-md w-full p-6 space-y-5">
          <h2 className="text-xl font-bold text-gray-800 text-center">Previous Session Found</h2>

          <div className="space-y-3">
            <div className="flex justify-between text-sm border-b pb-2">
              <span className="text-gray-500">Questions Answered</span>
              <span className="font-bold text-gray-800">{existing.questionsAnswered} / {exam.totalQuestions}</span>
            </div>
            <div className="flex justify-between text-sm border-b pb-2">
              <span className="text-gray-500">Time Remaining</span>
              <span className="font-bold text-gray-800">{existing.secondsRemaining ? fmt(existing.secondsRemaining) : "—"}</span>
            </div>
            {existing.startedAt && (
              <div className="flex justify-between text-sm border-b pb-2">
                <span className="text-gray-500">Last Saved</span>
                <span className="font-bold text-gray-800">{format(new Date(existing.startedAt), "dd/MM/yyyy, HH:mm:ss")}</span>
              </div>
            )}
          </div>

          <div className="bg-yellow-50 border border-yellow-300 rounded p-3 flex gap-2 text-sm text-yellow-800">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0 text-yellow-600" />
            <span>Resumed exams will <strong>NOT</strong> be considered for ranking. Only first attempts completed within the exam duration are eligible.</span>
          </div>

          <div className="flex gap-3">
            <Button onClick={doResume} className="flex-1" style={{ background: "#3b5fe3", color: "#fff" }}>
              Resume Exam
            </Button>
            <Button onClick={doStart} variant="outline" className="flex-1" disabled={startAttempt.isPending}>
              {startAttempt.isPending ? "Starting…" : "Start Fresh"}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  /* ── Normal exam detail ── */
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Card className="border-t-8 border-t-primary shadow-md overflow-hidden relative">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -mr-20 -mt-20" />
        <CardHeader className="pb-6 pt-8 relative z-10">
          <div className="flex gap-2 mb-4">
            <Badge className="bg-primary/20 text-primary hover:bg-primary/30 text-sm font-bold border-none">{exam.exam}</Badge>
            <Badge variant="outline" className="text-sm uppercase tracking-wider">{exam.kind.replace("-", " ")}</Badge>
          </div>
          <CardTitle className="text-3xl md:text-4xl font-extrabold tracking-tight leading-tight">{exam.title}</CardTitle>
          <CardDescription className="text-base mt-4 max-w-2xl text-foreground/80 leading-relaxed">{exam.description}</CardDescription>
        </CardHeader>
        <CardContent className="bg-muted/30 border-t py-6 relative z-10">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div className="flex flex-col gap-1">
              <div className="text-muted-foreground text-sm font-medium flex items-center gap-1.5"><Clock className="w-4 h-4" /> Duration</div>
              <div className="text-xl font-bold">{exam.durationMinutes} mins</div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-muted-foreground text-sm font-medium flex items-center gap-1.5"><FileQuestion className="w-4 h-4" /> Questions</div>
              <div className="text-xl font-bold">{exam.totalQuestions}</div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-muted-foreground text-sm font-medium flex items-center gap-1.5"><BarChart3 className="w-4 h-4" /> Total Marks</div>
              <div className="text-xl font-bold">{exam.totalMarks}</div>
            </div>
            <div className="flex flex-col gap-1">
              <div className="text-muted-foreground text-sm font-medium flex items-center gap-1.5"><ShieldAlert className="w-4 h-4" /> Difficulty</div>
              <div className="text-xl font-bold capitalize">{exam.difficulty}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-xl flex items-center gap-2"><AlertCircle className="w-5 h-5 text-primary" /> Instructions</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-3">
                {exam.instructions.map((inst, i) => (
                  <li key={i} className="flex gap-3 text-muted-foreground">
                    <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-bold">{i + 1}</span>
                    <span className="leading-relaxed">{inst}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-xl">Topics Covered</CardTitle></CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {exam.topics.map((t) => <Badge key={t} variant="secondary" className="px-3 py-1 text-sm font-medium">{t}</Badge>)}
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="border-primary shadow-lg bg-card">
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                Ready to begin?
                {cs === "live" && (
                  <span className="text-xs bg-red-500 text-white font-bold px-2 py-0.5 rounded-full animate-pulse">🔴 LIVE</span>
                )}
                {cs === "upcoming" && (
                  <span className="text-xs bg-blue-100 text-blue-700 font-bold px-2 py-0.5 rounded-full">UPCOMING</span>
                )}
                {cs === "ended" && (
                  <span className="text-xs bg-gray-200 text-gray-600 font-bold px-2 py-0.5 rounded-full">ENDED</span>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between items-center text-sm p-3 bg-muted/50 rounded-lg">
                <span className="text-muted-foreground">Correct Answer</span>
                <span className="font-bold text-emerald-500">+{exam.marksPerQuestion}</span>
              </div>
              <div className="flex justify-between items-center text-sm p-3 bg-muted/50 rounded-lg">
                <span className="text-muted-foreground">Wrong Answer</span>
                <span className="font-bold text-destructive">−{exam.negativeMarking}</span>
              </div>
              {(exam as any).hasCalculator && (
                <div className="flex items-center gap-2 text-sm p-3 bg-blue-50 rounded-lg text-blue-700 border border-blue-200">
                  🧮 <span className="font-medium">Scientific calculator available</span>
                </div>
              )}
              {cs === "upcoming" && exam.scheduledAt && (
                <div className="text-sm p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800">
                  Starts {format(new Date(exam.scheduledAt), "dd MMM yyyy, HH:mm")}
                </div>
              )}
              {cs === "ended" && (
                <div className="text-sm p-3 bg-gray-50 border border-gray-200 rounded-lg text-gray-600">
                  This contest has ended.
                </div>
              )}
              <Separator />
              {cs !== "upcoming" && cs !== "ended" && (
                <Button
                  className="w-full hover-elevate shadow-md py-6 text-lg font-bold gap-2"
                  onClick={handleStartClick}
                  disabled={checking || startAttempt.isPending}
                >
                  <PlayCircle className="w-5 h-5" />
                  {checking ? "Checking…" : "Start Attempt"}
                </Button>
              )}
              {cohortStats && cohortStats.totalAttempts > 0 && (
                <div className="text-xs text-center text-muted-foreground space-y-0.5 py-1">
                  <div className="flex items-center justify-center gap-1.5">
                    <Users className="w-3 h-3" />
                    <span><strong className="text-foreground">{cohortStats.totalAttempts}</strong> students attempted this week</span>
                  </div>
                  {cohortStats.beatPercentage != null && (
                    <div className="text-emerald-400 font-semibold">You beat {cohortStats.beatPercentage}% of them</div>
                  )}
                </div>
              )}
              <Link href={`/exams/${id}/leaderboard`}>
                <Button variant="outline" className="w-full gap-2">
                  <Trophy className="w-4 h-4" /> View Leaderboard
                </Button>
              </Link>
              {cs === "na" && (
                <p className="text-xs text-center text-muted-foreground">Timer begins when you click Start. Do not close the window.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
