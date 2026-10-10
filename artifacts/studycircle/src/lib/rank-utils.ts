import {
  Flame, Zap, Swords, Crown, Trophy,
  Shield, Award, Star, Gem, Sparkles,
  type LucideIcon,
} from "lucide-react";

// ── DAILY / FOCUS ROOM AURA TIERS ─────────────────────────────────────────
export type DailyTier = "Glow" | "Surge" | "Blaze" | "Phantom" | "Legend";

export interface TierInfo {
  name: DailyTier;
  minHours: number;
  color: string;
  borderColor: string;
  Icon: LucideIcon;
}

export const DAILY_TIERS: TierInfo[] = [
  { name: "Glow",    minHours: 1,  color: "text-emerald-400", borderColor: "border-emerald-500/30", Icon: Sparkles },
  { name: "Surge",   minHours: 3,  color: "text-yellow-400",  borderColor: "border-yellow-500/30",  Icon: Zap      },
  { name: "Blaze",   minHours: 5,  color: "text-orange-500",  borderColor: "border-orange-500/30",  Icon: Flame    },
  { name: "Phantom", minHours: 8,  color: "text-fuchsia-400", borderColor: "border-fuchsia-500/30", Icon: Crown    },
  { name: "Legend",  minHours: 12, color: "text-yellow-500",  borderColor: "border-yellow-500/30",  Icon: Trophy   },
];

export function getDailyTier(minutes: number): TierInfo | null {
  const hours = minutes / 60;
  let tier: TierInfo | null = null;
  for (const t of DAILY_TIERS) {
    if (hours >= t.minHours) tier = t;
  }
  return tier;
}

// ── WEEKLY ANIME RANKS (Naruto themed, Hybrid) ────────────────────────────
export type WeeklyRank = "Genin" | "Chunin" | "Jonin" | "Kage" | "Hokage";

export interface WeeklyRankInfo {
  name: WeeklyRank;
  minHours: number;
  minPercentile: number;
  color: string;
  bg: string;
  border: string;
  Icon: LucideIcon;
  next?: string;
}

export const WEEKLY_RANKS: WeeklyRankInfo[] = [
  { name: "Genin",  minHours: 0,  minPercentile: 0,    color: "text-slate-400",   bg: "bg-slate-500/10",   border: "border-slate-500/30",   Icon: Shield  },
  { name: "Chunin", minHours: 10, minPercentile: 0.40, color: "text-green-400",   bg: "bg-green-500/10",   border: "border-green-500/30",   Icon: Zap     },
  { name: "Jonin",  minHours: 20, minPercentile: 0.80, color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30",    Icon: Swords  },
  { name: "Kage",   minHours: 30, minPercentile: 0.95, color: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/30",  Icon: Crown   },
  { name: "Hokage", minHours: 40, minPercentile: 0.99, color: "text-amber-400",   bg: "bg-amber-500/10",   border: "border-amber-500/30",   Icon: Trophy  },
];

export function getWeeklyRank(weeklyMinutes: number, rank: number, total: number): WeeklyRankInfo {
  const hours = weeklyMinutes / 60;
  const percentile = total > 1 ? (total - rank) / total : 0;
  let result = WEEKLY_RANKS[0];
  for (const r of WEEKLY_RANKS) {
    if (hours >= r.minHours && percentile >= r.minPercentile) result = r;
  }
  return result;
}

export function getWeeklyNextThreshold(current: WeeklyRankInfo): string {
  const idx = WEEKLY_RANKS.findIndex(r => r.name === current.name);
  const next = WEEKLY_RANKS[idx + 1];
  if (!next) return "Max rank reached!";
  return `${next.minHours}h/week + top ${Math.round((1 - next.minPercentile) * 100)}%`;
}

// ── MONTHLY BGMI RANKS (Hybrid) ───────────────────────────────────────────
export type MonthlyRank =
  | "Bronze" | "Silver" | "Gold" | "Platinum"
  | "Diamond" | "Master" | "Ace" | "Conqueror";

export interface MonthlyRankInfo {
  name: MonthlyRank;
  minHours: number;
  minPercentile: number;
  color: string;
  bg: string;
  border: string;
  Icon: LucideIcon;
}

export const MONTHLY_RANKS: MonthlyRankInfo[] = [
  { name: "Bronze",    minHours: 0,   minPercentile: 0,    color: "text-amber-700",   bg: "bg-amber-900/20",   border: "border-amber-700/30",   Icon: Shield  },
  { name: "Silver",    minHours: 20,  minPercentile: 0.20, color: "text-slate-300",   bg: "bg-slate-500/10",   border: "border-slate-400/30",   Icon: Shield  },
  { name: "Gold",      minHours: 40,  minPercentile: 0.40, color: "text-yellow-400",  bg: "bg-yellow-500/10",  border: "border-yellow-500/30",  Icon: Award   },
  { name: "Platinum",  minHours: 60,  minPercentile: 0.60, color: "text-cyan-400",    bg: "bg-cyan-500/10",    border: "border-cyan-500/30",    Icon: Star    },
  { name: "Diamond",   minHours: 80,  minPercentile: 0.75, color: "text-blue-400",    bg: "bg-blue-500/10",    border: "border-blue-500/30",    Icon: Gem     },
  { name: "Master",    minHours: 100, minPercentile: 0.90, color: "text-purple-400",  bg: "bg-purple-500/10",  border: "border-purple-500/30",  Icon: Crown   },
  { name: "Ace",       minHours: 120, minPercentile: 0.95, color: "text-rose-400",    bg: "bg-rose-500/10",    border: "border-rose-500/30",    Icon: Zap     },
  { name: "Conqueror", minHours: 150, minPercentile: 0.99, color: "text-orange-400",  bg: "bg-orange-500/10",  border: "border-orange-500/30",  Icon: Trophy  },
];

export function getMonthlyRank(monthlyMinutes: number, rank: number, total: number): MonthlyRankInfo {
  const hours = monthlyMinutes / 60;
  const percentile = total > 1 ? (total - rank) / total : 0;
  let result = MONTHLY_RANKS[0];
  for (const r of MONTHLY_RANKS) {
    if (hours >= r.minHours && percentile >= r.minPercentile) result = r;
  }
  return result;
}

export function getMonthlyNextThreshold(current: MonthlyRankInfo): string {
  const idx = MONTHLY_RANKS.findIndex(r => r.name === current.name);
  const next = MONTHLY_RANKS[idx + 1];
  if (!next) return "Max rank reached!";
  return `${next.minHours}h/month + top ${Math.round((1 - next.minPercentile) * 100)}%`;
}
