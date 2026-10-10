import { Link } from "wouter";
import {
  ArrowRight, GraduationCap, Check, Twitter, Github, Linkedin,
  Flame, Trophy, BarChart2, Timer, Users, ChevronDown, BookOpen,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";

// ─── Count-up hook ───────────────────────────────────────────────────────────
function useCountUp(target: number, duration = 1800, start = false) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (!start) return;
    let startTime: number | null = null;
    const step = (ts: number) => {
      if (!startTime) startTime = ts;
      const p = Math.min((ts - startTime) / duration, 1);
      setCount(Math.floor(p * target));
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, duration, start]);
  return count;
}

function AnimatedStat({ value, label, suffix = "" }: { value: number; label: string; suffix?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) setVisible(true); }, { threshold: 0.3 });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  const count = useCountUp(value, 1800, visible);
  return (
    <div ref={ref} className="text-center">
      <div className="text-3xl md:text-4xl font-bold text-white">{count.toLocaleString()}{suffix}</div>
      <div className="text-[11px] text-zinc-500 mt-1.5 font-medium uppercase tracking-wider">{label}</div>
    </div>
  );
}

// ─── Hero background — no blur filters, pure CSS gradients ──────────────────
function HeroBackground() {
  return (
    <div className="absolute inset-0 overflow-hidden rounded-2xl">
      {/* Violet ambient — composited on GPU, no blur repaint */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 80% at 75% 20%, rgba(124,58,237,0.45) 0%, rgba(109,40,217,0.18) 40%, rgba(67,56,202,0.06) 65%, transparent 85%)",
          transform: "translateZ(0)",
        }}
      />
      {/* Secondary depth */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 50% 60% at 80% 60%, rgba(76,29,149,0.22) 0%, transparent 65%)",
          transform: "translateZ(0)",
        }}
      />
      {/* Grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
          backgroundSize: "36px 36px",
          maskImage: "linear-gradient(135deg, transparent 15%, rgba(0,0,0,0.7) 60%)",
          WebkitMaskImage: "linear-gradient(135deg, transparent 15%, rgba(0,0,0,0.7) 60%)",
          transform: "translateZ(0)",
        }}
      />
      {/* Border */}
      <div className="absolute inset-0 rounded-2xl border border-white/[0.06] pointer-events-none" />
    </div>
  );
}

// ─── Bento illustrations ─────────────────────────────────────────────────────
function TimerIllustration() {
  const [secs, setSecs] = useState(1447);
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const obs = new IntersectionObserver(([e]) => setVisible(e.isIntersecting), { threshold: 0.1, rootMargin: "100px" });
    if (ref.current) obs.observe(ref.current);
    return () => obs.disconnect();
  }, []);
  useEffect(() => {
    if (!visible) return;
    const t = setInterval(() => setSecs(s => (s + 1) % 3600), 1000);
    return () => clearInterval(t);
  }, [visible]);
  const h = Math.floor(secs / 3600), m = Math.floor((secs % 3600) / 60), s = secs % 60;
  const prog = (secs % 3600) / 3600;
  const r = 44, cx = 64, cy = 64;
  const circ = 2 * Math.PI * r;
  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center bg-zinc-950/60">
      <div className="flex flex-col items-center gap-3">
        <svg width="128" height="128" viewBox="0 0 128 128">
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#27272a" strokeWidth="6" />
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f59e0b" strokeWidth="6"
            strokeDasharray={circ} strokeDashoffset={circ * (1 - prog)}
            strokeLinecap="round" transform={`rotate(-90 ${cx} ${cy})`}
            style={{ transition: "stroke-dashoffset 1s linear" }} />
          <text x={cx} y={cy + 6} textAnchor="middle" fill="white" fontSize="14" fontWeight="600" fontFamily="monospace">
            {String(h).padStart(2,"0")}:{String(m).padStart(2,"0")}:{String(s).padStart(2,"0")}
          </text>
        </svg>
        <div className="flex gap-1.5">
          {["Deep Work","Break","Study"].map((l, i) => (
            <span key={l} className={`text-[10px] px-2 py-0.5 rounded-full border ${i === 0 ? "border-amber-500/40 text-amber-400 bg-amber-500/10" : "border-zinc-700 text-zinc-500"}`}>{l}</span>
          ))}
        </div>
      </div>
    </div>
  );
}

function LiveRoomsIllustration() {
  const people = [
    { initials:"AR", color:"bg-violet-500", active:true,  level: 72 },
    { initials:"SK", color:"bg-emerald-500", active:true,  level: 58 },
    { initials:"PM", color:"bg-blue-500",    active:false, level: 0  },
    { initials:"RK", color:"bg-orange-500",  active:true,  level: 85 },
  ];
  return (
    <div className="w-full h-full flex items-center justify-center bg-zinc-950/60 p-4">
      <div className="w-full max-w-[220px] space-y-2">
        <div className="flex items-center justify-between mb-3">
          <span className="text-xs text-zinc-400 font-medium">GATE 2026 — Room #4</span>
          <span className="flex items-center gap-1 text-[10px] text-emerald-400">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />LIVE
          </span>
        </div>
        {people.map(p => (
          <div key={p.initials} className="flex items-center gap-2.5 py-1.5 px-2.5 rounded-lg bg-zinc-900 border border-zinc-800">
            <div className={`w-6 h-6 rounded-full ${p.color} flex items-center justify-center text-[9px] text-white font-bold shrink-0`}>{p.initials}</div>
            <div className="flex-1 h-1 bg-zinc-800 rounded-full overflow-hidden">
              {p.active && <div className="h-full bg-zinc-500 rounded-full" style={{ width: `${p.level}%` }} />}
            </div>
            {p.active
              ? <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0" />
              : <div className="w-1.5 h-1.5 rounded-full bg-zinc-600 shrink-0" />}
          </div>
        ))}
      </div>
    </div>
  );
}

function StreakIllustration() {
  const days = ["M","T","W","T","F","S","S"];
  const done = [true,true,true,true,false,false,false];
  return (
    <div className="w-full h-full flex items-center justify-center bg-zinc-950/60 p-4">
      <div className="flex flex-col items-center gap-4">
        <div className="flex items-center gap-2">
          <Flame className="w-8 h-8 text-orange-400" />
          <span className="text-4xl font-bold text-white">14</span>
          <span className="text-zinc-400 text-sm">days</span>
        </div>
        <div className="flex gap-1.5">
          {days.map((d, i) => (
            <div key={i} className="flex flex-col items-center gap-1">
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${done[i] ? "bg-orange-500/20 border border-orange-500/40 text-orange-400" : "bg-zinc-900 border border-zinc-800 text-zinc-600"}`}>
                {done[i] ? "🔥" : d}
              </div>
              <span className="text-[9px] text-zinc-600">{d}</span>
            </div>
          ))}
        </div>
        <span className="text-[10px] text-zinc-500 text-center">Keep it up — don't break the chain!</span>
      </div>
    </div>
  );
}

function MockTestIllustration() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-zinc-950/60 p-4">
      <div className="w-full max-w-[220px] space-y-2.5">
        <div className="text-xs text-zinc-400 font-medium mb-3">Mock Test — GATE CS 2024</div>
        {[
          { q:"Q.12 — Algorithms", score:8, total:10, color:"bg-emerald-500" },
          { q:"Q.13 — OS Concepts", score:6, total:10, color:"bg-blue-500" },
          { q:"Q.14 — Networks",   score:9, total:10, color:"bg-emerald-500" },
        ].map(item => (
          <div key={item.q} className="space-y-1">
            <div className="flex justify-between text-[10px]">
              <span className="text-zinc-400">{item.q}</span>
              <span className="text-zinc-300">{item.score}/{item.total}</span>
            </div>
            <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
              <div className={`h-full ${item.color} rounded-full`} style={{ width:`${item.score/item.total*100}%` }} />
            </div>
          </div>
        ))}
        <div className="pt-1 flex justify-between items-center border-t border-zinc-800">
          <span className="text-[10px] text-zinc-500">Total Score</span>
          <span className="text-sm font-bold text-white">72 / 100</span>
        </div>
      </div>
    </div>
  );
}

// Stable outside component — Math.random() in render causes different values every repaint
const HEATMAP_DATA = Array.from({ length: 10 }, () =>
  Array.from({ length: 7 }, () => Math.random())
);

function HeatmapIllustration() {
  const intensities = HEATMAP_DATA;
  const color = (v: number) =>
    v > 0.8 ? "bg-emerald-400" : v > 0.6 ? "bg-emerald-600" : v > 0.35 ? "bg-emerald-900" : "bg-zinc-800";
  return (
    <div className="w-full h-full flex items-center justify-center bg-zinc-950/60 p-4">
      <div className="flex flex-col gap-3 items-center">
        <span className="text-xs text-zinc-400 font-medium">Study Activity — Last 10 weeks</span>
        <div className="flex gap-1">
          {intensities.map((week, wi) => (
            <div key={wi} className="flex flex-col gap-1">
              {week.map((v, di) => (
                <div key={di} className={`w-4 h-4 rounded-sm ${color(v)}`} />
              ))}
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-[9px] text-zinc-500">
          <span>Less</span>
          {["bg-zinc-800","bg-emerald-900","bg-emerald-600","bg-emerald-400"].map(c => (
            <div key={c} className={`w-3 h-3 rounded-sm ${c}`} />
          ))}
          <span>More</span>
        </div>
      </div>
    </div>
  );
}

function LeaderboardIllustration() {
  const users = [
    { rank:1, name:"Aryan R.", hours:"48h", medal:"🥇" },
    { rank:2, name:"Sneha K.", hours:"41h", medal:"🥈" },
    { rank:3, name:"You",     hours:"38h", medal:"🥉", self:true },
    { rank:4, name:"Priya M.", hours:"31h", medal:"" },
  ];
  return (
    <div className="w-full h-full flex items-center justify-center bg-zinc-950/60 p-4">
      <div className="w-full max-w-[220px]">
        <div className="text-xs text-zinc-400 font-medium mb-3">Weekly Leaderboard</div>
        {users.map(u => (
          <div key={u.rank} className={`flex items-center gap-2.5 py-1.5 px-2.5 rounded-lg mb-1.5 ${u.self ? "bg-violet-500/10 border border-violet-500/30" : "bg-zinc-900 border border-zinc-800"}`}>
            <span className="text-sm w-4 text-center">{u.medal || `${u.rank}`}</span>
            <span className={`text-xs flex-1 ${u.self ? "text-violet-300 font-medium" : "text-zinc-300"}`}>{u.name}</span>
            <span className="text-[10px] text-zinc-500">{u.hours}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── FAQ item ────────────────────────────────────────────────────────────────
function FAQItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div
      className="w-full rounded-xl border border-zinc-800 bg-[rgba(255,255,255,0.03)] overflow-hidden cursor-pointer"
      onClick={() => setOpen(o => !o)}
    >
      <div className="w-full px-5 py-4 flex justify-between items-center gap-4">
        <span className="text-sm font-medium text-white leading-relaxed">{q}</span>
        <ChevronDown className={`w-4 h-4 text-zinc-500 shrink-0 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </div>
      <div className={`overflow-hidden transition-all duration-300 ${open ? "max-h-60" : "max-h-0"}`}>
        <div className="px-5 pb-4 text-sm text-zinc-400 leading-relaxed">{a}</div>
      </div>
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────
export default function Marketing() {
  const [scrolled, setScrolled] = useState(false);
  const [annual, setAnnual] = useState(true);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  const bentoCards = [
    { title: "Focus Timer",      description: "Pomodoro-style timer keeps you in deep work. Track every session.",     Icon: Timer,     Component: TimerIllustration,       accent: "text-amber-400"   },
    { title: "Live Study Rooms", description: "Join real-time rooms with camera, mic & screen share.",                 Icon: Users,     Component: LiveRoomsIllustration,   accent: "text-emerald-400" },
    { title: "Daily Streaks",    description: "Build momentum with streaks that reward consistent study habits.",       Icon: Flame,     Component: StreakIllustration,      accent: "text-orange-400"  },
    { title: "Mock Tests",       description: "Practice with past papers, get instant AI feedback on weak areas.",     Icon: BookOpen,  Component: MockTestIllustration,    accent: "text-blue-400"    },
    { title: "Activity Heatmap", description: "Visualize months of effort at a glance. Know where you're strong.",     Icon: BarChart2, Component: HeatmapIllustration,    accent: "text-emerald-400" },
    { title: "Leaderboards",     description: "Healthy competition with your circle keeps everyone accountable.",      Icon: Trophy,    Component: LeaderboardIllustration, accent: "text-violet-400"  },
  ];

  const plans = [
    {
      name: "Free", price: annual ? "₹0" : "₹0", period: "/month",
      description: "For individuals starting out.",
      features: ["3 focus sessions/day", "Join up to 2 study circles", "Basic streak tracking", "Community leaderboard"],
      cta: "Get Started", ctaClass: "bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700",
    },
    {
      name: "Pro", price: annual ? "₹199" : "₹249", period: "/month",
      description: "For serious exam aspirants.",
      features: ["Unlimited focus sessions", "Live study rooms (10 seats)", "Full streak & heatmap analytics", "Mock test access + AI feedback", "Priority support"],
      cta: "Join Pro", ctaClass: "bg-violet-600 text-white hover:bg-violet-500",
      popular: true,
    },
    {
      name: "Team", price: annual ? "₹699" : "₹899", period: "/month",
      description: "For coaching institutes & groups.",
      features: ["Everything in Pro", "Up to 50 members per circle", "Admin dashboard & analytics", "Custom circle branding", "Dedicated support"],
      cta: "Contact Us", ctaClass: "bg-zinc-800 text-zinc-200 hover:bg-zinc-700 border border-zinc-700",
    },
  ];

  const faqs = [
    { q: "What is StudyCircle?", a: "StudyCircle is a collaborative study platform built for serious Indian exam aspirants — GATE, JEE, NEET, CAT, UPSC and more. It brings together focus timers, live study rooms, streaks, mock tests, and leaderboards in one place." },
    { q: "Is it free to use?", a: "Yes. The Free plan lets you join study circles, track streaks, and use the focus timer with no cost. Pro unlocks unlimited sessions, live rooms, and mock test analytics." },
    { q: "How do live study rooms work?", a: "A room lets circle members study together in real-time with video, audio, and screen share. When you're in a room your focus time is tracked automatically." },
    { q: "Can I use StudyCircle for any exam?", a: "Absolutely — you pick your exam focus during onboarding and your circle is organised around it. We currently support GATE, JEE, NEET, CAT, UPSC and SSC." },
    { q: "How are mock tests graded?", a: "Answers are evaluated instantly with explanations for each question. AI highlights the topics you're getting wrong so you can focus revision there." },
    { q: "Is my data private?", a: "Yes. Your study data is private by default. Only members of your circle can see circle-level stats. Individual session data is only visible to you." },
  ];

  return (
    <div className="min-h-screen bg-[#09090b] text-white overflow-x-hidden">

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-zinc-950/80 backdrop-blur-md border-b border-zinc-800/60" : ""}`}>
        <div className="max-w-6xl mx-auto px-5 h-14 flex items-center justify-between">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
                <GraduationCap className="w-4 h-4 text-white" />
              </div>
              <span className="text-[15px] font-semibold text-white tracking-tight">StudyCircle</span>
            </div>
            <nav className="hidden md:flex items-center gap-1">
              {["Features","Pricing","FAQ"].map(item => (
                <a key={item} href={`#${item.toLowerCase()}`}
                  className="text-sm text-zinc-400 hover:text-white px-3 py-1.5 rounded-full transition-colors font-medium">
                  {item}
                </a>
              ))}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <Link href="/sign-in">
              <button className="text-sm text-zinc-400 hover:text-white transition-colors font-medium px-3 py-1.5 hidden md:block">
                Login
              </button>
            </Link>
            <Link href="/sign-in">
              <button className="text-sm font-medium bg-violet-600 hover:bg-violet-500 text-white px-4 py-1.5 rounded-full transition-colors">
                Get Started Free
              </button>
            </Link>
          </div>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="relative mx-auto overflow-hidden rounded-2xl my-4 mx-4 md:mx-6"
        style={{ height: "min(860px, 90vh)" }}>
        <div className="absolute inset-0 bg-zinc-950">
          <HeroBackground />
        </div>

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center px-5 pt-16">
          <div className="inline-flex items-center gap-2 mb-6 px-3 py-1.5 rounded-full bg-white/5 border border-white/10 text-[11px] text-zinc-400 font-medium tracking-wide">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            For GATE · JEE · NEET · CAT · UPSC
          </div>
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-semibold leading-[1.08] tracking-tight max-w-3xl">
            Stop Studying Alone.
            <br />
            <span className="text-zinc-400">Start Winning</span> Together.
          </h1>
          <p className="mt-5 text-base md:text-lg text-zinc-400 font-medium max-w-xl leading-relaxed">
            Focus timers, live study rooms, mock tests, streaks, and leaderboards — everything serious aspirants need, in one place.
          </p>
          <div className="mt-8 flex items-center gap-3">
            <Link href="/sign-in">
              <button className="flex items-center gap-2 bg-white text-zinc-900 hover:bg-zinc-100 font-semibold px-6 py-2.5 rounded-full text-sm transition-colors shadow-lg">
                Get Started Free <ArrowRight className="w-4 h-4" />
              </button>
            </Link>
          </div>

          {/* Social proof */}
          <div className="mt-5 flex flex-col items-center gap-2">
            <div className="flex items-center gap-2.5">
              <div className="flex -space-x-2">
                {[
                  { initials: "AR", bg: "bg-violet-500/50" },
                  { initials: "SK", bg: "bg-emerald-500/50" },
                  { initials: "PM", bg: "bg-blue-500/50" },
                  { initials: "RK", bg: "bg-orange-500/50" },
                  { initials: "NJ", bg: "bg-pink-500/50" },
                ].map(a => (
                  <div key={a.initials}
                    className={`w-7 h-7 rounded-full ${a.bg} border-2 border-zinc-950 flex items-center justify-center text-[9px] font-bold text-white/80 shrink-0`}>
                    {a.initials}
                  </div>
                ))}
              </div>
              <span className="text-sm text-zinc-400 font-medium">
                <span className="text-white font-semibold">5,000+</span> students studying now
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex">
                {[...Array(5)].map((_, i) => (
                  <svg key={i} className="w-3 h-3 text-amber-400/60 fill-amber-400/60" viewBox="0 0 20 20">
                    <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                  </svg>
                ))}
              </div>
              <span className="text-[11px] text-zinc-500">Loved by GATE · JEE · NEET aspirants</span>
            </div>
          </div>

          {/* Dashboard peek */}
          <div className="mt-10 w-full max-w-4xl mx-auto">
            <div className="rounded-t-2xl overflow-hidden border border-zinc-800/80 shadow-[0_0_80px_rgba(124,58,237,0.15)]">
              <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2 flex items-center gap-3">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                  <div className="w-2.5 h-2.5 rounded-full bg-zinc-700" />
                </div>
                <div className="flex-1 bg-zinc-800 rounded-md px-3 py-1 text-[10px] text-zinc-500 text-center max-w-56 mx-auto">
                  studycircle.io/dashboard
                </div>
              </div>
              <img
                src="/dashboard-preview.png"
                alt="StudyCircle dashboard"
                className="w-full block"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
            </div>
          </div>
        </div>

        {/* Fade bottom */}
        <div className="absolute bottom-0 left-0 right-0 h-40 bg-linear-to-t from-zinc-950 via-zinc-950/80 to-transparent z-20 pointer-events-none" />
      </section>

      {/* ── Dashboard preview (full) ─────────────────────────────────────────── */}
      <section className="px-4 md:px-6 py-16 flex justify-center">
        <div className="w-full max-w-5xl">
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-semibold text-white">Your complete study command centre</h2>
            <p className="mt-2 text-zinc-500 text-sm">Everything in one focused dashboard — no tab juggling.</p>
          </div>
          <div className="rounded-2xl overflow-hidden border border-zinc-800 shadow-2xl">
            <div className="bg-zinc-900 border-b border-zinc-800 px-4 py-2.5 flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-zinc-700" />
                <div className="w-3 h-3 rounded-full bg-zinc-700" />
                <div className="w-3 h-3 rounded-full bg-zinc-700" />
              </div>
              <div className="flex-1 bg-zinc-800 rounded-md px-3 py-1 text-[11px] text-zinc-500 text-center max-w-64 mx-auto">
                studycircle.io/dashboard
              </div>
            </div>
            <div className="bg-zinc-950">
              <img
                src="/dashboard-preview.png"
                alt="StudyCircle dashboard"
                className="w-full block"
                loading="lazy"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                  (e.target as HTMLImageElement).parentElement!.innerHTML =
                    `<div class="flex flex-col items-center gap-3 py-16 text-zinc-600">
                      <svg class="w-10 h-10" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/></svg>
                      <span class="text-sm">Add dashboard-preview.png to /public</span>
                    </div>`;
                }}
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Features bento ──────────────────────────────────────────────────── */}
      <section id="features" className="px-4 md:px-6 py-16 max-w-6xl mx-auto" style={{ contain: "paint" }}>
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-semibold text-white leading-tight">
            Everything you need to crack your exam
          </h2>
          <p className="mt-3 text-zinc-400 text-base max-w-xl mx-auto">
            Built specifically for competitive exam aspirants — not a generic productivity tool.
          </p>
        </div>
        <div className="relative">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 relative">
            {bentoCards.map(card => (
              <div
                key={card.title}
                className="rounded-2xl border border-zinc-800 overflow-hidden flex flex-col"
                style={{ background: "rgba(255,255,255,0.02)" }}
              >
                <div className="p-5 pb-0">
                  <div className={`flex items-center gap-2 mb-1 ${card.accent}`}>
                    <card.Icon className="w-4 h-4" />
                    <span className="text-sm font-medium">{card.title}</span>
                  </div>
                  <p className="text-sm text-zinc-500 leading-relaxed">{card.description}</p>
                </div>
                <div className="h-52 mt-3">
                  <card.Component />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Stats ───────────────────────────────────────────────────────────── */}
      <section className="py-16 border-y border-zinc-800/60">
        <div className="max-w-4xl mx-auto px-5 grid grid-cols-2 md:grid-cols-4 gap-8">
          <AnimatedStat value={5000}   label="Students"       suffix="+" />
          <AnimatedStat value={320}    label="Active Circles"  suffix="+" />
          <AnimatedStat value={180000} label="Hours Studied"   suffix="+" />
          <AnimatedStat value={94}     label="Satisfaction"    suffix="%" />
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section className="py-20 px-5 max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <h2 className="text-3xl md:text-5xl font-semibold leading-tight">Get started in minutes</h2>
          <p className="mt-3 text-zinc-400 text-base">No setup friction. You're in a study room in under two minutes.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            { step:"01", title:"Create your account",    body:"Sign up free. Pick your exam and set your daily study goal." },
            { step:"02", title:"Join or create a circle", body:"Find peers preparing for the same exam or invite your friends." },
            { step:"03", title:"Study together daily",    body:"Use the timer, join live rooms, and climb the leaderboard." },
          ].map(s => (
            <div key={s.step} className="rounded-2xl border border-zinc-800 p-6" style={{ background: "rgba(255,255,255,0.02)" }}>
              <div className="text-4xl font-bold text-zinc-800 mb-4 leading-none">{s.step}</div>
              <h3 className="text-base font-semibold text-white mb-2">{s.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-20 px-5 max-w-5xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-5xl font-semibold leading-tight">Simple, honest pricing</h2>
          <p className="mt-3 text-zinc-400 text-base">Built for Indian students. No dollar conversions.</p>
          <div className="mt-6 inline-flex p-0.5 bg-zinc-900 rounded-lg border border-zinc-800">
            <button onClick={() => setAnnual(true)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${annual ? "bg-zinc-700 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}>
              Annual <span className="text-[10px] text-emerald-400 ml-1">–20%</span>
            </button>
            <button onClick={() => setAnnual(false)}
              className={`px-4 py-1.5 text-sm font-medium rounded-md transition-all ${!annual ? "bg-zinc-700 text-white shadow-sm" : "text-zinc-500 hover:text-zinc-300"}`}>
              Monthly
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {plans.map(plan => (
            <div key={plan.name}
              className={`rounded-2xl p-6 flex flex-col gap-5 ${plan.popular ? "bg-zinc-900 border-2 border-violet-500/50 shadow-[0_0_40px_rgba(124,58,237,0.15)]" : "border border-zinc-800"}`}
              style={plan.popular ? {} : { background: "rgba(255,255,255,0.02)" }}>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-zinc-300">{plan.name}</span>
                  {plan.popular && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-violet-500/15 text-violet-400 border border-violet-500/30 font-medium">Popular</span>
                  )}
                </div>
                <div className="flex items-end gap-1">
                  <span className="text-3xl font-bold text-white">{plan.price}</span>
                  <span className="text-zinc-500 text-sm mb-1">{plan.period}</span>
                </div>
                <p className="text-xs text-zinc-500 mt-1">{plan.description}</p>
              </div>
              <Link href="/sign-in" className="block">
                <button className={`w-full py-2 rounded-full text-sm font-medium transition-colors ${plan.ctaClass}`}>
                  {plan.cta}
                </button>
              </Link>
              <ul className="space-y-2.5">
                {plan.features.map(f => (
                  <li key={f} className="flex items-start gap-2 text-sm text-zinc-400">
                    <Check className="w-3.5 h-3.5 text-zinc-500 mt-0.5 shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ─────────────────────────────────────────────────────────────── */}
      <section id="faq" className="py-20 px-5 max-w-2xl mx-auto">
        <div className="text-center mb-10">
          <h2 className="text-3xl md:text-4xl font-semibold">Frequently asked questions</h2>
          <p className="mt-3 text-zinc-400 text-sm">Everything you need to know before you start.</p>
        </div>
        <div className="space-y-3">
          {faqs.map(f => <FAQItem key={f.q} q={f.q} a={f.a} />)}
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <section className="py-24 px-5 relative overflow-hidden flex flex-col items-center text-center">
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse 80% 60% at 50% -10%, rgba(109,40,217,0.35) 0%, rgba(76,29,149,0.15) 45%, transparent 75%)",
            transform: "translateZ(0)",
          }}
        />
        <div className="relative z-10 max-w-xl">
          <h2 className="text-4xl md:text-6xl font-semibold leading-tight mb-4">
            Your rank is waiting.
          </h2>
          <p className="text-zinc-400 text-base mb-8">
            Join thousands of aspirants who study smarter, not harder.
          </p>
          <Link href="/sign-in">
            <button className="bg-white text-zinc-900 hover:bg-zinc-100 font-semibold px-8 py-3 rounded-full text-sm transition-colors shadow-[0_0_0_4px_rgba(255,255,255,0.1)]">
              Start for free — no card needed
            </button>
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-zinc-800/60 px-5 py-12 max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between gap-10">
          <div className="flex flex-col gap-4">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-violet-600 flex items-center justify-center shrink-0">
                <GraduationCap className="w-4 h-4 text-white" />
              </div>
              <span className="text-[15px] font-semibold text-white">StudyCircle</span>
            </div>
            <p className="text-sm text-zinc-500 max-w-45 leading-relaxed">Study together. Rank higher.</p>
            <div className="flex gap-3">
              {[Twitter, Github, Linkedin].map((Icon, i) => (
                <a key={i} href="#" className="w-8 h-8 rounded-lg bg-zinc-900 border border-zinc-800 flex items-center justify-center hover:border-zinc-600 transition-colors">
                  <Icon className="w-3.5 h-3.5 text-zinc-500" />
                </a>
              ))}
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-8">
            {[
              { head: "Product", links: ["Features","Pricing","Mock Tests","Leaderboard"] },
              { head: "Company", links: ["About","Blog","Careers","Contact"] },
              { head: "Legal",   links: ["Privacy Policy","Terms of Use","Refund Policy"] },
            ].map(col => (
              <div key={col.head} className="flex flex-col gap-3">
                <span className="text-[11px] font-semibold text-zinc-500 uppercase tracking-wider">{col.head}</span>
                {col.links.map(l => (
                  <a key={l} href="#" className="text-sm text-zinc-400 hover:text-white transition-colors">{l}</a>
                ))}
              </div>
            ))}
          </div>
        </div>
        <div className="mt-10 pt-6 border-t border-zinc-800/60 text-[11px] text-zinc-600 text-center">
          © {new Date().getFullYear()} StudyCircle. Made with ♥ for Indian aspirants.
        </div>
      </footer>

    </div>
  );
}
