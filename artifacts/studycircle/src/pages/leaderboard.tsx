import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useUser } from "@clerk/clerk-react";
import { customFetch } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Trophy, Medal, Crown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";
import { UserTierBadge, getTierAvatarRing } from "@/components/ui/user-tier-badge";
import { AvatarWithAura } from "@/components/ui/avatar-with-aura";
import { AVATAR_MAP as PREMIUM_AVATARS } from "@/lib/avatars";
import {
  getDailyTier,
  getWeeklyRank,
  getMonthlyRank,
  DAILY_TIERS,
  WEEKLY_RANKS,
  MONTHLY_RANKS,
} from "@/lib/rank-utils";

const resolveLeaderboardAvatar = (activeAvatarId: string | null, avatarUrl: string | null, displayName: string) => {
  if (activeAvatarId && PREMIUM_AVATARS[activeAvatarId]) return PREMIUM_AVATARS[activeAvatarId];
  if (avatarUrl) return avatarUrl;
  return `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName)}&backgroundColor=6366f1&textColor=ffffff`;
};

type Timeframe = "daily" | "weekly" | "monthly" | "all-time";

interface LeaderboardEntry {
  rank: number;
  userId: string;
  displayName: string;
  handle: string;
  avatarUrl: string;
  activeAvatarId: string | null;
  xp: number;
  level: number;
  totalMinutes: number;
  todayMinutes: number;
  streakDays: number;
  isYou: boolean;
}

function RankBadge({ entry, timeframe, total }: { entry: LeaderboardEntry; timeframe: Timeframe; total: number }) {
  if (timeframe === "daily") {
    const tier = getDailyTier(entry.todayMinutes);
    if (!tier) return <span className="text-xs text-muted-foreground">—</span>;
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-bold ${tier.color}`}>
        <tier.Icon className="w-3.5 h-3.5" />
        {tier.name}
      </span>
    );
  }
  if (timeframe === "weekly") {
    const r = getWeeklyRank(entry.totalMinutes, entry.rank, total);
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-bold ${r.color}`}>
        <r.Icon className="w-3.5 h-3.5" />
        {r.name}
      </span>
    );
  }
  if (timeframe === "monthly") {
    const r = getMonthlyRank(entry.totalMinutes, entry.rank, total);
    return (
      <span className={`inline-flex items-center gap-1 text-xs font-bold ${r.color}`}>
        <r.Icon className="w-3.5 h-3.5" />
        {r.name}
      </span>
    );
  }
  // all-time: show XP level
  return <span className="text-xs text-muted-foreground font-mono">Lv {entry.level}</span>;
}

function RankLegend({ timeframe }: { timeframe: Timeframe }) {
  if (timeframe === "daily") {
    return (
      <div className="flex flex-wrap justify-center gap-3 mt-8 max-w-2xl mx-auto">
        {DAILY_TIERS.map((t) => (
          <div key={t.name} className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${t.borderColor} bg-card/50 text-xs font-bold ${t.color}`}>
            <t.Icon className="w-3.5 h-3.5" />
            {t.name} ≥{t.minHours}h
          </div>
        ))}
      </div>
    );
  }
  if (timeframe === "weekly") {
    return (
      <div className="flex flex-wrap justify-center gap-3 mt-8 max-w-2xl mx-auto">
        {WEEKLY_RANKS.map((r) => (
          <div key={r.name} className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${r.border} ${r.bg} text-xs font-bold ${r.color}`}>
            <r.Icon className="w-3.5 h-3.5" />
            {r.name}
          </div>
        ))}
      </div>
    );
  }
  if (timeframe === "monthly") {
    return (
      <div className="flex flex-wrap justify-center gap-3 mt-8 max-w-2xl mx-auto">
        {MONTHLY_RANKS.map((r) => (
          <div key={r.name} className={`flex items-center gap-1.5 px-3 py-1 rounded-full border ${r.border} ${r.bg} text-xs font-bold ${r.color}`}>
            <r.Icon className="w-3.5 h-3.5" />
            {r.name}
          </div>
        ))}
      </div>
    );
  }
  return null;
}

function getUserRankLabel(entry: LeaderboardEntry, timeframe: Timeframe, total: number): string {
  if (timeframe === "daily") {
    const tier = getDailyTier(entry.todayMinutes);
    return tier ? tier.name : "No Aura";
  }
  if (timeframe === "weekly") return getWeeklyRank(entry.totalMinutes, entry.rank, total).name;
  if (timeframe === "monthly") return getMonthlyRank(entry.totalMinutes, entry.rank, total).name;
  return `Level ${entry.level}`;
}

export default function Leaderboard() {
  const { user } = useUser();
  const [timeframe, setTimeframe] = useState<Timeframe>("weekly");
  const [filterType, setFilterType] = useState<"global" | "circle">("global");

  const { data: leaderboard, isLoading } = useQuery({
    queryKey: ["leaderboard", timeframe, filterType],
    queryFn: async () => {
      return await customFetch<LeaderboardEntry[]>(`/api/leaderboard?timeframe=${timeframe}&type=${filterType}`);
    }
  });

  const currentUserEntry = leaderboard?.find(entry => entry.userId === user?.id);
  const total = leaderboard?.length ?? 0;

  const formatMinutes = (mins: number) => {
    if (!mins) return "0h 0m";
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
  };

  const top3 = leaderboard ? leaderboard.slice(0, 3) : [];
  const restOfBoard = leaderboard ? leaderboard.slice(3, 100) : [];

  return (
    <div className="max-w-4xl mx-auto pb-24 animate-in fade-in duration-500">
      {/* Header */}
      <div className="mb-8 text-center space-y-4 pt-4">
        <div className="inline-flex items-center justify-center p-3 bg-indigo-500/10 rounded-2xl text-indigo-400 mb-2">
          <Trophy className="w-8 h-8" />
        </div>
        <h1 className="text-4xl font-black tracking-tight text-foreground">Leaderboard</h1>
        <p className="text-muted-foreground">Compete with friends and the global community.</p>

        {/* Toggles */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mt-8">
          <div className="bg-card/50 p-1.5 rounded-2xl flex border border-border">
            {(["daily", "weekly", "monthly", "all-time"] as Timeframe[]).map((t) => (
              <button
                key={t}
                onClick={() => setTimeframe(t)}
                className={`px-5 py-2 rounded-xl text-sm font-bold transition-all capitalize ${timeframe === t ? "bg-indigo-600 text-white shadow-lg" : "text-muted-foreground hover:text-foreground"}`}
              >
                {t === "all-time" ? "All-Time" : t.charAt(0).toUpperCase() + t.slice(1)}
              </button>
            ))}
          </div>

          <div className="bg-card/50 p-1.5 rounded-2xl flex border border-border">
            <button
              onClick={() => setFilterType("global")}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filterType === "global" ? "bg-muted text-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"}`}
            >
              Global
            </button>
            <button
              onClick={() => setFilterType("circle")}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${filterType === "circle" ? "bg-muted text-foreground shadow-lg" : "text-muted-foreground hover:text-foreground"}`}
            >
              My Circles
            </button>
          </div>
        </div>

        {/* Rank Legend */}
        <RankLegend timeframe={timeframe} />
      </div>

      {/* Podium for Top 3 */}
      {isLoading ? (
        <div className="flex justify-center gap-6 mb-12 mt-12 h-64">
          {[1, 2, 3].map(i => <Skeleton key={i} className="w-32 h-48 rounded-3xl bg-white/5" />)}
        </div>
      ) : top3.length > 0 && (
        <div className="flex justify-center items-end gap-2 sm:gap-6 mb-12 mt-12 h-64">
          {/* Rank 2 */}
          {top3[1] && (
            <motion.div
              initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
              className="flex flex-col items-center relative z-10 w-28 sm:w-32"
            >
              <div className="text-muted-foreground font-black text-xl mb-3">#2</div>
              <div className="relative mb-4">
                <AvatarWithAura
                  src={resolveLeaderboardAvatar(top3[1].activeAvatarId, top3[1].avatarUrl, top3[1].displayName)}
                  fallback={top3[1].displayName.charAt(0)}
                  todayMinutes={top3[1].todayMinutes}
                  size="lg"
                />
                <div className="absolute -bottom-2 -right-2">
                  <UserTierBadge minutes={top3[1].todayMinutes} showIconOnly />
                </div>
              </div>
              <div className="font-bold text-foreground text-center truncate w-full">{top3[1].displayName}</div>
              <div className="text-xs text-muted-foreground font-mono mt-1">{formatMinutes(top3[1].totalMinutes)}</div>
              <div className="mt-1"><RankBadge entry={top3[1]} timeframe={timeframe} total={total} /></div>
            </motion.div>
          )}

          {/* Rank 1 */}
          {top3[0] && (
            <motion.div
              initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
              className="flex flex-col items-center relative z-20 w-32 sm:w-40 -mt-12"
            >
              <div className="text-yellow-500 font-black text-2xl mb-3 flex items-center gap-1">
                <Crown className="w-5 h-5" /> #1
              </div>
              <div className="relative mb-4">
                <AvatarWithAura
                  src={resolveLeaderboardAvatar(top3[0].activeAvatarId, top3[0].avatarUrl, top3[0].displayName)}
                  fallback={top3[0].displayName.charAt(0)}
                  todayMinutes={top3[0].todayMinutes}
                  size="xl"
                />
                <div className="absolute -bottom-2 -right-2">
                  <UserTierBadge minutes={top3[0].todayMinutes} showIconOnly />
                </div>
              </div>
              <div className="font-bold text-lg text-foreground text-center truncate w-full">{top3[0].displayName}</div>
              <div className="text-sm font-bold text-yellow-500 font-mono mt-1">{formatMinutes(top3[0].totalMinutes)}</div>
              <div className="mt-1"><RankBadge entry={top3[0]} timeframe={timeframe} total={total} /></div>
            </motion.div>
          )}

          {/* Rank 3 */}
          {top3[2] && (
            <motion.div
              initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="flex flex-col items-center relative z-10 w-28 sm:w-32"
            >
              <div className="text-amber-600 font-black text-xl mb-3">#3</div>
              <div className="relative mb-4">
                <AvatarWithAura
                  src={resolveLeaderboardAvatar(top3[2].activeAvatarId, top3[2].avatarUrl, top3[2].displayName)}
                  fallback={top3[2].displayName.charAt(0)}
                  todayMinutes={top3[2].todayMinutes}
                  size="lg"
                />
                <div className="absolute -bottom-2 -right-2">
                  <UserTierBadge minutes={top3[2].todayMinutes} showIconOnly />
                </div>
              </div>
              <div className="font-bold text-foreground text-center truncate w-full">{top3[2].displayName}</div>
              <div className="text-xs text-amber-600 font-mono mt-1">{formatMinutes(top3[2].totalMinutes)}</div>
              <div className="mt-1"><RankBadge entry={top3[2]} timeframe={timeframe} total={total} /></div>
            </motion.div>
          )}
        </div>
      )}

      {/* Leaderboard List for Ranks 4+ */}
      {restOfBoard.length > 0 && (
        <Card className="bg-card/80 border-border overflow-hidden shadow-2xl backdrop-blur-sm rounded-3xl">
          <div className="flex text-xs font-bold text-muted-foreground uppercase tracking-wider px-8 py-4 bg-white/2 border-b border-border">
            <div className="w-16">#</div>
            <div className="flex-1">Student</div>
            <div className="w-32 hidden sm:block text-center">Rank</div>
            <div className="w-20 hidden sm:block text-center">Level</div>
            <div className="w-24 text-right">Study Time</div>
          </div>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-4 space-y-4">
                {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 w-full rounded-2xl bg-white/5" />)}
              </div>
            ) : (
              <div className="divide-y divide-border">
                {restOfBoard.map((entry, i) => (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={entry.userId}
                    className={`flex items-center px-8 py-4 transition-colors hover:bg-white/2 ${entry.userId === user?.id ? "bg-indigo-500/10 hover:bg-indigo-500/15" : ""}`}
                  >
                    <div className="w-16 flex items-center justify-start font-black text-muted-foreground">
                      #{entry.rank}
                    </div>

                    <div className="flex-1 flex items-center gap-4">
                      <Avatar className={`w-10 h-10 border border-border ${getTierAvatarRing(entry.todayMinutes)}`}>
                        <AvatarImage src={resolveLeaderboardAvatar(entry.activeAvatarId, entry.avatarUrl, entry.displayName)} />
                        <AvatarFallback className="bg-muted">{entry.displayName.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div className="font-bold text-foreground">{entry.displayName}</div>
                    </div>

                    <div className="w-32 hidden sm:flex justify-center">
                      <RankBadge entry={entry} timeframe={timeframe} total={total} />
                    </div>

                    <div className="w-20 hidden sm:flex justify-center text-xs text-muted-foreground font-medium">
                      Lv {entry.level}
                    </div>

                    <div className="w-24 text-right font-mono font-bold text-indigo-400">
                      {formatMinutes(entry.totalMinutes)}
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Empty state */}
      {!isLoading && (!leaderboard || leaderboard.length === 0) && (
        <Card className="bg-card/80 border-border rounded-3xl">
          <CardContent className="p-12 text-center text-muted-foreground">
            <Trophy className="w-12 h-12 mx-auto opacity-20 mb-4" />
            <p>No study sessions recorded yet for this timeframe.</p>
            <p className="text-sm mt-1">Be the first to get on the board!</p>
          </CardContent>
        </Card>
      )}

      {/* Sticky Current User Banner */}
      {currentUserEntry && (
        <div className="fixed bottom-16 lg:bottom-0 left-0 right-0 lg:left-64 lg:right-0 p-4 z-40 bg-background/90 backdrop-blur-xl border-t border-border shadow-[0_-20px_40px_rgba(0,0,0,0.3)]">
          <div className="max-w-4xl mx-auto flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-full bg-indigo-500 flex items-center justify-center text-white font-black shadow-lg shadow-indigo-500/20">
                #{currentUserEntry.rank}
              </div>
              <div>
                <h4 className="font-bold text-foreground flex items-center gap-2">
                  Your Rank
                  <RankBadge entry={currentUserEntry} timeframe={timeframe} total={total} />
                </h4>
                <p className="text-xs text-muted-foreground">
                  {getUserRankLabel(currentUserEntry, timeframe, total)} · {formatMinutes(currentUserEntry.totalMinutes)} studied
                </p>
              </div>
            </div>
            <div className="hidden sm:block">
              <span className="text-xs font-bold text-indigo-400 bg-indigo-500/10 px-4 py-2 rounded-full border border-indigo-500/20">
                Top {Math.ceil((currentUserEntry.rank / total) * 100)}%
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
