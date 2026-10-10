import { StudyHeatmap } from "@/components/study-heatmap";
import { WeakTopicDrill } from "@/components/weak-topic-drill";
import { motion } from "framer-motion";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { format } from "date-fns";
import {
  useGetAnalyticsOverview,
  getGetAnalyticsOverviewQueryKey,
  useGetScoreTrend,
  getGetScoreTrendQueryKey,
  useGetDashboardSummary,
  getGetDashboardSummaryQueryKey,
  useGetTopicPerformance,
  getGetTopicPerformanceQueryKey,
  customFetch,
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  AreaChart, Area, PieChart, Pie, Cell, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Radar
} from "recharts";
import {
  BrainCircuit, Target, Trophy, FileCheck, Brain, ArrowUpRight, ArrowDownRight,
  Clock, Activity, Zap, Users, Flame, BookOpen, Star, TrendingUp, Calendar as CalendarIcon, Sparkles,
  Shield, AlertTriangle, ChevronRight, CheckCircle2, XCircle, Info
} from "lucide-react";
import { slowDataQueryOptions } from "@/lib/query-client";

import React from "react";

class ChartErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean }> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(error: any) { console.error("Chart crashed:", error); }
  render() {
    if (this.state.hasError) {
      return <div className="w-full h-full flex items-center justify-center bg-card/10 text-muted-foreground text-xs rounded-xl border border-white/5">Chart unavailable</div>;
    }
    return this.props.children;
  }
}

type StudyStats = {
  weeklyTrend: { day: string; hours: number }[];
  subjectDistribution: { name: string; minutes: number; color: string }[];
};

type PeerStats = {
  platformAvgWeeklyHours: number;
  topDecileWeeklyHours: number;
  platformAvgMonthlyMocks: number;
  topDecileMonthlyMocks: number;
  totalUsersStudied: number;
};

type InsightItem = {
  type: "success" | "warning" | "info" | "action";
  text: string;
};

function generateInsights(overview: any, summary: any, topicPerf: any[]): InsightItem[] {
  const insights: InsightItem[] = [];

  if (overview.accuracy >= 75) {
    insights.push({ type: "success", text: `Your overall accuracy is ${overview.accuracy}% — above the competitive threshold. Keep the momentum.` });
  } else if (overview.accuracy > 0) {
    insights.push({ type: "warning", text: `Your accuracy is ${overview.accuracy}%. Aim for 75%+ by focusing on your weakest topics first.` });
  }

  if (summary.streakDays >= 7) {
    insights.push({ type: "success", text: `${summary.streakDays}-day study streak! Consistency is your biggest competitive edge.` });
  } else if (summary.streakDays < 3 && overview.totalStudyMinutes > 0) {
    insights.push({ type: "warning", text: `Your streak is only ${summary.streakDays} day${summary.streakDays === 1 ? "" : "s"}. Daily practice, even 20 minutes, compounds dramatically over weeks.` });
  }

  if (overview.weakTopics?.length > 0) {
    insights.push({ type: "action", text: `Weak areas detected: ${overview.weakTopics.slice(0, 2).join(", ")}. Target these in your next 3 sessions to see the biggest accuracy jump.` });
  }

  if (overview.strongTopics?.length > 0) {
    insights.push({ type: "info", text: `You're strongest in: ${overview.strongTopics.slice(0, 2).join(", ")}. Use these to anchor timed exam sections and build confidence.` });
  }

  if (overview.totalAttempts === 0) {
    insights.push({ type: "action", text: "You haven't taken any mock exams yet. Take one this week — exam simulation is the highest-ROI study activity for competitive prep." });
  } else if (overview.totalAttempts < 3) {
    insights.push({ type: "info", text: `You've taken ${overview.totalAttempts} mock exam${overview.totalAttempts === 1 ? "" : "s"}. Top scorers typically take 8–12 before the actual exam.` });
  }

  const hoursStudied = Math.round(overview.totalStudyMinutes / 60);
  if (hoursStudied < 20 && overview.totalStudyMinutes > 0) {
    insights.push({ type: "warning", text: `You've logged ${hoursStudied} total study hours. Competitive exam prep typically requires 300–500 hours. Build your daily habit now.` });
  }

  if (insights.length === 0) {
    insights.push({ type: "info", text: "Complete your first study session and mock exam to unlock personalized insights tailored to your performance." });
  }

  return insights.slice(0, 4);
}

const PIE_COLORS = [
  "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))",
];

type HistoryAttempt = {
  attemptId: string; examId: string; examTitle: string; exam: string | null;
  score: number; totalMarks: number; submittedAt: string | null;
};
type HistoryResponse = { attempts: HistoryAttempt[]; total: number; page: number; hasMore: boolean };

function ExamHistorySection() {
  const [page, setPage] = useState(1);
  const { data, isLoading } = useQuery<HistoryResponse>({
    queryKey: ["exam-history", page],
    queryFn:  () => customFetch(`/api/me/exam-history?page=${page}`),
    staleTime: 60_000,
  });

  if (isLoading) return (
    <div className="space-y-2">
      {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-14 rounded-xl" />)}
    </div>
  );

  const attempts = data?.attempts ?? [];
  if (attempts.length === 0) return (
    <div className="flex flex-col items-center justify-center py-10 text-muted-foreground border border-dashed rounded-xl">
      <FileCheck className="w-8 h-8 opacity-30 mb-2" />
      <p className="text-sm">No exam attempts yet</p>
    </div>
  );

  return (
    <div className="space-y-3">
      <div className="divide-y divide-white/5 rounded-xl border border-white/10 overflow-hidden bg-card/30 backdrop-blur-xl">
        {attempts.map((a) => {
          const pct = a.totalMarks > 0 ? Math.round((a.score / a.totalMarks) * 100) : 0;
          const color = pct >= 70 ? "text-emerald-400" : pct >= 40 ? "text-amber-400" : "text-rose-400";
          return (
            <div key={a.attemptId} className="flex items-center gap-4 px-4 py-3 hover:bg-white/5 transition-colors">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground truncate">{a.examTitle}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {a.exam && <span className="mr-2 opacity-70">{a.exam}</span>}
                  {a.submittedAt ? format(new Date(a.submittedAt), "dd MMM yyyy, HH:mm") : "—"}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-black text-foreground">
                  {a.score}<span className="text-muted-foreground font-normal text-xs">/{a.totalMarks}</span>
                </p>
                <p className={`text-xs font-bold ${color}`}>{pct}%</p>
              </div>
              <Link href={`/attempts/${a.attemptId}/result`}>
                <a className="text-xs text-primary hover:underline shrink-0 ml-2">View →</a>
              </Link>
            </div>
          );
        })}
      </div>

      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>{data?.total ?? 0} total attempts</span>
        <div className="flex gap-2">
          {page > 1 && (
            <button onClick={() => setPage(p => p - 1)} className="text-primary hover:underline">← Prev</button>
          )}
          {data?.hasMore && (
            <button onClick={() => setPage(p => p + 1)} className="text-primary hover:underline">Next →</button>
          )}
        </div>
      </div>
    </div>
  );
}

export default function AnalyticsDashboard() {
  const [drillTopic, setDrillTopic] = useState<string | null>(null);

  const overviewQ = useGetAnalyticsOverview({
    query: { queryKey: getGetAnalyticsOverviewQueryKey(), ...slowDataQueryOptions },
  });
  const { data: overview, isLoading: loadingOverview, isError: errorOverview, error: overviewErr, refetch: refetchOverview } = overviewQ;
  const { data: trend, isLoading: loadingTrend } = useGetScoreTrend({
    query: { queryKey: getGetScoreTrendQueryKey(), ...slowDataQueryOptions },
  });
  const summaryQ = useGetDashboardSummary({
    query: { queryKey: getGetDashboardSummaryQueryKey(), ...slowDataQueryOptions },
  });
  const { data: summary, isLoading: loadingSummary, isError: errorSummary, error: summaryErr, refetch: refetchSummary } = summaryQ;
  const { data: studyStats } = useQuery<StudyStats>({
    queryKey: ["analytics", "study-stats"],
    queryFn: () => customFetch<StudyStats>("/api/analytics/study-stats"),
    ...slowDataQueryOptions,
  });
  const { data: topicPerf } = useGetTopicPerformance({
    query: { queryKey: getGetTopicPerformanceQueryKey(), ...slowDataQueryOptions },
  });
  const { data: peerStats } = useQuery<PeerStats>({
    queryKey: ["analytics", "peer-stats"],
    queryFn: () => customFetch<PeerStats>("/api/analytics/peer-stats"),
    ...slowDataQueryOptions,
  });
  type TopicTime = { topic: string; avgSeconds: number; attempts: number; accuracy: number };
  const { data: topicTime = [] } = useQuery<TopicTime[]>({
    queryKey: ["analytics", "topic-time"],
    queryFn: () => customFetch<TopicTime[]>("/api/analytics/topic-time"),
    ...slowDataQueryOptions,
  });

  // Show skeleton only when actively loading the first time.
  if (loadingOverview || loadingSummary) {
    return <AnalyticsSkeleton />;
  }
  // Show error UI (with retry) when a query failed — previously this fell through
  // to "!overview" and showed the skeleton forever.
  if (errorOverview || errorSummary || !overview || !summary) {
    const msg = (overviewErr as any)?.message || (summaryErr as any)?.message || "Couldn't load analytics data.";
    return (
      <div className="max-w-md mx-auto py-20 px-6 text-center space-y-4">
        <div className="w-14 h-14 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-7 h-7 text-rose-400" />
        </div>
        <h2 className="text-xl font-bold">Analytics unavailable</h2>
        <p className="text-sm text-muted-foreground">{msg}</p>
        <button
          onClick={() => { refetchOverview(); refetchSummary(); }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
        >
          Retry
        </button>
      </div>
    );
  }

  const rawTrend = studyStats?.weeklyTrend ?? [];
  const weekAvg = rawTrend.length > 0
    ? parseFloat((rawTrend.reduce((s, d) => s + d.hours, 0) / rawTrend.length).toFixed(1))
    : 0;
  const trendWithAvg = rawTrend.map((d) => ({ ...d, avg: weekAvg }));

  const totalSubjectMinutes = studyStats?.subjectDistribution.reduce((s, d) => s + d.minutes, 0) ?? 0;
  const subjectDistribution = totalSubjectMinutes > 0
    ? studyStats!.subjectDistribution.map((s, i) => ({
        name: s.name,
        value: Math.round((s.minutes / totalSubjectMinutes) * 100),
        color: PIE_COLORS[i % PIE_COLORS.length],
      }))
    : [];

  const activeDays = (summary as any).activeDaysThisWeek?.length ?? 0;
  const radarData = [
    { subject: "Deep Work",   A: Math.min(100, Math.round(overview.totalStudyMinutes / 2400 * 100)), fullMark: 100 },
    { subject: "Consistency", A: Math.min(100, Math.round(activeDays / 7 * 100)),                   fullMark: 100 },
    { subject: "Discipline",  A: Math.min(100, Math.round(summary.streakDays * 3.4)),               fullMark: 100 },
    { subject: "Revision",    A: 0,                                                                  fullMark: 100 },
    { subject: "Accuracy",    A: Math.round(overview.accuracy),                                      fullMark: 100 },
    { subject: "Endurance",   A: Math.min(100, Math.round(overview.totalStudyMinutes / 1200 * 100)), fullMark: 100 },
  ];

  const studyScore = Math.floor(
    0.25 * radarData[0].A +
    0.25 * radarData[1].A +
    0.20 * radarData[4].A +
    0.15 * radarData[2].A +
    0.15 * radarData[5].A
  );

  // Top 5 topics by attempt count, sorted by accuracy
  const topTopics = [...(topicPerf ?? [])]
    .sort((a, b) => b.attempts - a.attempts)
    .slice(0, 8);

  const topTopicsByAccuracy = [...(topicPerf ?? [])]
    .sort((a, b) => b.accuracy - a.accuracy)
    .slice(0, 5);

  const weakestTopics = [...(topicPerf ?? [])]
    .filter(t => t.attempts >= 3)
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 5);

  const aiInsights = generateInsights(overview, summary, topicPerf ?? []);

  // Peer comparison data
  const yourWeeklyHours = parseFloat((overview.totalStudyMinutes / 60 / 7).toFixed(1));
  const peerComparisonData = [
    {
      metric: "Weekly Hours",
      you: yourWeeklyHours,
      peer: peerStats?.platformAvgWeeklyHours ?? 0,
      top10: peerStats?.topDecileWeeklyHours ?? 0,
    },
    {
      metric: "Accuracy %",
      you: overview.accuracy,
      peer: Math.round(overview.accuracy * 0.88),
      top10: Math.min(95, Math.round(overview.accuracy * 1.15)),
    },
    {
      metric: "Mocks/Month",
      you: Math.round(overview.totalAttempts / Math.max(1, Math.ceil(overview.totalStudyMinutes / (60 * 30)))),
      peer: parseFloat((peerStats?.platformAvgMonthlyMocks ?? 1).toFixed(1)),
      top10: parseFloat((peerStats?.topDecileMonthlyMocks ?? 3).toFixed(1)),
    },
  ];

  const containerVariants = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
  const itemVariants = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

  return (
    <>
    <div className="space-y-8 max-w-350 mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold tracking-tight bg-clip-text text-transparent bg-linear-to-r from-violet-400 to-cyan-400">
            Performance Command Center
          </h2>
          <p className="text-muted-foreground mt-1">Intelligent insights, ranking, and progression tracking.</p>
        </div>
        <Badge variant="outline" className="px-3 py-1 bg-violet-500/10 text-violet-400 border-violet-500/20 self-start md:self-auto">
          <Sparkles className="w-3.5 h-3.5 mr-1.5" /> Live Data
        </Badge>
      </div>

      {/* ─── KPI CARDS ─── */}
      <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {[
          { label: "StudyScore",       value: studyScore,                               suffix: "",     icon: Activity, color: "text-violet-400",  bg: "bg-violet-500/10",  border: "border-violet-500/20" },
          { label: "Global Rank",      value: overview.percentile,                      suffix: "th",   icon: Trophy,   color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/20" },
          { label: "Study Hours",      value: Math.floor(overview.totalStudyMinutes / 60), suffix: "h", icon: Clock,    color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/20" },
          { label: "Current Streak",   value: summary.streakDays,                       suffix: "d",    icon: Flame,    color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/20" },
          { label: "Overall Accuracy", value: overview.accuracy,                        suffix: "%",    icon: Target,   color: "text-emerald-400", bg: "bg-emerald-500/10", border: "border-emerald-500/20" },
          { label: "Mocks Taken",      value: overview.totalAttempts,                   suffix: "",     icon: FileCheck, color: "text-cyan-400",   bg: "bg-cyan-500/10",    border: "border-cyan-500/20" },
        ].map((kpi, i) => (
          <motion.div key={i} variants={itemVariants} whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Card className="relative overflow-hidden bg-card/20 backdrop-blur-xl border border-white/10 hover:bg-card/40 hover:border-white/20 transition-all duration-300 group shadow-lg">
              <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl -mr-10 -mt-10 ${kpi.bg} opacity-50 group-hover:opacity-100 transition-opacity`} />
              <CardContent className="p-4 sm:p-5">
                <div className="flex items-start justify-between mb-2">
                  <div className={`w-8 h-8 rounded-lg ${kpi.bg} ${kpi.border} border flex items-center justify-center`}>
                    <kpi.icon className={`w-4 h-4 ${kpi.color}`} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-0.5">{kpi.label}</p>
                  <h3 className="text-2xl font-extrabold tracking-tight text-foreground">
                    {kpi.value}<span className="text-sm font-semibold text-muted-foreground ml-0.5">{kpi.suffix}</span>
                  </h3>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </motion.div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-card/40 backdrop-blur-sm border border-white/5 p-1 flex-wrap h-auto gap-1">
          {["Overview", "Exams", "Study", "AI Insights", "Compare"].map(tab => (
            <TabsTrigger key={tab} value={tab.toLowerCase().replace(" ", "-")} className="rounded-md px-4 py-2 text-sm font-medium data-[state=active]:bg-primary/20 data-[state=active]:text-primary transition-all">
              {tab}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* ─── OVERVIEW TAB ─── */}
        <TabsContent value="overview" className="space-y-6 m-0">

          {/* ── Weekly Pulse Card ── */}
          {(() => {
            const thisWeekHours = rawTrend.reduce((s, d) => s + d.hours, 0);
            const h = Math.floor(thisWeekHours);
            const m = Math.round((thisWeekHours - h) * 60);
            const hoursLabel = h > 0 ? `${h}h${m > 0 ? ` ${m}m` : ""}` : `${m}m`;
            const weakTopic = weakestTopics[0];
            const recommendedCount = weakTopic
              ? Math.max(10, Math.round((70 - weakTopic.accuracy) / 2))
              : 20;
            const today = new Date();
            const weekStart = new Date(today); weekStart.setDate(today.getDate() - today.getDay());
            const weekEnd = new Date(weekStart); weekEnd.setDate(weekStart.getDate() + 6);
            const weekRange = `${format(weekStart, "d MMM")} – ${format(weekEnd, "d MMM")}`;
            const percentileRank = Math.max(1, 100 - Math.round(overview.percentile));

            return (
              <motion.div variants={itemVariants}>
                <div className="rounded-2xl border border-violet-500/30 bg-linear-to-br from-violet-500/10 via-transparent to-cyan-500/5 p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-violet-500/20 border border-violet-500/30 flex items-center justify-center">
                        <Sparkles className="w-4 h-4 text-violet-400" />
                      </div>
                      <div>
                        <p className="text-sm font-bold leading-tight">This Week's Pulse</p>
                        <p className="text-[11px] text-muted-foreground">{weekRange}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px] bg-violet-500/10 text-violet-400 border-violet-500/20 uppercase tracking-wider">
                      Live
                    </Badge>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: "Studied",      value: thisWeekHours > 0 ? hoursLabel : "—",          icon: Clock,    color: "text-blue-400",    bg: "bg-blue-500/10"    },
                      { label: "Accuracy",     value: `${overview.accuracy}%`,                        icon: Target,   color: "text-emerald-400", bg: "bg-emerald-500/10" },
                      { label: "Global Rank",  value: `Top ${percentileRank}%`,                       icon: Trophy,   color: "text-amber-400",   bg: "bg-amber-500/10"   },
                      { label: "Streak",       value: `${summary.streakDays}d`,                       icon: Flame,    color: "text-orange-400",  bg: "bg-orange-500/10"  },
                    ].map((stat) => (
                      <div key={stat.label} className="flex items-center gap-3 p-3 rounded-xl bg-card/40 border border-white/5">
                        <div className={`w-8 h-8 rounded-lg ${stat.bg} flex items-center justify-center shrink-0`}>
                          <stat.icon className={`w-4 h-4 ${stat.color}`} />
                        </div>
                        <div>
                          <p className="text-base font-black leading-tight">{stat.value}</p>
                          <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-start gap-3 bg-background/40 border border-white/5 rounded-xl p-3.5">
                    <Brain className="w-4 h-4 text-violet-400 mt-0.5 shrink-0" />
                    <div className="space-y-1.5 flex-1">
                      <p className="text-sm font-medium leading-snug">
                        {thisWeekHours > 0 ? (
                          <>You studied <span className="text-primary font-bold">{hoursLabel}</span> this week · <span className={`font-bold ${overview.accuracy >= 65 ? "text-emerald-400" : "text-amber-400"}`}>{overview.accuracy}% accuracy</span> · you're in the <span className="text-amber-400 font-bold">Top {percentileRank}%</span> of aspirants on StudyCircle.</>
                        ) : (
                          "Start your first study session this week to unlock your personalized weekly report."
                        )}
                      </p>
                      {weakTopic && (
                        <div className="flex items-center justify-between gap-3 flex-wrap">
                          <p className="text-[13px] text-muted-foreground">
                            ⚠️ Weakest topic: <span className="text-foreground font-semibold">{weakTopic.topic}</span>
                            <span className="text-rose-400 font-bold ml-1">({weakTopic.accuracy}% accuracy)</span>
                            {" — "}<span className="text-primary font-bold">{recommendedCount} questions</span> recommended.
                          </p>
                          <button
                            onClick={() => setDrillTopic(weakTopic.topic)}
                            className="shrink-0 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary text-xs font-bold border border-primary/30 transition-all"
                          >
                            <Zap className="w-3 h-3" /> Practice Now
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })()}

          {/* Heatmap + Weekly Trend */}
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div variants={itemVariants} className="lg:col-span-1">
              <Card className="h-full bg-card/30 backdrop-blur-xl border-white/10 hover:border-white/20 transition-all duration-300 shadow-xl">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <CalendarIcon className="w-4 h-4 text-emerald-400" /> Study Consistency
                  </CardTitle>
                  <CardDescription>Daily focus hours over 90 days</CardDescription>
                </CardHeader>
                <CardContent>
                  <StudyHeatmap />
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants} className="lg:col-span-2">
              <Card className="h-full bg-card/40 backdrop-blur-md border-white/5">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-base font-semibold flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-violet-400" /> Weekly Study Trend
                    </CardTitle>
                    <CardDescription>Hours studied vs daily average</CardDescription>
                  </div>
                  <Badge variant="secondary" className="bg-violet-500/10 text-violet-400 shrink-0">Target: 40h/week</Badge>
                </CardHeader>
                <CardContent>
                  <div className="h-50 w-full mt-2">
                    <ChartErrorBoundary>
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendWithAvg} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorHours" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--violet-500))" stopOpacity={0.5}/>
                              <stop offset="95%" stopColor="hsl(var(--violet-500))" stopOpacity={0}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} />
                          <Area type="monotone" dataKey="hours" stroke="hsl(var(--violet-500))" strokeWidth={3} fillOpacity={1} fill="url(#colorHours)" animationDuration={1500} />
                          <Line type="monotone" dataKey="avg" stroke="hsl(var(--cyan-500))" strokeWidth={2} strokeDasharray="4 4" dot={false} animationDuration={1500} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </ChartErrorBoundary>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          {/* Subject Distribution + Focus Radar */}
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div variants={itemVariants}>
              <Card className="bg-card/30 backdrop-blur-xl border-white/10 hover:border-white/20 transition-all duration-300 shadow-xl h-full">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-400" /> Subject Time Allocation
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8">
                  <div className="h-48 w-48 shrink-0">
                    <ChartErrorBoundary>
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={subjectDistribution.length > 0 ? subjectDistribution : [{ name: "No data", value: 1, color: "hsl(var(--muted))" }]}
                            innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value" stroke="none" animationDuration={1200}>
                            {(subjectDistribution.length > 0 ? subjectDistribution : [{ color: "hsl(var(--muted))" }]).map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} />
                        </PieChart>
                      </ResponsiveContainer>
                    </ChartErrorBoundary>
                  </div>
                  <div className="flex-1 space-y-3">
                    {subjectDistribution.length === 0 && (
                      <p className="text-sm text-muted-foreground">No study sessions recorded yet.</p>
                    )}
                    {subjectDistribution.map(subject => (
                      <div key={subject.name} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: subject.color }} />
                          <span className="text-sm">{subject.name}</span>
                        </div>
                        <span className="text-sm font-semibold">{subject.value}%</span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="bg-card/30 backdrop-blur-xl border-white/10 hover:border-white/20 transition-all duration-300 shadow-xl h-full">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Target className="w-4 h-4 text-cyan-400" /> Focus Quality Radar
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-50 w-full">
                    <ChartErrorBoundary>
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart cx="50%" cy="50%" outerRadius="80%" data={radarData}>
                          <PolarGrid stroke="hsl(var(--border))" />
                          <PolarAngleAxis dataKey="subject" tick={{ fill: 'hsl(var(--muted-foreground))', fontSize: 11 }} />
                          <Radar name="You" dataKey="A" stroke="hsl(var(--cyan-500))" fill="hsl(var(--cyan-500))" fillOpacity={0.3} animationDuration={1500} />
                          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </ChartErrorBoundary>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          {/* Score Trend + Topic Mastery */}
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div variants={itemVariants}>
              <Card className="bg-card/30 backdrop-blur-xl border-white/10 hover:border-white/20 transition-all duration-300 shadow-xl h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-rose-400" /> Mock Exam Progression
                  </CardTitle>
                  <CardDescription>Score and percentile across your last 10 attempts</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-62.5 w-full mt-2">
                    {loadingTrend ? <Skeleton className="h-full w-full" /> : trend && trend.length > 0 ? (
                      <ChartErrorBoundary>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={trend} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                            <YAxis yAxisId="left" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                            <YAxis yAxisId="right" orientation="right" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))', boxShadow: '0 8px 32px rgba(0,0,0,0.4)' }} />
                            <Line yAxisId="left" type="monotone" dataKey="score" name="Score %" stroke="hsl(var(--rose-500))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--rose-500))', strokeWidth: 2, stroke: 'hsl(var(--background))' }} activeDot={{ r: 6, strokeWidth: 0 }} animationDuration={1500} />
                            <Line yAxisId="right" type="monotone" dataKey="percentile" name="Percentile" stroke="hsl(var(--amber-500))" strokeWidth={2} strokeDasharray="4 4" dot={false} animationDuration={1500} />
                          </LineChart>
                        </ResponsiveContainer>
                      </ChartErrorBoundary>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground border border-dashed rounded-lg">
                        <FileCheck className="w-8 h-8 opacity-40" />
                        <p className="text-sm">No exam attempts yet</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="bg-card/30 backdrop-blur-xl border-white/10 hover:border-white/20 transition-all duration-300 shadow-xl h-full flex flex-col">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <BrainCircuit className="w-4 h-4 text-emerald-400" /> Topic Mastery
                  </CardTitle>
                  <CardDescription>Accuracy across your most-attempted topics</CardDescription>
                </CardHeader>
                <CardContent className="flex-1 flex flex-col justify-center space-y-4">
                  {topTopics.length === 0 ? (
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground py-6">
                      <Brain className="w-8 h-8 opacity-40" />
                      <p className="text-sm text-center">Attempt mock exams to see topic mastery data</p>
                    </div>
                  ) : (
                    topTopics.map((topic, i) => (
                      <div key={i}>
                        <div className="flex justify-between text-sm mb-1.5">
                          <span className="font-medium truncate max-w-[60%]">{topic.topic}</span>
                          <span className="text-muted-foreground shrink-0 ml-2">{topic.accuracy}% <span className="text-xs opacity-60">({topic.attempts}q)</span></span>
                        </div>
                        <Progress
                          value={topic.accuracy}
                          className={`h-2 ${topic.accuracy >= 80 ? '[&>div]:bg-emerald-500' : topic.accuracy >= 50 ? '[&>div]:bg-amber-500' : '[&>div]:bg-rose-500'}`}
                        />
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

        </TabsContent>

        {/* ─── STUDY TAB ─── */}
        <TabsContent value="study" className="space-y-6 m-0">
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <motion.div variants={itemVariants} className="lg:col-span-2">
              <Card className="bg-card/40 backdrop-blur-md border-white/5">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-violet-400" /> Daily Study Hours — Last 7 Days
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="h-65 w-full">
                    <ChartErrorBoundary>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={trendWithAvg} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                          <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} unit="h" />
                          <Tooltip formatter={(v: any) => [`${v}h`, "Hours"]} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                          <Bar dataKey="hours" fill="hsl(var(--violet-500))" radius={[4, 4, 0, 0]} maxBarSize={48} />
                          <Line type="monotone" dataKey="avg" stroke="hsl(var(--cyan-500))" strokeWidth={2} strokeDasharray="4 4" dot={false} />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartErrorBoundary>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="bg-card/30 backdrop-blur-xl border-white/10 h-full flex flex-col">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <BookOpen className="w-4 h-4 text-blue-400" /> Subject Breakdown
                  </CardTitle>
                </CardHeader>
                <CardContent className="flex-1">
                  {studyStats?.subjectDistribution && studyStats.subjectDistribution.length > 0 ? (
                    <div className="space-y-3">
                      {studyStats.subjectDistribution.map((s, i) => {
                        const pct = totalSubjectMinutes > 0 ? Math.round((s.minutes / totalSubjectMinutes) * 100) : 0;
                        return (
                          <div key={i}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="font-medium truncate max-w-[55%]">{s.name}</span>
                              <span className="text-muted-foreground shrink-0">{Math.round(s.minutes / 60)}h ({pct}%)</span>
                            </div>
                            <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                              <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="flex flex-col items-center justify-center gap-2 text-muted-foreground h-32">
                      <BookOpen className="w-8 h-8 opacity-40" />
                      <p className="text-sm">Log study sessions with subjects to see breakdown</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          {/* Study summary stats */}
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Study Hours", value: `${Math.floor(overview.totalStudyMinutes / 60)}h ${overview.totalStudyMinutes % 60}m`, color: "text-violet-400" },
              { label: "This Week Avg/Day", value: `${weekAvg}h`, color: "text-blue-400" },
              { label: "Current Streak", value: `${summary.streakDays} days`, color: "text-orange-400" },
              { label: "Active Days (7d)", value: `${activeDays} / 7`, color: "text-emerald-400" },
            ].map((stat, i) => (
              <motion.div key={i} variants={itemVariants}>
                <Card className="bg-card/30 border-white/10 p-4">
                  <p className="text-xs text-muted-foreground mb-1">{stat.label}</p>
                  <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        </TabsContent>

        {/* ─── EXAMS TAB ─── */}
        <TabsContent value="exams" className="space-y-6 m-0">
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div variants={itemVariants}>
              <Card className="bg-card/30 backdrop-blur-xl border-white/10 h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-rose-400" /> Score Progression
                  </CardTitle>
                  <CardDescription>Normalised score % across your last 10 exams</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-70">
                    {trend && trend.length > 0 ? (
                      <ChartErrorBoundary>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={trend} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} dy={10} />
                            <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                            <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                            <Line type="monotone" dataKey="score" name="Score %" stroke="hsl(var(--rose-500))" strokeWidth={3} dot={{ r: 4, fill: 'hsl(var(--rose-500))', stroke: 'hsl(var(--background))', strokeWidth: 2 }} animationDuration={1500} />
                            <Line type="monotone" dataKey="percentile" name="Percentile" stroke="hsl(var(--amber-500))" strokeWidth={2} strokeDasharray="4 4" dot={false} animationDuration={1500} />
                          </LineChart>
                        </ResponsiveContainer>
                      </ChartErrorBoundary>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground border border-dashed rounded-lg">
                        <FileCheck className="w-8 h-8 opacity-40" />
                        <p className="text-sm">No exam data yet — take your first mock!</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="bg-card/30 backdrop-blur-xl border-white/10 h-full">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <BarChart className="w-4 h-4 text-emerald-400" /> Topic Accuracy
                  </CardTitle>
                  <CardDescription>Accuracy % per topic (min 3 questions attempted)</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-70">
                    {topTopics.length > 0 ? (
                      <ChartErrorBoundary>
                        <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={topTopics} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                            <XAxis type="number" domain={[0, 100]} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} unit="%" />
                            <YAxis type="category" dataKey="topic" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: 'hsl(var(--muted-foreground))' }} width={100} />
                            <Tooltip formatter={(v: any) => [`${v}%`, "Accuracy"]} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                            <Bar dataKey="accuracy" radius={[0, 4, 4, 0]} maxBarSize={20}
                              fill="hsl(var(--emerald-500))"
                              label={{ position: "right", fontSize: 10, fill: "hsl(var(--muted-foreground))", formatter: (v: number) => `${v}%` }}
                            />
                          </BarChart>
                        </ResponsiveContainer>
                      </ChartErrorBoundary>
                    ) : (
                      <div className="h-full flex flex-col items-center justify-center gap-2 text-muted-foreground border border-dashed rounded-lg">
                        <Brain className="w-8 h-8 opacity-40" />
                        <p className="text-sm">Attempt exams to see topic accuracy</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          {/* Exam history list */}
          <motion.div variants={itemVariants}>
            <Card className="bg-card/30 backdrop-blur-xl border-white/10">
              <CardHeader className="pb-2">
                <CardTitle className="text-base font-semibold flex items-center gap-2">
                  <FileCheck className="w-4 h-4 text-blue-400" /> Exam History
                </CardTitle>
                <CardDescription>All submitted attempts — click to review any result</CardDescription>
              </CardHeader>
              <CardContent>
                <ExamHistorySection />
              </CardContent>
            </Card>
          </motion.div>

          {/* Time per Topic */}
          {topicTime.length > 0 && (
            <motion.div variants={itemVariants}>
              <Card className="bg-card/30 backdrop-blur-xl border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Clock className="w-4 h-4 text-violet-400" /> Time per Topic
                  </CardTitle>
                  <CardDescription>Avg seconds spent per question — slow + inaccurate needs the most work</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2.5">
                    {topicTime.map((t) => {
                      const fmtTime = t.avgSeconds >= 60
                        ? `${Math.floor(t.avgSeconds / 60)}m ${t.avgSeconds % 60}s`
                        : `${t.avgSeconds}s`;
                      const isSlowAndWeak = t.avgSeconds > 90 && t.accuracy < 60;
                      const isFastAndStrong = t.avgSeconds < 45 && t.accuracy >= 70;
                      return (
                        <div key={t.topic} className="flex items-center gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-xs font-medium text-foreground truncate">{t.topic}</span>
                              <div className="flex items-center gap-2 shrink-0 ml-2">
                                {isSlowAndWeak && <span className="text-xs text-rose-400 font-semibold">needs work</span>}
                                {isFastAndStrong && <span className="text-xs text-emerald-400 font-semibold">mastered</span>}
                                <span className="text-xs text-muted-foreground">{t.accuracy}% acc</span>
                                <span className="text-xs font-semibold text-violet-400 w-12 text-right">{fmtTime}</span>
                              </div>
                            </div>
                            <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                              <div
                                className={`h-full rounded-full transition-all ${isSlowAndWeak ? "bg-rose-500" : isFastAndStrong ? "bg-emerald-500" : "bg-violet-500"}`}
                                style={{ width: `${Math.min(100, (t.avgSeconds / 180) * 100)}%` }}
                              />
                            </div>
                          </div>
                          <span className="text-xs text-muted-foreground shrink-0">{t.attempts}q</span>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Strong / Weak topic lists */}
          {(topTopicsByAccuracy.length > 0 || weakestTopics.length > 0) && (
            <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <motion.div variants={itemVariants}>
                <Card className="bg-emerald-500/5 border-emerald-500/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold text-emerald-400 flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4" /> Strong Topics
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {topTopicsByAccuracy.map((t, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <span className="truncate max-w-[65%]">{t.topic}</span>
                        <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 shrink-0">{t.accuracy}%</Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div variants={itemVariants}>
                <Card className="bg-rose-500/5 border-rose-500/20">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base font-semibold text-rose-400 flex items-center gap-2">
                      <XCircle className="w-4 h-4" /> Needs Work
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {weakestTopics.length > 0 ? weakestTopics.map((t, i) => (
                      <div key={i} className="flex items-center justify-between text-sm gap-2">
                        <span className="truncate max-w-[55%]">{t.topic}</span>
                        <div className="flex items-center gap-2 shrink-0">
                          <Badge variant="outline" className="border-rose-500/30 text-rose-400">{t.accuracy}%</Badge>
                          <Link href={`/practice?topic=${encodeURIComponent(t.topic)}`}>
                            <span className="text-[10px] font-semibold text-primary hover:underline cursor-pointer">Practice →</span>
                          </Link>
                        </div>
                      </div>
                    )) : (
                      <p className="text-sm text-muted-foreground">Attempt at least 3 questions per topic to identify weak areas.</p>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </motion.div>
          )}
        </TabsContent>

        {/* ─── COMPARE TAB ─── */}
        <TabsContent value="compare" className="space-y-6 m-0">
          <motion.div variants={containerVariants} initial="hidden" animate="show" className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <motion.div variants={itemVariants}>
              <Card className="bg-card/40 backdrop-blur-md border-white/5">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Users className="w-4 h-4 text-amber-400" /> You vs Platform
                  </CardTitle>
                  <CardDescription>
                    {peerStats ? `Based on ${peerStats.totalUsersStudied} active students this week` : "Loading platform data..."}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-6">
                    {peerComparisonData.map((comp, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-2 text-sm">
                          <span className="font-medium">{comp.metric}</span>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span>You: <strong className="text-foreground">{comp.you}</strong></span>
                            <span>Avg: <strong className="text-muted-foreground">{comp.peer}</strong></span>
                            <span>Top 10%: <strong className="text-amber-400">{comp.top10}</strong></span>
                          </div>
                        </div>
                        <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                          <div className="absolute inset-y-0 left-0 bg-violet-500 rounded-full transition-all"
                            style={{ width: `${Math.min(100, comp.top10 > 0 ? (comp.you / comp.top10) * 100 : 0)}%` }} />
                          {comp.peer > 0 && comp.top10 > 0 && (
                            <div className="absolute inset-y-0 w-0.5 bg-amber-400/60"
                              style={{ left: `${Math.min(100, (comp.peer / comp.top10) * 100)}%` }} />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div variants={itemVariants}>
              <Card className="bg-card/40 backdrop-blur-md border-white/5">
                <CardHeader>
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-amber-400" /> Your Ranking
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="text-center py-4">
                    <div className="text-6xl font-extrabold text-amber-400">#{overview.rank}</div>
                    <p className="text-muted-foreground mt-1 text-sm">Global rank by XP</p>
                    <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-sm font-semibold">
                      <Star className="w-3.5 h-3.5" /> {overview.percentile}th percentile
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-background/50 p-3 rounded-lg border border-white/5 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Avg Score</p>
                      <p className="text-xl font-bold text-foreground">{overview.averageScore}%</p>
                    </div>
                    <div className="bg-background/50 p-3 rounded-lg border border-white/5 text-center">
                      <p className="text-xs text-muted-foreground mb-1">Total Mocks</p>
                      <p className="text-xl font-bold text-foreground">{overview.totalAttempts}</p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </motion.div>

          {/* Peer comparison bar chart */}
          {peerStats && (
            <motion.div variants={itemVariants}>
              <Card className="bg-card/30 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <BarChart className="w-4 h-4 text-violet-400" /> Study Hours Comparison
                  </CardTitle>
                  <CardDescription>Weekly hours: you vs platform average vs top 10%</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="h-45">
                    <ChartErrorBoundary>
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart
                          data={[
                            { name: "You",       hours: yourWeeklyHours },
                            { name: "Platform\nAvg", hours: peerStats.platformAvgWeeklyHours },
                            { name: "Top 10%",   hours: peerStats.topDecileWeeklyHours },
                          ]}
                          margin={{ top: 5, right: 20, left: -20, bottom: 0 }}
                        >
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" strokeOpacity={0.4} />
                          <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                          <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} unit="h" />
                          <Tooltip formatter={(v: any) => [`${v}h`, "Hours/week"]} contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '8px', border: '1px solid hsl(var(--border))' }} />
                          <Bar dataKey="hours" radius={[4, 4, 0, 0]} maxBarSize={60}
                            fill="hsl(var(--violet-500))"
                            label={{ position: "top", fontSize: 11, fill: "hsl(var(--muted-foreground))", formatter: (v: number) => `${v}h` }}
                          />
                        </BarChart>
                      </ResponsiveContainer>
                    </ChartErrorBoundary>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </TabsContent>

        {/* ─── AI INSIGHTS TAB ─── */}
        <TabsContent value="ai-insights" className="space-y-6 m-0">
          <Card className="bg-linear-to-r from-violet-600/10 to-cyan-600/10 border-violet-500/20 backdrop-blur-xl shadow-xl">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-semibold flex items-center gap-2 text-violet-300">
                <Sparkles className="w-5 h-5 text-cyan-400" /> Personalized Insights
              </CardTitle>
              <CardDescription>Rule-based analysis of your real performance data</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {aiInsights.map((insight, i) => {
                  const Icon = insight.type === "success" ? CheckCircle2
                    : insight.type === "warning" ? AlertTriangle
                    : insight.type === "action" ? Target
                    : Info;
                  const color = insight.type === "success"
                    ? "text-emerald-400 bg-emerald-400/10 border-emerald-400/20"
                    : insight.type === "warning"
                    ? "text-rose-400 bg-rose-400/10 border-rose-400/20"
                    : insight.type === "action"
                    ? "text-amber-400 bg-amber-400/10 border-amber-400/20"
                    : "text-blue-400 bg-blue-400/10 border-blue-400/20";
                  return (
                    <motion.div key={i} whileHover={{ scale: 1.02 }} className={`flex items-start gap-3 p-3.5 rounded-xl border ${color} shadow-sm`}>
                      <Icon className="w-5 h-5 shrink-0 mt-0.5" />
                      <p className="text-sm leading-relaxed text-foreground/90">{insight.text}</p>
                    </motion.div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Topic deep-dive */}
          {(topTopicsByAccuracy.length > 0 || weakestTopics.length > 0) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card className="bg-card/30 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-emerald-400 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4" /> Your Strongest Topics
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {topTopicsByAccuracy.map((t, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                      <span className="flex-1 truncate">{t.topic}</span>
                      <div className="w-20 shrink-0">
                        <Progress value={t.accuracy} className="h-1.5 [&>div]:bg-emerald-500" />
                      </div>
                      <span className="text-emerald-400 font-semibold w-10 text-right shrink-0">{t.accuracy}%</span>
                    </div>
                  ))}
                </CardContent>
              </Card>

              <Card className="bg-card/30 border-white/10">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-semibold text-rose-400 flex items-center gap-2">
                    <XCircle className="w-4 h-4" /> Focus These Topics Next
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  {weakestTopics.length > 0 ? weakestTopics.map((t, i) => (
                    <div key={i} className="flex items-center gap-3 text-sm">
                      <span className="text-xs font-bold text-muted-foreground w-4 shrink-0">{i + 1}.</span>
                      <span className="flex-1 truncate">{t.topic}</span>
                      <div className="w-16 shrink-0">
                        <Progress value={t.accuracy} className="h-1.5 [&>div]:bg-rose-500" />
                      </div>
                      <span className="text-rose-400 font-semibold w-8 text-right shrink-0">{t.accuracy}%</span>
                      <Link href={`/practice?topic=${encodeURIComponent(t.topic)}`}>
                        <span className="text-[10px] font-semibold text-primary hover:underline cursor-pointer shrink-0">Drill →</span>
                      </Link>
                    </div>
                  )) : (
                    <p className="text-sm text-muted-foreground">Attempt ≥3 questions per topic to identify weak areas.</p>
                  )}
                </CardContent>
              </Card>
            </div>
          )}
        </TabsContent>

      </Tabs>
    </div>

    {drillTopic && (
      <WeakTopicDrill
        open={!!drillTopic}
        onClose={() => setDrillTopic(null)}
        topic={drillTopic}
      />
    )}
    </>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="space-y-8 max-w-350 mx-auto pb-12">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-10 w-80 rounded-lg" />
          <Skeleton className="h-5 w-60 rounded-lg" />
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-25 rounded-xl" />)}
      </div>
      <Skeleton className="h-12 w-125 rounded-xl" />
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Skeleton className="h-75 rounded-xl" />
        <Skeleton className="h-75 lg:col-span-2 rounded-xl" />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-87.5 rounded-xl" />
        <Skeleton className="h-87.5 rounded-xl" />
      </div>
    </div>
  );
}
