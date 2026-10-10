import { useListAchievements } from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import { Trophy, Lock, Medal, Flame, Target, Star, Zap } from "lucide-react";
import { format } from "date-fns";

export default function Achievements() {
  const { data: achievements, isLoading } = useListAchievements();

  if (isLoading || !achievements) {
    return (
      <div className="space-y-6 max-w-5xl mx-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const earnedCount = achievements.filter(a => !a.locked).length;

  return (
    <div className="space-y-8 max-w-5xl mx-auto">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 bg-card p-8 rounded-2xl border shadow-sm">
        <div>
          <h2 className="text-3xl font-bold tracking-tight flex items-center gap-3">
            <Trophy className="h-8 w-8 text-primary" /> 
            Hall of Fame
          </h2>
          <p className="text-muted-foreground mt-2 max-w-lg">Complete challenges, maintain streaks, and push your limits to unlock these exclusive badges.</p>
        </div>
        <div className="flex flex-col items-center justify-center bg-primary/10 border border-primary/20 rounded-xl p-6 min-w-[200px]">
          <span className="text-4xl font-extrabold text-primary">{earnedCount}<span className="text-xl text-muted-foreground font-medium">/{achievements.length}</span></span>
          <span className="text-sm font-semibold uppercase tracking-wider mt-1 text-primary/80">Badges Earned</span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {achievements.map((achievement) => (
          <Card 
            key={achievement.id} 
            className={`overflow-hidden transition-all duration-300 ${achievement.locked ? 'bg-muted/30 border-dashed opacity-75' : 'hover-elevate shadow-md border-primary/20 bg-gradient-to-br from-card to-primary/5'}`}
          >
            <CardContent className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${achievement.locked ? 'bg-muted text-muted-foreground' : 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'}`}>
                  {achievement.icon === 'flame' && <Flame className="w-7 h-7" />}
                  {achievement.icon === 'target' && <Target className="w-7 h-7" />}
                  {achievement.icon === 'star' && <Star className="w-7 h-7" />}
                  {achievement.icon === 'zap' && <Zap className="w-7 h-7" />}
                  {achievement.icon === 'medal' && <Medal className="w-7 h-7" />}
                  {achievement.icon === 'trophy' && <Trophy className="w-7 h-7" />}
                  {!['flame', 'target', 'star', 'zap', 'medal', 'trophy'].includes(achievement.icon) && <Trophy className="w-7 h-7" />}
                </div>
                {achievement.locked ? (
                  <Lock className="w-5 h-5 text-muted-foreground/50" />
                ) : (
                  <div className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary/10 px-2 py-1 rounded-full">
                    {format(new Date(achievement.earnedAt!), 'MMM yyyy')}
                  </div>
                )}
              </div>
              
              <h3 className={`text-xl font-bold mb-2 ${achievement.locked ? 'text-muted-foreground' : ''}`}>
                {achievement.name}
              </h3>
              <p className="text-sm text-muted-foreground mb-6 line-clamp-2">
                {achievement.description}
              </p>
              
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-medium text-muted-foreground">
                  <span>Progress</span>
                  <span>{achievement.progress} / {achievement.target}</span>
                </div>
                <Progress 
                  value={(achievement.progress / achievement.target) * 100} 
                  className={`h-2 ${achievement.locked ? '' : '[&>div]:bg-primary'}`} 
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
