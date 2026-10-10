import { motion } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

export type AuraTier = "none" | "glow" | "surge" | "blaze" | "phantom" | "legend";

export function getAuraTier(todayMinutes: number): AuraTier {
  if (todayMinutes >= 540) return "legend";   // 9h+
  if (todayMinutes >= 420) return "phantom";  // 7h+
  if (todayMinutes >= 300) return "blaze";    // 5h+
  if (todayMinutes >= 180) return "surge";    // 3h+
  if (todayMinutes >= 60)  return "glow";     // 1h+
  return "none";
}

const TIER_CONFIG: Record<AuraTier, {
  ring: string;
  glow: string;
  filter: string;
  pulse: { scale: number[]; opacity?: number[] };
  pulseSpeed: number;
  particles: boolean;
  label: string;
}> = {
  none: {
    ring: "border-white/10",
    glow: "",
    filter: "",
    pulse: { scale: [1, 1] },
    pulseSpeed: 2,
    particles: false,
    label: "",
  },
  glow: {
    ring: "border-emerald-400",
    glow: "0 0 12px rgba(52,211,153,0.6)",
    filter: "brightness(1.08) saturate(1.1)",
    pulse: { scale: [1, 1.04, 1] },
    pulseSpeed: 2.5,
    particles: false,
    label: "Glow",
  },
  surge: {
    ring: "border-yellow-400",
    glow: "0 0 18px rgba(250,204,21,0.7)",
    filter: "brightness(1.12) saturate(1.25) hue-rotate(10deg)",
    pulse: { scale: [1, 1.06, 1] },
    pulseSpeed: 1.8,
    particles: false,
    label: "Surge",
  },
  blaze: {
    ring: "border-orange-500",
    glow: "0 0 24px rgba(249,115,22,0.8)",
    filter: "brightness(1.15) saturate(1.4) hue-rotate(350deg)",
    pulse: { scale: [1, 1.07, 1], opacity: [1, 0.9, 1] },
    pulseSpeed: 1.4,
    particles: true,
    label: "Blaze",
  },
  phantom: {
    ring: "border-fuchsia-500",
    glow: "0 0 30px rgba(217,70,239,0.85)",
    filter: "brightness(1.1) saturate(1.5) hue-rotate(270deg)",
    pulse: { scale: [1, 1.08, 0.98, 1.08, 1], opacity: [1, 0.85, 1, 0.85, 1] },
    pulseSpeed: 1.2,
    particles: true,
    label: "Phantom",
  },
  legend: {
    ring: "border-yellow-300",
    glow: "0 0 40px rgba(253,224,71,0.9), 0 0 80px rgba(168,85,247,0.4)",
    filter: "brightness(1.2) saturate(1.6)",
    pulse: { scale: [1, 1.1, 0.96, 1.1, 1] },
    pulseSpeed: 0.9,
    particles: true,
    label: "Legend",
  },
};

const PARTICLE_COLORS: Record<AuraTier, string[]> = {
  none: [],
  glow: [],
  surge: [],
  blaze: ["#f97316", "#fb923c", "#fed7aa", "#fbbf24"],
  phantom: ["#d946ef", "#a855f7", "#818cf8", "#c4b5fd"],
  legend: ["#fde047", "#a855f7", "#38bdf8", "#f472b6", "#34d399"],
};

function Particle({ color, size }: { color: string; size: number }) {
  const x = (Math.random() - 0.5) * 40;
  const duration = 1.2 + Math.random() * 1;
  const delay = Math.random() * 1.5;
  return (
    <motion.div
      className="absolute rounded-full pointer-events-none"
      style={{ width: size, height: size, background: color, bottom: "10%", left: "50%" }}
      animate={{ y: [-0, -35 - Math.random() * 20], x, opacity: [0, 1, 0], scale: [0.5, 1, 0.3] }}
      transition={{ duration, delay, repeat: Infinity, ease: "easeOut" }}
    />
  );
}

interface AvatarWithAuraProps {
  src: string;
  fallback: string;
  todayMinutes: number;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
}

const SIZE_MAP = {
  sm: "w-10 h-10",
  md: "w-14 h-14",
  lg: "w-20 h-20",
  xl: "w-28 h-28",
};

export function AvatarWithAura({ src, fallback, todayMinutes, size = "md", className = "" }: AvatarWithAuraProps) {
  const tier = getAuraTier(todayMinutes);
  const config = TIER_CONFIG[tier];
  const colors = PARTICLE_COLORS[tier];

  return (
    <div className={`relative inline-flex items-center justify-center ${className}`}>
      {/* Outer glow ring */}
      {config.glow && (
        <motion.div
          className="absolute inset-0 rounded-full pointer-events-none"
          animate={{ boxShadow: [config.glow, config.glow.replace("0.9", "0.5"), config.glow] }}
          transition={{ duration: config.pulseSpeed, repeat: Infinity, ease: "easeInOut" }}
        />
      )}

      {/* Avatar with pulse + filter */}
      <motion.div
        animate={config.pulse}
        transition={{ duration: config.pulseSpeed, repeat: Infinity, ease: "easeInOut" }}
        style={{ filter: config.filter || undefined }}
      >
        <Avatar className={`${SIZE_MAP[size]} border-2 ${config.ring}`}>
          <AvatarImage src={src} />
          <AvatarFallback className="bg-zinc-800 text-white font-bold">
            {fallback}
          </AvatarFallback>
        </Avatar>
      </motion.div>

      {/* Floating particles */}
      {config.particles && colors.length > 0 && (
        <div className="absolute inset-0 overflow-visible pointer-events-none">
          {colors.map((color, i) => (
            <Particle key={i} color={color} size={3 + (i % 3)} />
          ))}
        </div>
      )}
    </div>
  );
}
