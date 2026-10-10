import { useState } from "react";
import { useLocation } from "wouter";
import { useUser, useClerk } from "@clerk/clerk-react";
import { useGetMe, customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { profileQueryOptions } from "@/lib/query-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { getTierAvatarRing } from "@/components/ui/user-tier-badge";
import { LogOut, Radio, MessageSquare, Zap, Flame, Crown, User as UserIcon, Palette, Target } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { resolveAvatarUrl } from "@/lib/avatars";

const GOAL_PRESETS = [
  { mins: 30,  label: "30m" },
  { mins: 60,  label: "1h"  },
  { mins: 120, label: "2h"  },
  { mins: 180, label: "3h"  },
  { mins: 240, label: "4h"  },
  { mins: 360, label: "6h"  },
  { mins: 480, label: "8h"  },
];

export function UserNav({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const { data: me } = useGetMe({ query: profileQueryOptions });
  const queryClient = useQueryClient();
  const [savingGoal, setSavingGoal] = useState<number | null>(null);

  const displayName = user?.fullName || user?.primaryEmailAddress?.emailAddress?.split("@")[0] || me?.displayName || "You";
  const avatarUrl = resolveAvatarUrl(me?.activeAvatarId, user?.imageUrl || me?.avatarUrl);
  const minutes = me?.todayMinutes || 0;
  const currentGoal = me?.dailyTargetMinutes ?? 120;

  const handleGoalSelect = async (mins: number) => {
    if (savingGoal !== null) return;
    setSavingGoal(mins);
    try {
      await customFetch("/api/users/profile/customize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dailyTargetMinutes: mins }),
      });
      queryClient.invalidateQueries({ queryKey: ["me"] });
      toast.success(`Daily goal set to ${mins >= 60 ? `${mins / 60}h` : `${mins}m`}!`);
    } catch {
      toast.error("Failed to save goal.");
    } finally {
      setSavingGoal(null);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {children}
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="end"
        className="w-72 p-0 rounded-2xl border border-white/10 bg-[#09090b]/95 backdrop-blur-xl shadow-2xl z-[100] overflow-y-auto max-h-[calc(100dvh-64px)]"
      >
        {/* Banner area */}
        <div className="h-16 bg-gradient-to-r from-indigo-600/20 to-violet-600/20 w-full relative border-b border-white/5">
          {me?.plan === "pro" && (
            <div className="absolute top-2 right-2 bg-yellow-500/20 text-yellow-400 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 border border-yellow-500/30">
              <Crown className="w-3 h-3" /> PRO
            </div>
          )}
        </div>

        {/* Profile Info */}
        <div className="px-4 pb-3 -mt-8 relative z-10 flex flex-col items-center">
          <div className={`relative p-1 rounded-full bg-[#09090b] ${getTierAvatarRing(minutes)}`}>
            <Avatar className="h-16 w-16 border-2 border-[#09090b]">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="bg-zinc-800 text-zinc-300 text-xl font-bold">
                {displayName?.substring(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          </div>

          <h2 className="mt-2 text-base font-bold text-white truncate max-w-full">{displayName}</h2>
          <p className="text-xs text-zinc-500 truncate max-w-full mb-3">{user?.primaryEmailAddress?.emailAddress}</p>

          {/* User Stats */}
          <div className="flex items-center gap-3 bg-white/5 border border-white/10 rounded-xl p-2 w-full">
            <div className="flex-1 flex flex-col items-center justify-center border-r border-white/10">
              <div className="flex items-center gap-1 text-indigo-400">
                <Zap className="w-3.5 h-3.5" />
                <span className="font-bold text-sm">{me?.xp || 0}</span>
              </div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mt-0.5">XP</span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center">
              <div className="flex items-center gap-1 text-orange-400">
                <Flame className="w-3.5 h-3.5" />
                <span className="font-bold text-sm">{me?.streakDays || 0}</span>
              </div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold mt-0.5">Streak</span>
            </div>
          </div>
        </div>

        {/* Daily Goal selector */}
        <div className="px-4 pb-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Target className="w-3 h-3 text-zinc-500" />
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">Daily Goal</span>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {GOAL_PRESETS.map(({ mins, label }) => (
              <button
                key={mins}
                onClick={() => handleGoalSelect(mins)}
                disabled={savingGoal !== null}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all border",
                  currentGoal === mins
                    ? "bg-indigo-600 border-indigo-500 text-white shadow-sm shadow-indigo-500/30"
                    : "bg-white/5 border-white/10 text-zinc-400 hover:bg-white/10 hover:text-white",
                  savingGoal === mins && "opacity-60"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <DropdownMenuSeparator className="bg-white/5" />

        {/* Menu Items */}
        <div className="p-2 space-y-1">
          <DropdownMenuItem
            onClick={() => window.dispatchEvent(new CustomEvent("open-customization-store"))}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-zinc-300 hover:text-white hover:bg-white/5 cursor-pointer transition-colors outline-none focus:bg-white/5 focus:text-white"
          >
            <Palette className="w-4 h-4 text-fuchsia-400" />
            <div className="flex-1">
              <p className="text-sm font-medium">Change Avatar & Aura</p>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => setLocation("/settings")}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-zinc-300 hover:text-white hover:bg-white/5 cursor-pointer transition-colors outline-none focus:bg-white/5 focus:text-white"
          >
            <UserIcon className="w-4 h-4 text-indigo-400" />
            <div className="flex-1">
              <p className="text-sm font-medium">My Profile & Settings</p>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => setLocation("/focus-rooms")}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-zinc-300 hover:text-white hover:bg-white/5 cursor-pointer transition-colors outline-none focus:bg-white/5 focus:text-white"
          >
            <Radio className="w-4 h-4 text-emerald-400" />
            <div className="flex-1">
              <p className="text-sm font-medium">Focus Rooms</p>
            </div>
          </DropdownMenuItem>

          <DropdownMenuItem
            onClick={() => setLocation("/dms")}
            className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-zinc-300 hover:text-white hover:bg-white/5 cursor-pointer transition-colors outline-none focus:bg-white/5 focus:text-white"
          >
            <MessageSquare className="w-4 h-4 text-blue-400" />
            <div className="flex-1">
              <p className="text-sm font-medium">Messages</p>
            </div>
          </DropdownMenuItem>
        </div>

        <DropdownMenuSeparator className="bg-white/5" />

        <div className="p-2">
          <DropdownMenuItem
            onClick={() => signOut()}
            className="flex items-center gap-3 rounded-xl px-3 py-2 text-red-400 hover:text-red-300 hover:bg-red-500/10 cursor-pointer transition-colors outline-none focus:bg-red-500/10 focus:text-red-300"
          >
            <LogOut className="w-4 h-4" />
            <span className="text-sm font-medium">Log out</span>
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
