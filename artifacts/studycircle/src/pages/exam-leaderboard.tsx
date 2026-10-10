import { useEffect, useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, RefreshCw, Trophy, Medal } from "lucide-react";
import { z } from "zod";
import { format } from "date-fns";

/* ── Types ── */
const Schema = z.object({
  examId: z.string(),
  examTitle: z.string(),
  totalMarks: z.number(),
  kind: z.string(),
  scheduledAt: z.union([z.null(), z.coerce.date()]),
  durationMinutes: z.number(),
  totalParticipants: z.number(),
  myEntry: z.object({
    rank: z.number(),
    score: z.number(),
    submittedAt: z.coerce.date().nullable(),
  }).nullable(),
  entries: z.array(z.object({
    rank: z.number(),
    userId: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable(),
    score: z.number(),
    submittedAt: z.coerce.date().nullable(),
    isCurrentUser: z.boolean(),
  })),
});
type LB = z.infer<typeof Schema>;

/* ── Contest status helper ── */
type ContestStatus = "na" | "upcoming" | "live" | "ended";

function contestStatus(lb: LB): ContestStatus {
  if (lb.kind !== "contest" || !lb.scheduledAt) return "na";
  const now = Date.now();
  const start = new Date(lb.scheduledAt).getTime();
  const end = start + lb.durationMinutes * 60_000;
  if (now < start) return "upcoming";
  if (now < end)   return "live";
  return "ended";
}

function useCountdown(target: Date | null) {
  const [secs, setSecs] = useState(0);
  useEffect(() => {
    if (!target) return;
    const tick = () => setSecs(Math.max(0, Math.floor((target.getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [target]);
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return secs > 0 ? (h > 0 ? `${p(h)}:${p(m)}:${p(s)}` : `${p(m)}:${p(s)}`) : null;
}

/* ── Podium (top 3) ── */
const PODIUM = [
  { pos: 1, color: "#FFD700", shadow: "rgba(255,215,0,0.35)", h: "h-20", label: "🥇" },
  { pos: 2, color: "#C0C0C0", shadow: "rgba(192,192,192,0.35)", h: "h-14", label: "🥈" },
  { pos: 3, color: "#CD7F32", shadow: "rgba(205,127,50,0.35)", h: "h-10", label: "🥉" },
];

function PodiumCard({ entry, meta }: { entry: LB["entries"][number]; meta: (typeof PODIUM)[number] }) {
  return (
    <div className="flex flex-col items-center gap-1 w-28">
      <span className="text-2xl">{meta.label}</span>
      <img
        src={entry.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.displayName)}&background=3b5fe3&color=fff`}
        alt={entry.displayName}
        className="w-14 h-14 rounded-full object-cover border-4"
        style={{ borderColor: meta.color, boxShadow: `0 0 12px ${meta.shadow}` }}
      />
      <p className="text-xs font-bold text-gray-800 text-center leading-tight mt-1 truncate w-full text-center">{entry.displayName}</p>
      <p className="text-sm font-black" style={{ color: meta.color }}>{entry.score}</p>
      <div className={`w-full rounded-t-md ${meta.h}`} style={{ background: meta.color, opacity: 0.25 }} />
    </div>
  );
}

/* ── Main ── */
export default function ExamLeaderboard() {
  const [, params] = useRoute("/exams/:id/leaderboard");
  const examId = params?.id || "";

  const status = (lb: LB) => contestStatus(lb);

  const { data: lb, isLoading, refetch, isFetching } = useQuery<LB>({
    queryKey: ["exam-leaderboard", examId],
    queryFn: () => customFetch(`/api/exams/${examId}/leaderboard`),
    enabled: !!examId,
    staleTime: 10_000,
    refetchInterval: (query) => {
      const d = query.state.data as LB | undefined;
      if (!d) return false;
      return status(d) === "live" ? 10_000 : false;
    },
  });

  const endTime = lb?.scheduledAt && lb?.durationMinutes
    ? new Date(new Date(lb.scheduledAt).getTime() + lb.durationMinutes * 60_000)
    : null;
  const startTime = lb?.scheduledAt ? new Date(lb.scheduledAt) : null;

  const cs = lb ? status(lb) : "na";
  const countdownTo = cs === "live" ? endTime : cs === "upcoming" ? startTime : null;
  const countdown = useCountdown(countdownTo);

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <Skeleton className="h-12 w-2/3 rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (!lb) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center">
        <p className="text-gray-500">Leaderboard not available.</p>
        <Link href="/exams"><Button variant="outline" className="mt-4">Back to Exams</Button></Link>
      </div>
    );
  }

  const top3   = lb.entries.slice(0, 3);
  const rest   = lb.entries.slice(3);
  const podiumOrder = top3.length === 3
    ? [top3[1], top3[0], top3[2]]   // silver | gold | bronze visual order
    : top3;

  return (
    <div className="min-h-screen bg-gray-50" style={{ colorScheme: "light" }}>
      <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">

        {/* ── Header ── */}
        <div className="flex items-start gap-3">
          <Link href={`/exams/${examId}`}>
            <button className="mt-1 text-gray-400 hover:text-gray-700">
              <ArrowLeft className="w-5 h-5" />
            </button>
          </Link>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-extrabold text-gray-900 truncate">{lb.examTitle}</h1>
              {cs === "live" && (
                <span className="flex items-center gap-1.5 bg-red-500 text-white text-xs font-bold px-2.5 py-1 rounded-full animate-pulse">
                  🔴 LIVE
                </span>
              )}
              {cs === "upcoming" && (
                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2.5 py-1 rounded-full">
                  UPCOMING
                </span>
              )}
              {cs === "ended" && (
                <span className="bg-gray-200 text-gray-600 text-xs font-bold px-2.5 py-1 rounded-full">
                  ENDED
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {lb.totalParticipants} participant{lb.totalParticipants !== 1 ? "s" : ""} · {lb.totalMarks} marks
            </p>
          </div>
          <button onClick={() => refetch()} title="Refresh"
            className="text-gray-400 hover:text-gray-700 mt-1">
            <RefreshCw className={`w-4 h-4 ${isFetching ? "animate-spin" : ""}`} />
          </button>
        </div>

        {/* ── Countdown banner ── */}
        {countdown && (
          <div style={{
            background: cs === "live" ? "linear-gradient(135deg,#dc3545,#c82333)" : "linear-gradient(135deg,#212c5e,#3b5fe3)",
          }} className="rounded-xl px-5 py-4 flex items-center justify-between text-white shadow-md">
            <div>
              <p className="text-xs font-semibold opacity-80 uppercase tracking-wider">
                {cs === "live" ? "Time Remaining" : "Contest Starts In"}
              </p>
              <p className="text-3xl font-black font-mono mt-0.5">{countdown}</p>
            </div>
            {cs === "live" && (
              <div className="text-right text-xs opacity-70">
                <p>Auto-refreshing</p>
                <p>every 10 seconds</p>
              </div>
            )}
            {cs === "upcoming" && lb.scheduledAt && (
              <div className="text-right text-xs opacity-70">
                <p>Starts at</p>
                <p className="font-semibold">{format(new Date(lb.scheduledAt), "dd MMM, HH:mm")}</p>
              </div>
            )}
          </div>
        )}

        {/* ── My rank card ── */}
        {lb.myEntry && (
          <div style={{ background: "linear-gradient(135deg,#212c5e,#3b5fe3)" }}
            className="rounded-xl px-5 py-4 flex items-center justify-between text-white shadow-md">
            <div className="flex items-center gap-3">
              <Trophy className="w-8 h-8 text-yellow-300 shrink-0" />
              <div>
                <p className="text-xs opacity-80 uppercase tracking-wider font-semibold">Your Rank</p>
                <p className="text-3xl font-black">#{lb.myEntry.rank}</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-3xl font-black">{lb.myEntry.score}</p>
              <p className="text-xs opacity-70">out of {lb.totalMarks}</p>
            </div>
          </div>
        )}

        {lb.entries.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-100 p-12 text-center">
            <Medal className="w-12 h-12 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No submissions yet.</p>
            <p className="text-sm text-gray-400 mt-1">Be the first to submit!</p>
          </div>
        ) : (
          <>
            {/* ── Podium ── */}
            {top3.length === 3 && (
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm px-6 pt-6 pb-4">
                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-5 text-center">Top 3</p>
                <div className="flex items-end justify-center gap-4">
                  {podiumOrder.map((entry) => {
                    const meta = PODIUM.find((p) => p.pos === entry.rank)!;
                    return <PodiumCard key={entry.userId} entry={entry} meta={meta} />;
                  })}
                </div>
              </div>
            )}

            {/* ── Full table ── */}
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="grid grid-cols-[2.5rem_1fr_auto] md:grid-cols-[2.5rem_1fr_auto_auto] items-center gap-x-3 px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-bold text-gray-400 uppercase tracking-wider">
                <span>#</span>
                <span>Participant</span>
                <span className="hidden md:block text-right">Submitted</span>
                <span className="text-right">Score</span>
              </div>
              <div className="divide-y divide-gray-50">
                {lb.entries.map((entry) => (
                  <div key={entry.userId}
                    style={entry.isCurrentUser ? { background: "#eff6ff" } : undefined}
                    className="grid grid-cols-[2.5rem_1fr_auto] md:grid-cols-[2.5rem_1fr_auto_auto] items-center gap-x-3 px-4 py-3">
                    {/* Rank */}
                    <span className={`text-sm font-black text-center ${entry.rank === 1 ? "text-yellow-500" : entry.rank === 2 ? "text-gray-400" : entry.rank === 3 ? "text-orange-500" : "text-gray-400"}`}>
                      {entry.rank <= 3 ? ["🥇","🥈","🥉"][entry.rank - 1] : entry.rank}
                    </span>

                    {/* Name */}
                    <Link href={`/users/${entry.userId}`}>
                      <a className="flex items-center gap-2.5 min-w-0 hover:opacity-80 transition-opacity">
                        <img
                          src={entry.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(entry.displayName)}&background=3b5fe3&color=fff`}
                          alt={entry.displayName}
                          className="w-8 h-8 rounded-full object-cover shrink-0 border border-gray-100"
                        />
                        <span className="text-sm font-semibold text-gray-800 truncate">
                          {entry.displayName}
                          {entry.isCurrentUser && (
                            <span className="ml-1.5 text-[10px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded-full">You</span>
                          )}
                        </span>
                      </a>
                    </Link>

                    {/* Submitted at */}
                    <span className="hidden md:block text-xs text-gray-400 text-right whitespace-nowrap">
                      {entry.submittedAt ? format(new Date(entry.submittedAt), "HH:mm:ss") : "—"}
                    </span>

                    {/* Score */}
                    <div className="text-right">
                      <span className="text-sm font-black text-gray-900">{entry.score}</span>
                      <span className="text-xs text-gray-400">/{lb.totalMarks}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {/* ── Footer ── */}
        <div className="flex justify-center gap-3">
          <Link href={`/exams/${examId}`}>
            <Button variant="outline">Back to Exam</Button>
          </Link>
          <Link href="/exams">
            <Button variant="outline">All Exams</Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
