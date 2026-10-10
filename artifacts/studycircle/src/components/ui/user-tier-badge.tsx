import * as React from "react";
import { cn } from "@/lib/utils";
import { Sparkles, Zap, Flame, Infinity, Crown } from "lucide-react";

export interface UserTierBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  minutes: number;
  showIconOnly?: boolean;
}

export function UserTierBadge({ minutes, showIconOnly = false, className, ...props }: UserTierBadgeProps) {
  if (minutes < 60) return null; // No badge if less than 1 hour

  let tier = {
    name: "Glow",
    icon: Sparkles,
    color: "text-cyan-400",
    bg: "bg-cyan-500/10",
    border: "border-cyan-500/30",
    shadow: "shadow-[0_0_10px_rgba(34,211,238,0.2)]",
  };

  if (minutes >= 720) {
    tier = {
      name: "Legend",
      icon: Crown,
      color: "text-yellow-400",
      bg: "bg-yellow-500/10",
      border: "border-yellow-500/40",
      shadow: "shadow-[0_0_15px_rgba(250,204,21,0.3)]",
    };
  } else if (minutes >= 480) {
    tier = {
      name: "Phantom",
      icon: Infinity,
      color: "text-fuchsia-400",
      bg: "bg-fuchsia-500/10",
      border: "border-fuchsia-500/30",
      shadow: "shadow-[0_0_15px_rgba(232,121,249,0.2)]",
    };
  } else if (minutes >= 300) {
    tier = {
      name: "Blaze",
      icon: Flame,
      color: "text-orange-500",
      bg: "bg-orange-500/10",
      border: "border-orange-500/30",
      shadow: "shadow-[0_0_15px_rgba(249,115,22,0.2)]",
    };
  } else if (minutes >= 180) {
    tier = {
      name: "Surge",
      icon: Zap,
      color: "text-violet-400",
      bg: "bg-violet-500/10",
      border: "border-violet-500/30",
      shadow: "shadow-[0_0_15px_rgba(167,139,250,0.2)]",
    };
  }

  const Icon = tier.icon;

  if (showIconOnly) {
    return (
      <div 
        className={cn("flex items-center justify-center rounded-full p-1 border", tier.bg, tier.border, tier.color, tier.shadow, className)}
        title={tier.name}
        {...props}
      >
        <Icon className="w-3.5 h-3.5" />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border text-xs font-bold tracking-wide uppercase",
        tier.bg,
        tier.border,
        tier.color,
        tier.shadow,
        className
      )}
      {...props}
    >
      <Icon className="w-3.5 h-3.5" />
      {tier.name}
    </div>
  );
}

/** Returns the specific classnames for an Avatar border based on the tier */
export function getTierAvatarRing(minutes: number): string {
  if (minutes >= 720) return "ring-2 ring-yellow-500 ring-offset-2 ring-offset-background shadow-[0_0_15px_rgba(250,204,21,0.5)]";
  if (minutes >= 480) return "ring-2 ring-fuchsia-500 ring-offset-2 ring-offset-background shadow-[0_0_15px_rgba(232,121,249,0.5)]";
  if (minutes >= 300) return "ring-2 ring-orange-500 ring-offset-2 ring-offset-background shadow-[0_0_15px_rgba(249,115,22,0.5)]";
  if (minutes >= 180) return "ring-2 ring-violet-500 ring-offset-2 ring-offset-background shadow-[0_0_15px_rgba(167,139,250,0.5)]";
  if (minutes >= 60) return "ring-2 ring-cyan-500 ring-offset-2 ring-offset-background shadow-[0_0_15px_rgba(34,211,238,0.5)]";
  return "";
}

export interface TierInfo {
  name: string;
  glowRgb: string;
  cardBg: string;
  cardBorder: string;
  /** Framer-motion filter keyframes for breathing glow — animate with repeat: Infinity */
  animateFilter: string[];
}

/** Full tier metadata for card backgrounds, borders, and animations. Returns null for < 1 hour. */
export function getTierInfo(minutes: number): TierInfo | null {
  if (minutes >= 720) return {
    name: "Legend", glowRgb: "250,204,21",
    cardBg: "rgba(250,204,21,0.13)", cardBorder: "rgba(250,204,21,0.40)",
    animateFilter: ["drop-shadow(0 0 3px rgba(250,204,21,0.35))", "drop-shadow(0 0 9px rgba(250,204,21,0.8))", "drop-shadow(0 0 3px rgba(250,204,21,0.35))"],
  };
  if (minutes >= 480) return {
    name: "Phantom", glowRgb: "232,121,249",
    cardBg: "rgba(232,121,249,0.13)", cardBorder: "rgba(232,121,249,0.40)",
    animateFilter: ["drop-shadow(0 0 3px rgba(232,121,249,0.35))", "drop-shadow(0 0 9px rgba(232,121,249,0.8))", "drop-shadow(0 0 3px rgba(232,121,249,0.35))"],
  };
  if (minutes >= 300) return {
    name: "Blaze", glowRgb: "249,115,22",
    cardBg: "rgba(249,115,22,0.13)", cardBorder: "rgba(249,115,22,0.40)",
    animateFilter: ["drop-shadow(0 0 3px rgba(249,115,22,0.35))", "drop-shadow(0 0 9px rgba(249,115,22,0.8))", "drop-shadow(0 0 3px rgba(249,115,22,0.35))"],
  };
  if (minutes >= 180) return {
    name: "Surge", glowRgb: "167,139,250",
    cardBg: "rgba(167,139,250,0.13)", cardBorder: "rgba(167,139,250,0.40)",
    animateFilter: ["drop-shadow(0 0 3px rgba(167,139,250,0.35))", "drop-shadow(0 0 9px rgba(167,139,250,0.8))", "drop-shadow(0 0 3px rgba(167,139,250,0.35))"],
  };
  if (minutes >= 60) return {
    name: "Glow", glowRgb: "34,211,238",
    cardBg: "rgba(34,211,238,0.13)", cardBorder: "rgba(34,211,238,0.40)",
    animateFilter: ["drop-shadow(0 0 3px rgba(34,211,238,0.35))", "drop-shadow(0 0 9px rgba(34,211,238,0.8))", "drop-shadow(0 0 3px rgba(34,211,238,0.35))"],
  };
  return null;
}
