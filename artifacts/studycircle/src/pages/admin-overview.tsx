import { useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Users, FileText, BarChart2, TrendingUp, Calendar, Clock } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

type Stats = {
  totalStudents: number;
  attemptsToday: number;
  totalAttempts: number;
  recentStudents: { id: string; displayName: string; avatarUrl: string; createdAt: string }[];
  upcomingLive: { id: string; title: string; scheduledAt: string | null; exam: string }[];
};

function StatCard({ icon: Icon, label, value, sub, color }: {
  icon: any; label: string; value: number | string; sub?: string; color: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-5 flex items-start gap-4">
      <div className={`p-2.5 rounded-lg ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm font-medium">{label}</p>
        {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

export default function AdminOverview() {
  const { data: stats, isLoading } = useQuery<Stats>({
    queryKey: ["admin-stats"],
    queryFn: () => customFetch("/api/admin/stats"),
    refetchInterval: 30_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Overview</h1>
        <div className="grid grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Overview</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {format(new Date(), "EEEE, MMMM d yyyy")}
        </p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard icon={Users} label="Total Students" value={stats?.totalStudents ?? 0}
          color="bg-blue-500/10 text-blue-400" />
        <StatCard icon={Clock} label="Attempts Today" value={stats?.attemptsToday ?? 0}
          sub="tests started today" color="bg-violet-500/10 text-violet-400" />
        <StatCard icon={BarChart2} label="Total Submissions" value={stats?.totalAttempts ?? 0}
          sub="all time" color="bg-green-500/10 text-green-400" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent signups */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold">Recent Signups</h2>
          </div>
          {stats?.recentStudents.length === 0 && (
            <p className="text-sm text-muted-foreground">No students yet.</p>
          )}
          <div className="space-y-3">
            {stats?.recentStudents.map(s => (
              <div key={s.id} className="flex items-center gap-3">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={s.avatarUrl} />
                  <AvatarFallback className="text-xs">
                    {s.displayName?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{s.displayName}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(s.createdAt), "MMM d, h:mm a")}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Upcoming live tests */}
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold">Upcoming Live Tests</h2>
          </div>
          {stats?.upcomingLive.length === 0 && (
            <p className="text-sm text-muted-foreground">No live tests scheduled.</p>
          )}
          <div className="space-y-3">
            {stats?.upcomingLive.map(exam => (
              <div key={exam.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{exam.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {exam.scheduledAt
                      ? format(new Date(exam.scheduledAt), "MMM d, yyyy · h:mm a")
                      : "Not scheduled"}
                  </p>
                </div>
                <Badge variant="outline" className="text-xs shrink-0">{exam.exam}</Badge>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
