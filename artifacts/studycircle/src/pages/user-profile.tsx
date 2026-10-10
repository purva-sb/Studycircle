import { useState } from "react";
import { useRoute, Link } from "wouter";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useUser } from "@clerk/clerk-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { z } from "zod";
import { format } from "date-fns";
import {
  UserCircle2, Flame, Zap, Trophy, Target, BookOpen,
  CheckCircle2, XCircle, ArrowLeft, Users,
} from "lucide-react";

const ProfileSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  handle: z.string(),
  avatarUrl: z.string().nullable(),
  plan: z.string(),
  xp: z.number(),
  level: z.number(),
  streakDays: z.number(),
  examFocus: z.string(),
  followerCount: z.number(),
  followingCount: z.number(),
  isFollowing: z.boolean(),
  examsAttempted: z.number(),
  avgAccuracyPct: z.number(),
  strongTopics: z.array(z.string()),
  weakTopics: z.array(z.string()),
  recentExams: z.array(z.object({
    examId: z.string(),
    examTitle: z.string(),
    score: z.number(),
    totalMarks: z.number(),
    submittedAt: z.coerce.date().nullable(),
  })),
});
type Profile = z.infer<typeof ProfileSchema>;

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string | number }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 text-center">
      <div className="flex justify-center mb-1.5 text-gray-400">{icon}</div>
      <p className="text-2xl font-black text-gray-900">{value}</p>
      <p className="text-xs text-gray-500 mt-0.5">{label}</p>
    </div>
  );
}

export default function UserProfile() {
  const [, params] = useRoute("/users/:id");
  const userId = params?.id || "";
  const { user: me } = useUser();
  const qc = useQueryClient();
  const [followPending, setFollowPending] = useState(false);

  const { data: profile, isLoading, error } = useQuery<Profile>({
    queryKey: ["user-profile", userId],
    queryFn: () => customFetch(`/api/users/${userId}/profile`),
    enabled: !!userId,
    staleTime: 30_000,
  });

  const followMutation = useMutation({
    mutationFn: (isNowFollowing: boolean) =>
      customFetch(`/api/users/${userId}/follow`, { method: isNowFollowing ? "POST" : "DELETE" }),
    onMutate: (isNowFollowing) => {
      setFollowPending(true);
      qc.setQueryData<Profile>(["user-profile", userId], (old) =>
        old ? {
          ...old,
          isFollowing: isNowFollowing,
          followerCount: old.followerCount + (isNowFollowing ? 1 : -1),
        } : old
      );
    },
    onSettled: () => {
      setFollowPending(false);
      qc.invalidateQueries({ queryKey: ["user-profile", userId] });
    },
  });

  const isOwnProfile = me?.id === userId;

  if (isLoading) {
    return (
      <div className="max-w-2xl mx-auto p-6 space-y-5">
        <Skeleton className="h-32 w-full rounded-2xl" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
        <Skeleton className="h-48 w-full rounded-xl" />
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="max-w-xl mx-auto p-8 text-center space-y-4">
        <UserCircle2 className="w-12 h-12 text-gray-200 mx-auto" />
        <p className="text-gray-500 font-medium">User not found.</p>
        <Button variant="outline" onClick={() => history.back()}>Go Back</Button>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-10">

      {/* Back */}
      <button onClick={() => history.back()}
        className="flex items-center gap-1.5 text-sm text-gray-400 hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {/* Hero card */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div style={{ background: "linear-gradient(135deg,#212c5e 0%,#3b5fe3 100%)" }} className="h-20" />
        <div className="px-6 pb-6 -mt-10">
          <div className="flex items-end justify-between gap-4">
            <img
              src={profile.avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(profile.displayName)}&background=3b5fe3&color=fff&size=80`}
              alt={profile.displayName}
              className="w-20 h-20 rounded-full border-4 border-white object-cover shadow"
            />
            {!isOwnProfile && me && (
              <Button
                size="sm"
                variant={profile.isFollowing ? "outline" : "default"}
                disabled={followPending}
                onClick={() => followMutation.mutate(!profile.isFollowing)}
                className="mb-1"
              >
                {profile.isFollowing ? "Unfollow" : "Follow"}
              </Button>
            )}
          </div>

          <div className="mt-3">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-extrabold text-gray-900">{profile.displayName}</h1>
              {profile.plan === "pro" && (
                <span className="text-[10px] font-bold bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-wide">Pro</span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">@{profile.handle} · {profile.examFocus}</p>
            <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
              <span><strong className="text-gray-800">{profile.followerCount}</strong> followers</span>
              <span><strong className="text-gray-800">{profile.followingCount}</strong> following</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <StatCard icon={<Zap className="w-5 h-5" />}     label="XP"             value={profile.xp.toLocaleString()} />
        <StatCard icon={<Trophy className="w-5 h-5" />}  label="Exams Taken"    value={profile.examsAttempted} />
        <StatCard icon={<Target className="w-5 h-5" />}  label="Avg Accuracy"   value={`${profile.avgAccuracyPct}%`} />
        <StatCard icon={<Flame className="w-5 h-5" />}   label="Day Streak"     value={profile.streakDays} />
      </div>

      {/* Topic performance */}
      {(profile.strongTopics.length > 0 || profile.weakTopics.length > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {profile.strongTopics.length > 0 && (
            <div className="bg-white rounded-xl border border-green-100 shadow-sm p-5">
              <h3 className="text-sm font-bold text-green-700 flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4" /> Strong Topics
              </h3>
              <div className="space-y-1.5">
                {profile.strongTopics.map(t => (
                  <div key={t} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-green-500 shrink-0" />
                    {t}
                  </div>
                ))}
              </div>
            </div>
          )}
          {profile.weakTopics.length > 0 && (
            <div className="bg-white rounded-xl border border-red-100 shadow-sm p-5">
              <h3 className="text-sm font-bold text-red-600 flex items-center gap-2 mb-3">
                <XCircle className="w-4 h-4" /> Needs Work
              </h3>
              <div className="space-y-1.5">
                {profile.weakTopics.map(t => (
                  <div key={t} className="flex items-center gap-2 text-sm text-gray-700">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 shrink-0" />
                    {t}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recent exams */}
      {profile.recentExams.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-gray-400" />
            <h3 className="font-bold text-gray-800">Recent Exams</h3>
          </div>
          <div className="divide-y divide-gray-50">
            {profile.recentExams.map((e) => {
              const pct = e.totalMarks > 0 ? Math.round((e.score / e.totalMarks) * 100) : 0;
              return (
                <Link key={e.examId} href={`/exams/${e.examId}`}>
                  <a className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50 transition-colors">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 truncate">{e.examTitle}</p>
                      {e.submittedAt && (
                        <p className="text-xs text-gray-400 mt-0.5">{format(new Date(e.submittedAt), "dd MMM yyyy")}</p>
                      )}
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-black text-gray-900">{e.score}<span className="text-gray-400 font-normal text-xs">/{e.totalMarks}</span></p>
                      <p className="text-xs font-semibold mt-0.5"
                        style={{ color: pct >= 70 ? "#16a34a" : pct >= 40 ? "#d97706" : "#dc2626" }}>
                        {pct}%
                      </p>
                    </div>
                  </a>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {profile.examsAttempted === 0 && (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
          <Users className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No exams attempted yet.</p>
        </div>
      )}
    </div>
  );
}
