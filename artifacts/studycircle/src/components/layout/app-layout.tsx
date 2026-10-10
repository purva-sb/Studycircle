import { useState, useEffect, useCallback } from "react";
import { Link, useLocation } from "wouter";
import {
  Home, Users, Radio, FileText, BarChart2,
  Trophy, MessageSquare, Settings, Folder, GraduationCap,
  Bell, BookOpen, Calendar, Zap, X, HelpCircle,
  Search, Flame, ChevronLeft, Sun, Moon, ShieldCheck,
  CalendarDays,
} from "lucide-react";
import { useTheme } from "next-themes";
import { useGetMe } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { useUser } from "@clerk/clerk-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "framer-motion";
import { OnboardingModal } from "@/components/onboarding-modal";
import { useTour } from "@/hooks/use-tour";
import { AvatarOnboardingModal } from "@/components/avatar-onboarding-modal";
import { GlobalCallListener } from "@/components/global-call-listener";
import { AITutorChat } from "@/components/ai-tutor-chat";
import { CustomizationStoreModal } from "@/pages/settings";
import { profileQueryOptions } from "@/lib/query-client";
import { cn } from "@/lib/utils";
import { UserNav } from "@/components/layout/user-nav";
import { resolveAvatarUrl } from "@/lib/avatars";

// ─── Nav config ──────────────────────────────────────────────────────────────

// Order optimized for students: daily-use features (exams, study, analytics) at top,
// social/help next, planning/admin at bottom.
const NAV = [
  {
    label: "Study",
    items: [
      { href: "/dashboard", icon: Home,      label: "Dashboard",  tourId: "tour-dashboard" },
      { href: "/exams",     icon: FileText,  label: "Mock Exams", tourId: "tour-exams"     },
      { href: "/study",     icon: BookOpen,  label: "Study Hub",  tourId: "tour-study"     },
      { href: "/schedule",  icon: Calendar,  label: "Schedule"                             },
      { href: "/analytics", icon: BarChart2, label: "Analytics",  tourId: "tour-analytics" },
    ],
  },
  {
    label: "Connect",
    items: [
      { href: "/doubts",      icon: HelpCircle,    label: "Doubts",      tourId: "tour-doubts"      },
      { href: "/focus-rooms", icon: Radio,         label: "Focus Rooms", tourId: "tour-focus-rooms" },
      { href: "/circles",     icon: Users,         label: "Circles"                                 },
      { href: "/dms",         icon: MessageSquare, label: "Messages"                                },
    ],
  },
  {
    label: "Plan",
    items: [
      { href: "/exam-calendar", icon: CalendarDays, label: "Exam Dates"  },
      { href: "/leaderboard",   icon: Trophy,       label: "Leaderboard" },
      { href: "/resources",     icon: Folder,       label: "Resources"   },
    ],
  },
  {
    label: "Account",
    items: [
      { href: "/settings", icon: Settings, label: "Settings" },
    ],
  },
];

// Mobile bottom nav — 5 most-tapped exam-prep features
const BOTTOM_NAV = [
  { href: "/dashboard", icon: Home,       label: "Home"      },
  { href: "/exams",     icon: FileText,   label: "Exams"     },
  { href: "/study",     icon: BookOpen,   label: "Study"     },
  { href: "/doubts",    icon: HelpCircle, label: "Doubts"    },
  { href: "/analytics", icon: BarChart2,  label: "Stats"     },
];

type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
};

const NOTIF_ICONS: Record<string, string> = {
  doubt_reply: "💬",
  exam_live:   "📋",
  achievement: "🏆",
  system:      "📢",
};

function timeAgo(iso: string): string {
  const secs = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (secs < 60)   return "just now";
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  if (secs < 86400) return `${Math.floor(secs / 3600)}h ago`;
  return `${Math.floor(secs / 86400)}d ago`;
}

// ─── AppLayout ───────────────────────────────────────────────────────────────

export function AppLayout({ children }: { children: React.ReactNode }) {
  const [location] = useLocation();
  const { data: me } = useGetMe({ query: profileQueryOptions });
  const { user } = useUser();
  const [showNotifs, setShowNotifs] = useState(false);
  const { theme, setTheme } = useTheme();
  const qc = useQueryClient();

  const { data: notifications = [] } = useQuery<AppNotification[]>({
    queryKey: ["notifications"],
    queryFn: () => customFetch("/api/notifications"),
    staleTime: 30_000,
    refetchInterval: 60_000,
  });

  const markAllRead = useMutation({
    mutationFn: () => customFetch("/api/notifications/read-all", { method: "PATCH" }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });

  const markOneRead = useCallback((id: string, link: string | null) => {
    customFetch(`/api/notifications/${id}/read`, { method: "PATCH" }).then(() =>
      qc.invalidateQueries({ queryKey: ["notifications"] })
    ).catch(() => {});
    if (link) window.location.href = link;
    setShowNotifs(false);
  }, [qc]);

  const displayName = user?.fullName || user?.primaryEmailAddress?.emailAddress?.split("@")[0] || me?.displayName || "You";
  const avatarUrl   = resolveAvatarUrl(me?.activeAvatarId, user?.imageUrl || me?.avatarUrl);
  const unread      = notifications.filter(n => !n.read).length;
  const examFocus   = (user?.unsafeMetadata?.examFocus as string) || me?.examFocus;

  // Tour only auto-starts after onboarding is complete (examFocus set) — prevents
  // driver.js overlay firing simultaneously with the OnboardingModal
  const { startTour, isTourDone } = useTour({ autoStart: !!examFocus });
  const needsAvatar = me !== undefined && !me?.activeAvatarId;
  const [avatarModalDone, setAvatarModalDone] = useState(false);

  // Sidebar collapsed state — persisted across sessions
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try { return localStorage.getItem("sc-sidebar") === "collapsed"; }
    catch { return false; }
  });

  const toggleSidebar = () => {
    setSidebarCollapsed(v => {
      const next = !v;
      try { localStorage.setItem("sc-sidebar", next ? "collapsed" : "expanded"); } catch {}
      return next;
    });
  };

  const isAdmin = user?.publicMetadata?.role === "admin";
  const sharedSidebarProps = { location, me, displayName, avatarUrl, examFocus, isAdmin };

  return (
    <div className="min-h-dvh flex bg-background">
      <OnboardingModal />
      {needsAvatar && !avatarModalDone && (
        <AvatarOnboardingModal onComplete={() => setAvatarModalDone(true)} />
      )}
      <CustomizationStoreModal profile={me} />
      <GlobalCallListener />
      <AITutorChat />

      {/* ── Desktop Sidebar ── */}
      <aside className={cn(
        "hidden lg:flex flex-col border-r border-border bg-background h-screen sticky top-0 z-30 shrink-0",
        "transition-[width] duration-300 ease-in-out overflow-hidden",
        sidebarCollapsed ? "w-17" : "w-64"
      )}>
        <SidebarContent
          {...sharedSidebarProps}
          collapsed={sidebarCollapsed}
          onToggle={toggleSidebar}
        />
      </aside>

      {/* ── Main Column ── */}
      <div className="flex-1 flex flex-col min-w-0">

        {/* ── Topbar ── */}
        <header className="sticky top-0 z-20 h-14 border-b border-border bg-background flex items-center gap-3 px-4 lg:px-5">

          {/* Mobile hamburger */}
          <Sheet>
            <SheetTrigger asChild>
              <button className="lg:hidden p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72 p-0 border-border bg-background">
              <SidebarContent {...sharedSidebarProps} collapsed={false} />
            </SheetContent>
          </Sheet>

          {/* Logo — mobile only */}
          <Link href="/dashboard" className="lg:hidden font-bold text-sm text-foreground">
            Study<span className="text-indigo-400">Circle</span>
          </Link>

          {/* Search */}
          <div className="hidden sm:flex flex-1 max-w-xs relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/60" />
            <input
              type="search"
              placeholder="Search rooms, doubts, notes…"
              className="w-full bg-muted border border-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500/50 focus:border-indigo-500/50 transition-all"
            />
            <kbd className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground/50 font-mono hidden md:block">⌘K</kbd>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            {/* Streak pill */}
            {me?.streakDays ? (
              <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full bg-orange-500/10 border border-orange-500/20 text-orange-400 text-xs font-semibold">
                <Flame className="w-3 h-3" /> {me.streakDays}d
              </div>
            ) : null}

            {/* XP pill */}
            {me?.xp ? (
              <div className="hidden md:flex items-center gap-1 px-2.5 py-1 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold">
                <Zap className="w-3 h-3" /> {me.xp}
              </div>
            ) : null}

            {/* Theme toggle */}
            <button
              onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
              className="p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              title="Toggle theme"
            >
              {theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Tour trigger */}
            <button
              onClick={startTour}
              title="Take a tour"
              className={cn(
                "hidden lg:flex items-center gap-1.5 rounded-lg text-xs font-semibold transition-all",
                isTourDone
                  ? "p-2 text-muted-foreground hover:bg-muted hover:text-foreground"
                  : "px-2.5 py-1.5 bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/25 animate-pulse"
              )}
            >
              <HelpCircle className="w-4 h-4 shrink-0" />
              {!isTourDone && <span>Tour</span>}
            </button>

            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setShowNotifs(v => !v)}
                className="relative p-2 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <Bell className="w-4 h-4" />
                {unread > 0 && (
                  unread > 9
                    ? <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-indigo-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">9+</span>
                    : <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 bg-indigo-500 rounded-full text-[9px] font-bold text-white flex items-center justify-center">{unread}</span>
                )}
              </button>

              <AnimatePresence>
                {showNotifs && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowNotifs(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.97 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 top-11 w-80 bg-card border border-border rounded-xl shadow-2xl shadow-black/40 z-50 overflow-hidden"
                    >
                      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                        <span className="text-sm font-semibold">Notifications</span>
                        <div className="flex items-center gap-2">
                          {unread > 0 && (
                            <button
                              onClick={() => markAllRead.mutate()}
                              className="text-[11px] text-indigo-400 hover:text-indigo-300"
                            >
                              Mark all read
                            </button>
                          )}
                          <button onClick={() => setShowNotifs(false)} className="text-muted-foreground hover:text-foreground p-0.5">
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="divide-y divide-border max-h-72 overflow-y-auto">
                        {notifications.length === 0 && (
                          <div className="px-4 py-8 text-center text-xs text-muted-foreground">
                            No notifications yet
                          </div>
                        )}
                        {notifications.map(n => (
                          <div
                            key={n.id}
                            onClick={() => markOneRead(n.id, n.link)}
                            className={cn(
                              "flex gap-3 px-4 py-3 hover:bg-muted/50 transition-colors cursor-pointer",
                              !n.read && "bg-indigo-500/5"
                            )}
                          >
                            <span className="text-lg shrink-0">{NOTIF_ICONS[n.type] ?? "🔔"}</span>
                            <div className="flex-1 min-w-0">
                              <p className={cn("text-xs leading-snug font-medium", n.read ? "text-muted-foreground" : "text-foreground")}>{n.title}</p>
                              <p className="text-[11px] text-muted-foreground/70 mt-0.5 line-clamp-2">{n.body}</p>
                              <p className="text-[10px] text-muted-foreground/50 mt-1">{timeAgo(n.createdAt)}</p>
                            </div>
                            {!n.read && <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0 mt-1.5" />}
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>

            {/* Avatar */}
            <UserNav>
              <button className="rounded-full outline-none">
                <Avatar className="h-8 w-8 cursor-pointer hover:ring-2 ring-indigo-500 ring-offset-1 ring-offset-background transition-all">
                  <AvatarImage src={avatarUrl} />
                  <AvatarFallback className="text-[11px] bg-muted text-muted-foreground">
                    {displayName?.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </button>
            </UserNav>
          </div>
        </header>

        {/* ── Page Content ── */}
        <main
          className="flex-1 overflow-y-auto p-4 sm:p-6 pb-24 lg:pb-6 bg-background"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {children}
        </main>

        {/* ── Mobile Bottom Nav ── */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-30 border-t border-border bg-background/95 backdrop-blur-sm flex">
          {BOTTOM_NAV.map(item => {
            const isActive = location === item.href || (item.href !== "/dashboard" && location.startsWith(item.href));
            return (
              <Link key={item.href} href={item.href} className="flex-1">
                <div className={cn(
                  "flex flex-col items-center justify-center gap-1 py-2.5 transition-all",
                  isActive ? "text-indigo-400" : "text-muted-foreground hover:text-foreground"
                )}>
                  <item.icon className="w-5 h-5" />
                  <span className="text-[10px] font-medium">{item.label}</span>
                </div>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

function NavItem({
  item, isActive, collapsed,
}: {
  item: { href: string; icon: React.ElementType; label: string; tourId?: string };
  isActive: boolean;
  collapsed: boolean;
}) {
  const el = (
    <Link href={item.href} className="block">
      <div id={item.tourId} className={cn(
        "relative flex items-center rounded-xl font-medium transition-all duration-150 group",
        collapsed ? "justify-center p-3" : "gap-3 px-3 py-2.5",
        isActive
          ? "bg-indigo-500/10 text-indigo-400"
          : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
      )}>
        {isActive && (
          <motion.div
            layoutId="sidebar-pill"
            className="absolute inset-0 bg-indigo-500/10 rounded-xl"
            transition={{ type: "spring", bounce: 0.15, duration: 0.35 }}
          />
        )}
        <item.icon className={cn(
          "w-4.5 h-4.5 shrink-0 relative z-10 transition-colors",
          isActive ? "text-indigo-400" : "text-muted-foreground group-hover:text-foreground"
        )} />
        {!collapsed && (
          <>
            <span className="relative z-10 flex-1 text-sm">{item.label}</span>
            {isActive && (
              <div className="relative z-10 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
            )}
          </>
        )}
      </div>
    </Link>
  );

  if (!collapsed) return el;

  return (
    <Tooltip delayDuration={0}>
      <TooltipTrigger asChild>{el}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={6} className="text-xs font-medium">
        {item.label}
      </TooltipContent>
    </Tooltip>
  );
}

function SidebarContent({
  location, me, displayName, avatarUrl, examFocus, isAdmin,
  collapsed = false, onToggle,
}: {
  location: string;
  me: any;
  displayName: string;
  avatarUrl: string;
  examFocus?: string;
  isAdmin?: boolean;
  collapsed?: boolean;
  onToggle?: () => void;
}) {
  return (
    <div className="flex flex-col h-full select-none overflow-hidden">

      {/* ── Logo / Brand ── */}
      <div id="tour-brand" className={cn(
        "h-14 border-b border-border flex items-center shrink-0 gap-3",
        collapsed ? "justify-center px-0" : "px-4"
      )}>
        <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center shrink-0">
          <GraduationCap className="w-4 h-4 text-white" />
        </div>
        {!collapsed && (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-sm font-bold tracking-tight truncate">StudyCircle</span>
            {examFocus && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-indigo-500/15 text-indigo-400 border border-indigo-500/25 shrink-0">
                {examFocus.split(" ")[0]}
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Nav ── */}
      <nav className="flex-1 py-3 overflow-y-auto scrollbar-none">
        {NAV.map((section, si) => (
          <div key={section.label} className={cn(collapsed ? "px-2" : "px-3")}>
            {/* Section divider / label */}
            {collapsed ? (
              si > 0 && <div className="my-2 h-px bg-border/50 mx-1" />
            ) : (
              <p className={cn(
                "px-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest",
                si === 0 ? "mb-1.5" : "mt-5 mb-1.5"
              )}>
                {section.label}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map(item => {
                const isActive = location === item.href ||
                  (item.href !== "/dashboard" && location.startsWith(item.href));
                return (
                  <NavItem key={item.href} item={item} isActive={isActive} collapsed={collapsed} />
                );
              })}
            </div>
          </div>
        ))}

        {/* Admin link — only visible to admin */}
        {isAdmin && (
          <div className={cn(collapsed ? "px-2 mt-2" : "px-3 mt-2")}>
            {!collapsed && (
              <p className="px-1 text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest mt-5 mb-1.5">
                Admin
              </p>
            )}
            {collapsed && <div className="my-2 h-px bg-border/50 mx-1" />}
            <NavItem
              item={{ href: "/admin", icon: ShieldCheck, label: "Admin Panel" }}
              isActive={location === "/admin"}
              collapsed={collapsed}
            />
          </div>
        )}
      </nav>

      {/* ── Collapse toggle — desktop only ── */}
      {onToggle && (
        <div className={cn("px-2 pb-2", collapsed ? "flex justify-center" : "")}>
          <button
            onClick={onToggle}
            className={cn(
              "flex items-center gap-2 rounded-lg text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-all",
              collapsed ? "p-2.5 justify-center" : "px-3 py-2 w-full"
            )}
          >
            <ChevronLeft className={cn(
              "w-4 h-4 shrink-0 transition-transform duration-300",
              collapsed && "rotate-180"
            )} />
            {!collapsed && <span>Collapse sidebar</span>}
          </button>
        </div>
      )}

      {/* ── Profile card ── */}
      {me && (
        <div id="tour-profile" className={cn("border-t border-border shrink-0", collapsed ? "p-2" : "p-3")}>
          {collapsed ? (
            <Tooltip delayDuration={0}>
              <TooltipTrigger asChild>
                <UserNav>
                  <button className="w-full flex justify-center outline-none py-1">
                    <div className="relative">
                      <Avatar className="h-9 w-9 cursor-pointer hover:ring-2 ring-indigo-500 ring-offset-1 ring-offset-background transition-all">
                        <AvatarImage src={avatarUrl} />
                        <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                          {displayName?.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-background rounded-full" />
                    </div>
                  </button>
                </UserNav>
              </TooltipTrigger>
              <TooltipContent side="right" sideOffset={6}>
                <p className="text-xs font-semibold">{displayName}</p>
                <p className="text-[11px] text-muted-foreground">Lv {me.level} · {me.xp} XP</p>
              </TooltipContent>
            </Tooltip>
          ) : (
            <>
              <UserNav>
                <button className="w-full text-left outline-none">
                  <div className="flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-muted transition-colors cursor-pointer group">
                    <div className="relative shrink-0">
                      <Avatar className="h-9 w-9">
                        <AvatarImage src={avatarUrl} />
                        <AvatarFallback className="text-xs bg-muted text-muted-foreground">
                          {displayName?.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-500 border-2 border-background rounded-full" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate leading-tight">{displayName}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {me.streakDays > 0 && (
                          <span className="text-xs text-orange-400 font-medium">🔥 {me.streakDays}d</span>
                        )}
                        <span className="text-xs text-indigo-400 font-medium flex items-center gap-0.5">
                          <Zap className="w-3 h-3" /> {me.xp}
                        </span>
                      </div>
                    </div>
                    <ChevronLeft className="w-4 h-4 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors shrink-0 rotate-180" />
                  </div>
                </button>
              </UserNav>
              <div className="px-2 mt-2.5">
                <div className="flex justify-between text-[11px] text-muted-foreground mb-1.5">
                  <span>Level {me.level}</span>
                  <span>{me.xp} / {me.xpForNextLevel} XP</span>
                </div>
                <div className="h-1 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, (me.xp / me.xpForNextLevel) * 100)}%` }}
                    transition={{ duration: 0.8, ease: "easeOut" }}
                    className="h-full bg-indigo-500 rounded-full"
                  />
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
