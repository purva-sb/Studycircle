import { useState, useEffect, useRef, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRoute, Link, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useGetFocusRoom,
  getGetFocusRoomQueryKey,
  useJoinFocusRoom,
  useListSubjects,
  useGetMe,
  customFetch,
} from "@workspace/api-client-react";
import { resolveAvatarUrl } from "@/lib/avatars";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import {
  Play, Lock, Unlock, MessageSquare, UserPlus, X,
  Headphones, CloudRain, LogOut, ExternalLink, Flame,
  Coffee, BookOpen, WifiOff, Share2, Copy, Check,
  Trophy, Zap, Timer, ArrowRight, Users, Clock,
  Music, Volume2, VolumeX, MoreVertical, ChevronDown, ChevronUp,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { slowDataQueryOptions, profileQueryOptions } from "@/lib/query-client";
import { io } from "socket.io-client";
import { useAuth, useUser } from "@clerk/clerk-react";
import { UserProfilePopover } from "@/components/user-profile-popover";
import { UserTierBadge, getTierAvatarRing, getTierInfo } from "@/components/ui/user-tier-badge";
import { AvatarWithAura } from "@/components/ui/avatar-with-aura";

type FocusStatus = "idle" | "studying" | "break" | "offline";

const MILESTONES = [
  { secs: 1800, emoji: "🔥", label: "30 min! Warming up!" },
  { secs: 3600, emoji: "🚀", label: "1 Hour! Great work!" },
  { secs: 7200, emoji: "💪", label: "2 Hours! Deep focus!" },
  { secs: 10800, emoji: "⚡", label: "3 Hours! You're on fire!" },
  { secs: 18000, emoji: "🏆", label: "5 Hours! Legendary!" },
  { secs: 36000, emoji: "👑", label: "10 Hours! ABSOLUTE MONSTER!" },
];

/** Local calendar date as "YYYY-MM-DD" (not UTC) so day boundaries match the user's clock. */
const localDateStr = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/* ════════════════════════════════════════════════════════
   DISCORD-STYLE INVITE MODAL
   ════════════════════════════════════════════════════════ */
function InviteModal({
  room,
  allCards,
  onClose,
}: {
  room: any;
  allCards: any[];
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const focusingNow = allCards.filter(
    (p) => p.status === "studying" || p.status === "focusing",
  );
  const onBreak = allCards.filter((p) => p.status === "break");
  const inviteUrl = `${window.location.origin}/focus-rooms/invite/${room.id}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return createPortal(
    <motion.div
      className="fixed inset-0 z-[10001] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)" }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      onClick={onClose}
    >
      <motion.div
        className="w-full max-w-sm mx-4 rounded-2xl overflow-hidden shadow-2xl"
        style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
        initial={{ scale: 0.8, y: 30, opacity: 0 }}
        animate={{ scale: 1, y: 0, opacity: 1 }}
        exit={{ scale: 0.85, y: 20, opacity: 0 }}
        transition={{ type: "spring", stiffness: 340, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Banner */}
        <div
          className="relative h-28 flex flex-col items-center justify-center overflow-hidden"
          style={{
            background:
              "linear-gradient(135deg, hsl(var(--primary)/0.9) 0%, hsl(262 83% 58%/0.9) 100%)",
          }}
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-3 right-3 w-7 h-7 rounded-full bg-black/30 hover:bg-black/50 flex items-center justify-center text-white/80 hover:text-white transition-all z-10"
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          </button>
          {/* Animated orbs */}
          {[...Array(3)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute rounded-full bg-white/10"
              style={{
                width: 80 + i * 40,
                height: 80 + i * 40,
                top: -20 + i * 10,
                right: -10 + i * 20,
              }}
              animate={{ scale: [1, 1.1, 1], opacity: [0.3, 0.5, 0.3] }}
              transition={{ duration: 3 + i, repeat: Infinity, delay: i * 0.5 }}
            />
          ))}
          <motion.div
            className="text-4xl mb-1"
            animate={{ y: [0, -4, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            🎯
          </motion.div>
          <div className="text-white font-black text-base px-4 text-center leading-tight">
            {room.name}
          </div>
          <div className="text-white/70 text-xs mt-0.5">{room.exam}</div>
        </div>

        {/* Body */}
        <div className="p-5">
          {/* Host info */}
          <div className="flex items-center gap-2 mb-4 bg-muted/40 rounded-xl px-3 py-2 border border-border">
            <Avatar className="w-7 h-7 border border-border">
              <AvatarImage src={room.hostAvatar} />
              <AvatarFallback className="text-[9px]">{room.hostName?.substring(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] text-muted-foreground">Hosted by</p>
              <p className="text-xs font-semibold text-foreground truncate">{room.hostName}</p>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-2 py-1 rounded-full">
              {room.mode === "silent" ? <span>🔇</span> : room.mode === "voice" ? <span>🎙️</span> : <span>🎥</span>}
              <span className="capitalize">{room.mode}</span>
            </div>
          </div>

          {/* Stats row */}
          <div className="grid grid-cols-3 gap-2 mb-5">
            {[
              {
                icon: <Flame className="w-4 h-4 text-primary" />,
                value: focusingNow.length,
                label: "Focusing",
                color: "bg-primary/10",
              },
              {
                icon: <Coffee className="w-4 h-4 text-amber-500" />,
                value: onBreak.length,
                label: "On Break",
                color: "bg-amber-500/10",
              },
              {
                icon: <Users className="w-4 h-4 text-muted-foreground" />,
                value: allCards.length,
                label: "Members",
                color: "bg-muted",
              },
            ].map((s) => (
              <div
                key={s.label}
                className={`flex flex-col items-center gap-1 py-2 px-1 rounded-xl ${s.color} border`}
              >
                {s.icon}
                <span className="text-lg font-black leading-none">{s.value}</span>
                <span className="text-[9px] text-muted-foreground font-medium uppercase tracking-wider">
                  {s.label}
                </span>
              </div>
            ))}
          </div>

          {/* Who's inside */}
          {focusingNow.length > 0 && (
            <div className="mb-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-semibold mb-2 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                Currently Focusing
              </p>
              <div className="flex items-center gap-1 flex-wrap">
                {focusingNow.slice(0, 7).map((p) => (
                  <div key={p.userId} className="relative group" title={p.displayName}>
                    <Avatar className="w-8 h-8 border-2 border-primary/40 shadow-sm">
                      <AvatarImage src={p.avatarUrl} />
                      <AvatarFallback
                        className="text-[9px] font-bold text-white"
                        style={{ background: `hsl(${(p.displayName?.charCodeAt(0) ?? 65) * 37 % 360}, 55%, 35%)` }}
                      >
                        {p.displayName?.substring(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-primary rounded-full border border-background" />
                  </div>
                ))}
                {focusingNow.length > 7 && (
                  <div className="w-8 h-8 rounded-full bg-muted border flex items-center justify-center text-[9px] font-bold text-muted-foreground">
                    +{focusingNow.length - 7}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Link copy */}
          <div className="flex items-center gap-2 bg-muted rounded-xl px-3 py-2 border mb-4">
            <span className="text-[10px] text-muted-foreground truncate flex-1">
              {inviteUrl}
            </span>
            <Button
              size="sm"
              onClick={handleCopy}
              className={`gap-1 h-7 text-xs shrink-0 transition-all duration-300 ${
                copied ? "bg-emerald-500 hover:bg-emerald-500 text-white" : ""
              }`}
            >
              {copied ? (
                <><Check className="w-3 h-3" /> Copied!</>
              ) : (
                <><Copy className="w-3 h-3" /> Copy Link</>
              )}
            </Button>
          </div>

          {/* CTA */}
          <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}>
            <Button
              className="w-full h-11 text-sm font-bold gap-2 rounded-xl shadow-lg"
              style={{
                background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(262 83% 58%) 100%)",
              }}
              onClick={async () => {
                if (navigator.share) {
                  try {
                    await navigator.share({
                      title: `Join my Focus Room on StudyCircle!`,
                      text: `Let's study together in the "${room.name}" focus room.`,
                      url: inviteUrl,
                    });
                    toast.success("Shared successfully! 🎉");
                  } catch (err: any) {
                    if (err.name !== 'AbortError') {
                      handleCopy();
                      toast.success("Link copied! Share it with your study partners 🎉");
                    }
                  }
                } else {
                  handleCopy();
                  toast.success("Link copied! Share it with your study partners 🎉");
                }
              }}
            >
              <Share2 className="w-4 h-4" /> Share Invite Link
              <ArrowRight className="w-4 h-4" />
            </Button>
          </motion.div>

          <p className="text-center text-[10px] text-muted-foreground mt-3">
            Anyone with the link can join this focus room
          </p>
        </div>
      </motion.div>
    </motion.div>,
    document.body,
  );
}

/* ════════════════════════════════════════════════════════
   MAIN COMPONENT
   ════════════════════════════════════════════════════════ */
export default function FocusRoomDetail() {
  const [, params] = useRoute("/focus-rooms/:id");
  const [, navigate] = useLocation();
  const roomId = params?.id || "";
  const { getToken } = useAuth();
  const { user } = useUser();

  const { data: room, isLoading } = useGetFocusRoom(roomId, {
    query: { enabled: !!roomId, queryKey: getGetFocusRoomQueryKey(roomId), ...slowDataQueryOptions },
  });

  const joinRoom = useJoinFocusRoom();
  const { data: subjects } = useListSubjects();
  const { data: myProfile } = useGetMe({ query: profileQueryOptions });
  const myAvatarUrl = resolveAvatarUrl(myProfile?.activeAvatarId, user?.imageUrl ?? "");
  const myAvatarUrlRef = useRef(myAvatarUrl);
  useEffect(() => { myAvatarUrlRef.current = myAvatarUrl; }, [myAvatarUrl]);
  const joinedRoomRef = useRef(false);

  // ── Today's study time (from server — single source of truth across rooms) ──
  // Sums all focus-mode study_sessions rows written today. Replaces the older
  // React-state-only `todayBaseSeconds` that reset to 0 on every room change.
  const queryClient = useQueryClient();
  const todayDate = localDateStr(); // local "YYYY-MM-DD"
  const { data: todayFocusStats } = useQuery<{ todayFocusSeconds: number }>({
    queryKey: ["my-focus-today", todayDate],
    queryFn:  () => customFetch(`/api/me/focus-stats/today?localDate=${todayDate}`),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnMount: "always", // every room mount forces a fresh read so timer never starts stale
  });
  const todayBaseSeconds = todayFocusStats?.todayFocusSeconds ?? 0;

  // ── Real DB today-totals for all room members ──
  // Fetched once per room mount so participant cards show accurate today time
  // instead of relying on stale socket broadcasts (which default to 0).
  const { data: memberStats } = useQuery<{ userId: string; todayFocusSeconds: number }[]>({
    queryKey: ["focus-member-stats", roomId, todayDate],
    queryFn: () => customFetch(`/api/focus/room-member-stats/${roomId}?localDate=${todayDate}`),
    enabled: !!roomId,
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // ── Local timer (standalone, never reads from participants) ──
  // Initialise from sessionStorage so the deep-focus overlay persists across
  // room switches (Wouter remounts the component on each navigation).
  // The flag is written immediately before calling navigate() and consumed here.
  const [localStatus, setLocalStatus] = useState<FocusStatus>(() => {
    if (typeof window === "undefined") return "idle";
    const carry = sessionStorage.getItem("focus_carry_status") as FocusStatus | null;
    sessionStorage.removeItem("focus_carry_status"); // consume once
    return (carry === "studying" || carry === "break") ? carry : "idle";
  });

  const [localSeconds, setLocalSeconds] = useState(0);

  const localSecondsRef = useRef(0);
  const localStatusRef = useRef<FocusStatus>("idle");
  const didRestoreRef = useRef(false);
  const sessionHydrated = useRef(false);
  const participantsBootstrapped = useRef(false);
  const breakRestoredRef = useRef(false);
  const roomNameRef = useRef<string>("");
  const resolveSubjectIdRef = useRef<() => string>(() => "s_dsa");
  const ambienceAudioRef = useRef<HTMLAudioElement | null>(null);

  const AMBIENCE_URLS: Record<"lofi" | "rain", string> = {
    lofi: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3",
    rain: "https://cdn.pixabay.com/download/audio/2021/08/09/audio_82ddf08a9f.mp3",
  };

  useEffect(() => {
    sessionHydrated.current = false;
    participantsBootstrapped.current = false;
    didRestoreRef.current = false;
    joinedRoomRef.current = false;
    breakRestoredRef.current = false;
    queryClient.invalidateQueries({ queryKey: ["my-focus-today", todayDate] });
    // Clear stale participants immediately — prevents old room's people from
    // leaking into the new room while the socket reconnects.
    setParticipants([]);
    participantStartTimes.current.clear();
    participantBaseSecs.current.clear();
    participantTodayBase.current.clear();
    // Reset session counter for the new room but keep studying/break status so
    // the user doesn't have to click "Start Focusing" again after switching rooms.
    setLocalSeconds(0);
    setLocalStatus((prev) => (prev === "studying" || prev === "break") ? prev : "idle");
  }, [roomId, queryClient, todayDate]);

  // ── Checkpoint loop: persist focus minutes every 60 s ────────────────────────
  //
  // Each checkpoint posts the delta since the last successful checkpoint so
  // switching rooms or browser refresh never loses time. After the first
  // successful checkpoint, the client emits `focus:session_saved` so the
  // server's disconnect-time autoSave doesn't double-count this session.
  const lastCheckpointRef = useRef(0);
  const checkpointedOnceRef = useRef(false);
  // Correct today total: DB base + only the un-checkpointed portion of the current session.
  // Without this, every checkpoint (which bumps todayBaseSeconds) double-counts the same
  // seconds that localSeconds is still counting.
  const todayLiveSeconds = todayBaseSeconds + Math.max(0, localSeconds - lastCheckpointRef.current);

  useEffect(() => {
    if (!roomId || !user?.id) return;
    lastCheckpointRef.current = 0;
    checkpointedOnceRef.current = false;

    // isFinal = true on unmount/room-switch: accepts any delta > 0 so sub-minute
    // time isn't silently dropped when the user switches rooms.
    const flush = async (isFinal = false) => {
      const delta = localSecondsRef.current - lastCheckpointRef.current;
      // Periodic flush: needs a full minute. Final flush (room switch/unmount): needs at
      // least 30 s — anything less isn't worth saving and would inflate today total by a
      // full minute due to server-side rounding (Math.round(5/60) → 0 → saved as 1 min).
      if (delta < (isFinal ? 30 : 60)) return;
      const dispatched = delta;
      lastCheckpointRef.current = localSecondsRef.current;

      // Optimistic cache: add exact seconds so the display is accurate until the server
      // refetch reconciles. Using Math.max(60,...) here caused the inflation — every tiny
      // flush added a full minute to the display even for 5 s of actual study.
      queryClient.setQueryData<{ todayFocusSeconds: number }>(
        ["my-focus-today", todayDate],
        (old) => ({ todayFocusSeconds: (old?.todayFocusSeconds ?? 0) + dispatched }),
      );

      try {
        await customFetch("/api/focus/checkpoint", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roomId, deltaSeconds: dispatched }),
        });
        if (!checkpointedOnceRef.current) {
          // Tell server to skip the disconnect-time autoSave — we're handling persistence ourselves
          socketRef.current?.emit?.("focus:session_saved", { roomId });
          checkpointedOnceRef.current = true;
        }
        // Reconcile with server total (in case other tabs/devices contributed)
        queryClient.invalidateQueries({ queryKey: ["my-focus-today", todayDate] });
      } catch {
        // Rollback optimistic cache + checkpoint pointer so the next interval retries
        queryClient.setQueryData<{ todayFocusSeconds: number }>(
          ["my-focus-today", todayDate],
          (old) => ({ todayFocusSeconds: Math.max(0, (old?.todayFocusSeconds ?? 0) - dispatched) }),
        );
        lastCheckpointRef.current = Math.max(0, lastCheckpointRef.current - dispatched);
      }
    };

    const intervalId = setInterval(() => {
      if (localStatusRef.current === "studying") void flush();
    }, 60_000);

    return () => {
      clearInterval(intervalId);
      // Final flush on unmount — saves even sub-minute time so room-switching never drops seconds
      void flush(true);
    };
  }, [roomId, user?.id, queryClient, todayDate]);

  useEffect(() => {
    localSecondsRef.current = localSeconds;
  }, [localSeconds]);

  useEffect(() => {
    localStatusRef.current = localStatus;
  }, [localStatus]);

  useEffect(() => {
    if (room?.name) roomNameRef.current = room.name;
  }, [room?.name]);

  // Re-hydrate timer from localStorage + API once per room visit
  useEffect(() => {
    if (!roomId || typeof window === "undefined" || sessionHydrated.current) return;
    const savedDate = localStorage.getItem(`focus_date_${roomId}`);
    const isToday = savedDate === todayDate;
    const savedTime = isToday ? localStorage.getItem(`focus_time_${roomId}`) : null;
    const savedStatus = (isToday ? localStorage.getItem(`focus_status_${roomId}`) : null) as FocusStatus | null;
    const savedBreak = isToday ? localStorage.getItem(`focus_break_${roomId}`) : null;
    // Only treat as "saved" when the user was actively studying or on break (not offline/idle)
    const isActiveState = savedStatus === "studying" || savedStatus === "break";
    const hasSaved = savedTime && parseInt(savedTime, 10) > 0 && isActiveState;
    const me = room?.participants?.find((p: { userId: string }) => p.userId === user?.id);
    if (!hasSaved && !(isToday && me?.totalStudySeconds && isActiveState)) return;

    sessionHydrated.current = true;
    let secs = savedTime ? parseInt(savedTime, 10) : 0;
    if (isToday && me?.totalStudySeconds && isActiveState) secs = Math.max(secs, me.totalStudySeconds);
    if (secs > 0) {
      setLocalSeconds(secs);
      // The DB (todayBaseSeconds) already includes checkpoints from this session.
      // Mark restored secs as pre-checkpointed so todayLiveSeconds = todayBaseSeconds + 0
      // initially, avoiding double-counting on reload.
      lastCheckpointRef.current = secs;
    }
    if (isActiveState && secs > 0) {
      setLocalStatus(savedStatus!);
    }
  }, [roomId, user?.id, room?.participants]);

  useEffect(() => {
    if (!roomId || !user?.id || joinedRoomRef.current) return;
    joinedRoomRef.current = true;
    joinRoom.mutate(
      {
        id: roomId,
        data: {
          displayName: user.fullName ?? user.username ?? "Anonymous",
          avatarUrl: myAvatarUrlRef.current,
        },
      },
      {
        onError: () => toast.error("Could not join this focus room"),
      },
    );
  }, [roomId, user?.id, user?.fullName, user?.username, user?.imageUrl, joinRoom]);

  useEffect(() => {
    if (!roomId || typeof window === "undefined") return;
    const save = () => {
      const status = localStatusRef.current;
      // Only save resumable states — never persist offline/idle so next visit starts fresh
      if (status === "studying" || status === "break") {
        localStorage.setItem(`focus_time_${roomId}`, String(localSecondsRef.current));
        localStorage.setItem(`focus_status_${roomId}`, status);
        localStorage.setItem(`focus_date_${roomId}`, localDateStr());
      }
    };
    window.addEventListener("beforeunload", save);
    return () => window.removeEventListener("beforeunload", save);
  }, [roomId]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const milestonesHit = useRef<Set<number>>(new Set());

  // ── Room state ──
  const [participants, setParticipants] = useState<any[]>([]);
  const [isChatLocked, setIsChatLocked] = useState(true);
  const [chatMessages, setChatMessages] = useState<{userId: string, text: string, time: number}[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [ambience, setAmbience] = useState<"none" | "lofi" | "rain">("none");
  const [task, setTask] = useState("");
  const [isTaskPrivate, setIsTaskPrivate] = useState(false);
  const [pendingInvites, setPendingInvites] = useState<any[]>([]);
  const [showInvite, setShowInvite] = useState(false);
  const [selectedGlobalRoom, setSelectedGlobalRoom] = useState("");
  const [myRooms, setMyRooms] = useState<Array<{ id: string; name: string; accentColor: string; exam: string }>>([]);
  const [peekData, setPeekData] = useState<{ roomId: string; participants: any[] } | null>(null);
  const [peekLoading, setPeekLoading] = useState(false);
  const [timerDisplay, setTimerDisplay] = useState<"session" | "today">("today");
  const [liveRooms, setLiveRooms] = useState<Array<{ roomId: string; roomName: string; accentColor: string; exam: string; participants: Array<{ userId: string; displayName: string; avatarUrl: string; totalStudySeconds: number }> }>>([]);
  const socketRef = useRef<any>(null);

  // ── Session summary ──
  const [showSessionSummary, setShowSessionSummary] = useState(false);
  const sessionStartSecondsRef = useRef(0);

  // ── Kick confirmation ──
  const [kickTarget, setKickTarget] = useState<{ userId: string; name: string } | null>(null);

  // ── Fullscreen exit confirmation ──
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // ── Floating chat window ──
  const [showChatWindow, setShowChatWindow] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const chatOpenRef = useRef(false);
  chatOpenRef.current = showChatWindow;

  // ── Emoji reactions ──
  type FloatingReaction = { id: string; emoji: string; fromName: string; x: number };
  const [floatingReactions, setFloatingReactions] = useState<FloatingReaction[]>([]);
  const reactionCooldown = useRef(false);

  // ── Break timer (ticks up during break) ──
  const [breakSeconds, setBreakSeconds] = useState(0);
  const breakTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startBreakTimer = useCallback(() => {
    if (breakTimerRef.current) clearInterval(breakTimerRef.current);
    setBreakSeconds(0);
    breakTimerRef.current = setInterval(() => setBreakSeconds((s) => s + 1), 1000);
  }, []);

  const stopBreakTimer = useCallback(() => {
    if (breakTimerRef.current) { clearInterval(breakTimerRef.current); breakTimerRef.current = null; }
  }, []);

  const resumeBreakTimer = useCallback(() => {
    if (breakTimerRef.current) clearInterval(breakTimerRef.current);
    breakTimerRef.current = setInterval(() => setBreakSeconds((s) => s + 1), 1000);
  }, []);

  useEffect(() => {
    if (!roomId || breakRestoredRef.current || localStatus !== "break") return;
    const savedBreak = localStorage.getItem(`focus_break_${roomId}`);
    if (!savedBreak) return;
    const b = parseInt(savedBreak, 10);
    if (b > 0) {
      breakRestoredRef.current = true;
      setBreakSeconds(b);
      resumeBreakTimer();
    }
  }, [roomId, localStatus, resumeBreakTimer]);

  useEffect(() => {
    if (typeof window !== "undefined" && roomId) {
      localStorage.setItem(`focus_time_${roomId}`, localSeconds.toString());
      localStorage.setItem(`focus_status_${roomId}`, localStatus);
      localStorage.setItem(`focus_date_${roomId}`, localDateStr());
      if (breakSeconds > 0) {
        localStorage.setItem(`focus_break_${roomId}`, breakSeconds.toString());
      }
    }
  }, [localSeconds, localStatus, breakSeconds, roomId]);

  useEffect(() => {
    if (ambience === "none") {
      ambienceAudioRef.current?.pause();
      return;
    }
    // Stop music player so ambience and music never overlap
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
      setMusicPlaying(false);
      setMusicTrack(null);
    }
    const url = AMBIENCE_URLS[ambience];
    if (!ambienceAudioRef.current) ambienceAudioRef.current = new Audio();
    ambienceAudioRef.current.src = url;
    ambienceAudioRef.current.loop = true;
    ambienceAudioRef.current.volume = 0.35;
    ambienceAudioRef.current.play().catch(() => {});
    return () => {
      ambienceAudioRef.current?.pause();
    };
  }, [ambience]);

  useEffect(() => () => { if (breakTimerRef.current) clearInterval(breakTimerRef.current); }, []);

  // 🎵 Study Music Player 🎵
  const MUSIC_TRACKS = [
    { id: "lofi", label: "Lo-Fi Beats", emoji: "🎧", url: "https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3" },
    { id: "rain", label: "Rain Sounds", emoji: "🌧️", url: "https://cdn.pixabay.com/download/audio/2021/08/09/audio_82ddf08a9f.mp3" },
    { id: "cafe", label: "Café Ambience", emoji: "☕", url: "https://cdn.pixabay.com/download/audio/2022/11/22/audio_fbbea3f350.mp3" },
  ];
  const [musicTrack, setMusicTrack] = useState<string | null>(null);
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicMuted, setMusicMuted] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Track when each participant last started focusing (for client-side ticking)
  const participantStartTimes = useRef<Map<string, number>>(new Map());
  const participantBaseSecs = useRef<Map<string, number>>(new Map());
  // Tracks today's DB base for each participant so tick can update todayStudySeconds live
  const participantTodayBase = useRef<Map<string, number>>(new Map());
  // Debounce "offline" broadcasts so brief disconnects don't flash the status
  const pendingOfflineTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Fetch all rooms this user has joined (for pill navigation)
  useEffect(() => {
    customFetch<Array<{ id: string; name: string; accentColor: string; exam: string }>>("/api/focus-rooms/my-rooms")
      .then((data) => setMyRooms(Array.isArray(data) ? data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!room?.participants || !roomId) return;
    setIsChatLocked(room.isChatEnabled === false);
    // Guard by roomId (not a boolean) so stale cache from a previous room can't
    // bootstrap the new room and then block the correct data when it arrives.
    if (participantsBootstrapped.current) return;
    // Only bootstrap once REST data matches the currently viewed room
    // (room.id comes from the query response — if it differs, data is still stale)
    if ((room as any).id && (room as any).id !== roomId) return;
    participantsBootstrapped.current = true;
    const others = dedup(
      room.participants.filter((p: { userId: string }) => p.userId !== user?.id)
    );
    setParticipants(others);
    const now = Date.now();
    others.forEach((p: any) => {
      if (p.status === "studying" || p.status === "focusing") {
        participantStartTimes.current.set(p.userId, p.lastStatusChangeAt || now);
        participantBaseSecs.current.set(p.userId, p.totalStudySeconds || 0);
        participantTodayBase.current.set(p.userId, p.todayStudySeconds ?? 0);
      }
    });
  }, [room?.participants, room, roomId, user?.id]);

  // Merge real DB today totals into participant state once memberStats loads.
  // This overwrites the socket-broadcast todayStudySeconds (which defaults to 0
  // for members who haven't changed status since you joined).
  useEffect(() => {
    if (!memberStats?.length) return;
    const statsMap = new Map(memberStats.map((s) => [s.userId, s.todayFocusSeconds]));
    setParticipants((prev) =>
      prev.map((p) => {
        const dbTotal = statsMap.get(p.userId);
        if (dbTotal === undefined) return p;
        // DB total is authoritative. Recalibrate the live-today formula by re-snapshotting
        // both refs at the current session position so today_live = dbTotal + elapsed.
        if (p.status === "studying" || p.status === "focusing") {
          participantTodayBase.current.set(p.userId, dbTotal);
          participantBaseSecs.current.set(p.userId, p.totalStudySeconds ?? 0);
        }
        return { ...p, todayStudySeconds: dbTotal };
      }),
    );
  }, [memberStats]);

  // ── Timer ──
  const startTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setLocalSeconds((s) => {
        const next = s + 1;
        const m = MILESTONES.find((ms) => ms.secs === next);
        if (m && !milestonesHit.current.has(next)) {
          milestonesHit.current.add(next);
          toast(`${m.emoji} ${m.label}`, {
            duration: 5000,
            style: { background: "hsl(var(--primary))", color: "white", fontWeight: "bold" },
          });
        }
        return next;
      });
    }, 1000);
  }, []);

  const pauseTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  // Tick others — ONLY tick participants we have an explicit start time for
  // This prevents auto-ticking when user first logs in
  useEffect(() => {
    const id = setInterval(() => {
      setParticipants((prev) =>
        prev.map((p) => {
          if (p.status === "studying" || p.status === "focusing") {
            const startTime = participantStartTimes.current.get(p.userId);
            if (!startTime) {
              // No recorded start time = we don't know when they started, don't tick
              return p;
            }
            const baseSeconds = participantBaseSecs.current.get(p.userId) ?? (p.totalStudySeconds || 0);
            const elapsed = Math.floor((Date.now() - startTime) / 1000);
            // Only tick the session timer. todayStudySeconds is updated from socket broadcasts
            // and memberStats DB queries — ticking it here causes double-counting.
            return { ...p, totalStudySeconds: baseSeconds + elapsed };
          }
          return p;
        }),
      );
    }, 1000);
    return () => clearInterval(id);
  }, []);

  // Show queued invites on break
  useEffect(() => {
    if (localStatus === "break" && pendingInvites.length > 0) {
      pendingInvites.forEach((inv) =>
        toast(`${inv.name} wants to connect! 🤝`, {
          action: { label: "Accept", onClick: () => toast.success(`Connected! 🎉`) },
        }),
      );
      setPendingInvites([]);
    }
  }, [localStatus, pendingInvites]);

  const overlayRef = useRef<HTMLDivElement | null>(null);

  const broadcast = useCallback(
    (status: string, seconds?: number) => {
      const secs = seconds ?? localSecondsRef.current;
      socketRef.current?.emit("focus:status_change", {
        roomId,
        status,
        totalStudySeconds: secs,
        todayStudySeconds: todayBaseSeconds + Math.max(0, secs - lastCheckpointRef.current),
      });
    },
    [roomId, todayBaseSeconds],
  );
  const broadcastRef = useRef(broadcast);
  broadcastRef.current = broadcast;

  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  const dedup = (list: any[]) => {
    const seen = new Set<string>();
    return list.filter((p) => { if (seen.has(p.userId)) return false; seen.add(p.userId); return true; });
  };

  const applyRoomParticipants = useCallback((list: any[]) => {
    const now = Date.now();
    const clean = dedup(list.filter((p) => p.userId !== user?.id));
    setParticipants((prev) => {
      // MERGE instead of replace: update live participants' status but keep offline
      // members visible (marked offline) so the grid never goes empty just because
      // someone isn't currently socket-connected.
      const socketMap = new Map(clean.map(p => [p.userId, p]));
      const updated = prev.map(p => {
        const liveP = socketMap.get(p.userId);
        if (liveP) {
          socketMap.delete(p.userId);
          return { ...p, ...liveP, todayStudySeconds: liveP.todayStudySeconds ?? p.todayStudySeconds ?? 0 };
        }
        // Not in socket snapshot → mark offline but keep the card
        return { ...p, status: "offline" };
      });
      // Add anyone in the socket list who wasn't in the bootstrap (joined later)
      const additions = [...socketMap.values()].map(p => ({ ...p, todayStudySeconds: p.todayStudySeconds ?? 0 }));
      return [...updated, ...additions];
    });
    clean.forEach((p) => {
      if (p.status === "studying" || p.status === "focusing") {
        participantStartTimes.current.set(p.userId, p.lastStatusChangeAt ?? now);
        participantBaseSecs.current.set(p.userId, p.totalStudySeconds ?? 0);
        participantTodayBase.current.set(p.userId, p.todayStudySeconds ?? 0);
      }
    });
  }, [user?.id]);
  const applyRoomParticipantsRef = useRef(applyRoomParticipants);
  applyRoomParticipantsRef.current = applyRoomParticipants;

  // ── Socket ──
  useEffect(() => {
    let socket: any = null;
    let aborted = false;
    const connect = async () => {
      const token = await getTokenRef.current();
      if (!token || aborted) return;
      socket = io(window.location.origin, { path: "/socket.io", auth: { token }, transports: ["websocket"] });
      socketRef.current = socket;

      const joinAndSync = () => {
        const status = localStatusRef.current;
        const secs = localSecondsRef.current;
        socket.emit("join_focus_room", {
          roomId,
          user: {
            userId: user?.id,
            displayName: user?.fullName ?? user?.username ?? "Anonymous",
            avatarUrl: myAvatarUrlRef.current,
            status: status === "idle" ? "idle" : status,
            totalStudySeconds: secs,
            lastStatusChangeAt: (status === "studying" || status === "break") ? Date.now() : undefined,
          },
        });
        // Broadcast status to the new room so peers see the correct state immediately.
        // secs=0 is fine here — it's a fresh session in this room, not a stale pre-hydration value.
        if (status === "studying" || status === "break") {
          broadcastRef.current(status, secs);
        }
        // Auto-start timer when carrying over studying status into a new room (secs=0)
        // or restoring a session from localStorage/store (secs>0).
        if (!didRestoreRef.current && status === "studying") {
          didRestoreRef.current = true;
          startTimer();
        }
      };

      socket.on("connect", () => {
        joinAndSync();
        socket.emit("global:subscribe_rooms");
      });
      socket.on("global:rooms_activity", ({ rooms: active }: { rooms: any[] }) => {
        setLiveRooms(active.filter((r: any) => r.roomId !== roomId));
      });
      socket.on("focus:room_state", ({ participants: list }: { participants: any[] }) => {
        // Always apply — even an empty list must clear stale participants from the previous room
        applyRoomParticipantsRef.current(list ?? []);
      });
      socket.on("focus:user_joined", (newParticipant: any) => {
        // Cancel any pending offline transition — they rejoined before the debounce fired
        const pending = pendingOfflineTimers.current.get(newParticipant.userId);
        if (pending) { clearTimeout(pending); pendingOfflineTimers.current.delete(newParticipant.userId); }

        // Always update timer refs on every join/rejoin (not just for new participants).
        // Without this, reconnecting users who were previously marked offline never restart
        // ticking because participantStartTimes was deleted on the offline event.
        if (newParticipant.status === "studying" || newParticipant.status === "focusing") {
          const startTime = newParticipant.lastStatusChangeAt ?? Date.now();
          participantStartTimes.current.set(newParticipant.userId, startTime);
          participantBaseSecs.current.set(newParticipant.userId, newParticipant.totalStudySeconds ?? 0);
          participantTodayBase.current.set(newParticipant.userId, newParticipant.todayStudySeconds ?? 0);
        }

        setParticipants((prev) => {
          if (prev.some((p) => p.userId === newParticipant.userId)) {
            return prev.map((p) =>
              p.userId === newParticipant.userId ? { ...p, ...newParticipant } : p,
            );
          }
          return dedup([...prev, newParticipant]);
        });
      });
      socket.on("focus:status_change", ({ userId, status, totalStudySeconds, todayStudySeconds, lastStatusChangeAt }: any) => {
        if (userId === user?.id) return;

        // Any non-offline event cancels a pending offline transition
        if (status !== "offline") {
          const pending = pendingOfflineTimers.current.get(userId);
          if (pending) { clearTimeout(pending); pendingOfflineTimers.current.delete(userId); }
        }

        if (status === "offline") {
          // Debounce: absorb brief reconnects before flipping to offline
          const existing = pendingOfflineTimers.current.get(userId);
          if (existing) clearTimeout(existing);
          const t = setTimeout(() => {
            pendingOfflineTimers.current.delete(userId);
            participantStartTimes.current.delete(userId);
            participantTodayBase.current.delete(userId);
            setParticipants((prev) => prev.map((p) => {
              if (p.userId !== userId) return p;
              return { ...p, status: "offline" };
            }));
          }, 3000);
          pendingOfflineTimers.current.set(userId, t);
          return;
        }

        setParticipants((prev) => prev.map((p) => {
          if (p.userId !== userId) return p;
          const updated = { ...p, status };
          if (todayStudySeconds !== undefined) updated.todayStudySeconds = todayStudySeconds;
          if (status === "studying" || status === "focusing") {
            const startTime = lastStatusChangeAt ?? Date.now();
            participantStartTimes.current.set(userId, startTime);
            // Always update both refs together so the live today formula stays in sync:
            // todayLive = participantTodayBase + (p.totalStudySeconds - participantBaseSecs)
            participantBaseSecs.current.set(userId, totalStudySeconds ?? p.totalStudySeconds ?? 0);
            participantTodayBase.current.set(userId, todayStudySeconds ?? p.todayStudySeconds ?? 0);
          } else {
            participantStartTimes.current.delete(userId);
            participantTodayBase.current.delete(userId);
            if (totalStudySeconds !== undefined) updated.totalStudySeconds = totalStudySeconds;
            if (todayStudySeconds !== undefined) updated.todayStudySeconds = todayStudySeconds;
          }
          return updated;
        }));
      });
      socket.on("global:user_status", ({ userId, status, totalStudySeconds, todayStudySeconds }: any) => {
        if (userId === user?.id) return;

        if (status !== "offline") {
          const pending = pendingOfflineTimers.current.get(userId);
          if (pending) { clearTimeout(pending); pendingOfflineTimers.current.delete(userId); }
        }

        if (status === "offline") {
          const existing = pendingOfflineTimers.current.get(userId);
          if (existing) clearTimeout(existing);
          const t = setTimeout(() => {
            pendingOfflineTimers.current.delete(userId);
            participantStartTimes.current.delete(userId);
            participantTodayBase.current.delete(userId);
            setParticipants((prev) => prev.map((p) =>
              p.userId === userId ? { ...p, status: "offline" } : p
            ));
          }, 3000);
          pendingOfflineTimers.current.set(userId, t);
          return;
        }

        setParticipants((prev) => {
          if (!prev.some((p) => p.userId === userId)) return prev; // not a member of this room
          return prev.map((p) => {
            if (p.userId !== userId) return p;
            const updated: any = { ...p, status };
            if (totalStudySeconds !== undefined) updated.totalStudySeconds = totalStudySeconds;
            if (todayStudySeconds !== undefined) updated.todayStudySeconds = todayStudySeconds;
            if (status === "studying" || status === "focusing") {
              // Use Date.now() as the tick baseline — totalStudySeconds is the current accumulated total,
              // so the tick loop correctly computes: totalStudySeconds + elapsed_since_this_broadcast
              participantStartTimes.current.set(userId, Date.now());
              participantBaseSecs.current.set(userId, totalStudySeconds ?? p.totalStudySeconds ?? 0);
              participantTodayBase.current.set(userId, todayStudySeconds ?? p.todayStudySeconds ?? 0);
            } else {
              participantStartTimes.current.delete(userId);
              participantTodayBase.current.delete(userId);
            }
            return updated;
          });
        });
      });
      socket.on("focus:task_update", ({ userId, task: t, isPrivate }: any) =>
        setParticipants((prev) =>
          prev.map((p) => (p.userId === userId ? { ...p, currentTask: t, isTaskPrivate: isPrivate } : p)),
        ),
      );
      socket.on("focus:toggle_chat", ({ isEnabled }: any) => {
        setIsChatLocked(!isEnabled);
        toast.info(`Chat ${isEnabled ? "unlocked 🔓" : "locked 🔒"}`);
      });
      socket.on("focus:chat_message", (msg: any) => {
        setChatMessages((prev) => [...prev, { userId: msg.userId, text: msg.text, time: msg.timestamp }]);
        if (!chatOpenRef.current) setUnreadCount((n) => n + 1);
      });
      socket.on("focus:connect_request", ({ fromUserId, fromName }: any) => {
        setPendingInvites((prev) => [
          ...prev,
          { fromUserId, name: fromName ?? "Someone" },
        ]);
      });
      socket.on("focus:reaction_received", ({ id, emoji, fromName }: any) => {
        const x = 10 + Math.random() * 80;
        setFloatingReactions((prev) => [...prev, { id, emoji, fromName, x }]);
        setTimeout(() => setFloatingReactions((prev) => prev.filter((r) => r.id !== id)), 2500);
      });
      socket.on("focus:kicked", ({ roomId: kickedRoomId }: any) => {
        if (kickedRoomId === roomId) {
          toast.error("You were removed from the room by the host.");
          navigate("/focus-rooms");
        }
      });
      socket.on("focus:muted", ({ roomId: mutedRoomId }: any) => {
        if (mutedRoomId === roomId) {
          toast.info("You were muted by the host.");
        }
      });
      socket.on("focus:unmuted", ({ roomId: unmutedRoomId }: any) => {
        if (unmutedRoomId === roomId) {
          toast.info("You were unmuted by the host.");
        }
      });
      socket.on("focus:participant_mic_change", ({ userId, micOn: newMicOn }: any) => {
        setParticipants((prev) =>
          prev.map((p) => (p.userId === userId ? { ...p, micOn: newMicOn } : p))
        );
      });
      socket.on("focus:error", ({ message }: { message: string }) => {
        toast.error(message);
      });
      socket.on("reconnect", () => {
        joinAndSync();
      });
    };
    if (roomId && user?.id) connect();
    return () => {
      aborted = true;
      if (socket) {
        socket.emit("leave_focus_room", roomId);
        socket.disconnect();
      }
    };
  }, [roomId, user?.id]);

  // Sync focus seconds to server while studying (survives refresh via DB + store)
  useEffect(() => {
    if (localStatus !== "studying" || !roomId) return;
    const id = setInterval(() => broadcast("studying", localSecondsRef.current), 30_000);
    return () => clearInterval(id);
  }, [localStatus, roomId, broadcast]);

  // ── Actions ──

  const handleStart = () => {
    const el = overlayRef.current ?? document.documentElement;
    el.requestFullscreen?.().catch(() => {});
    setLocalStatus("studying");
    startTimer();
    broadcast("studying");
    toast("🚀 Focus mode on! Let's get it!", { duration: 2000 });
  };

  const handleBreak = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    setLocalStatus("break");
    pauseTimer();
    startBreakTimer();
    broadcast("break");
    toast("☕ Break time! Hydrate & stretch.", { duration: 3000 });
  };

  const handleResume = () => {
    document.documentElement.requestFullscreen?.().catch(() => {});
    setLocalStatus("studying");
    stopBreakTimer();
    startTimer();
    broadcast("studying");
    toast("🔥 Back to grind!", { duration: 1500 });
  };

  const handleOffline = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    setLocalStatus("offline");
    pauseTimer();
    broadcast("offline");
    // Immediately clear persisted state — next room visit must start fresh
    if (typeof window !== "undefined" && roomId) {
      localStorage.removeItem(`focus_time_${roomId}`);
      localStorage.removeItem(`focus_status_${roomId}`);
      localStorage.removeItem(`focus_date_${roomId}`);
      localStorage.removeItem(`focus_break_${roomId}`);
    }
  };

  const handleComeBack = () => {
    setLocalStatus("idle");
    broadcast("idle");
  };

  const resolveSubjectId = () => {
    const exam = room?.exam?.toLowerCase() ?? "";
    const match = subjects?.find(
      (s: { id: string; name?: string }) =>
        s.name?.toLowerCase().includes(exam) || exam.includes(s.name?.toLowerCase() ?? ""),
    );
    return match?.id ?? subjects?.[0]?.id ?? "s_dsa";
  };
  useEffect(() => { resolveSubjectIdRef.current = resolveSubjectId; });

  const handleLeave = () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    pauseTimer();
    stopBreakTimer();
    sessionStartSecondsRef.current = localSeconds;
    setShowSessionSummary(true);
  };

  const confirmLeave = async () => {
    setShowSessionSummary(false);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }

    if (typeof window !== "undefined" && roomId) {
      localStorage.removeItem(`focus_time_${roomId}`);
      localStorage.removeItem(`focus_status_${roomId}`);
      localStorage.removeItem(`focus_break_${roomId}`);
    }

    try {
      await customFetch(`/focus-rooms/${roomId}/leave`, { method: "POST" });
    } catch {
      /* still navigate away */
    }

    if (localSeconds >= 60) {
      const mins = Math.max(1, Math.round(localSeconds / 60));
      customFetch("/api/focus/checkpoint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, deltaSeconds: localSeconds }),
      }).then((res: { saved: boolean; newStreakDays?: number }) => {
        const streak = res?.newStreakDays ?? 0;
        const milestones = [3, 7, 14, 30, 50, 100];
        if (milestones.includes(streak)) {
          toast.success(`🔥 ${streak}-day streak! Keep it up!`, { duration: 5000 });
        } else {
          toast.success(`✅ ${mins}m saved!${streak > 0 ? ` ${streak}-day streak 🔥` : ""}`);
        }
      }).catch(() => {
        toast.success(`✅ ${mins}m session saved!`);
      });
    }

    // Post activity milestone to linked circle (5h or 9h crossed today)
    if (room?.linkedCircleId && roomId) {
      const todayTotalMins = Math.floor((todayLiveSeconds) / 60);
      const postedKey = `circle_milestones_${localDateStr()}`;
      const posted = new Set((localStorage.getItem(postedKey) || "").split(",").filter(Boolean));
      let milestone: number | null = null;
      if (todayTotalMins >= 540 && !posted.has("9")) milestone = 9;
      else if (todayTotalMins >= 300 && !posted.has("5")) milestone = 5;
      if (milestone !== null) {
        posted.add(String(milestone));
        localStorage.setItem(postedKey, [...posted].join(","));
        customFetch(`/focus-rooms/${roomId}/post-activity`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ milestone }),
        }).catch(() => {});
      }
    }

    navigate("/focus-rooms");
  };

  const handleConnect = (targetUserId: string, targetName: string) => {
    socketRef.current?.emit("focus:connect_request", {
      roomId,
      targetUserId,
      fromName: user?.fullName ?? user?.username ?? "Anonymous",
    });
    toast.success(`Queued for ${targetName}'s next break!`);
  };

  const sendReaction = (emoji: string) => {
    if (reactionCooldown.current) return;
    socketRef.current?.emit("focus:reaction", { roomId, emoji });
    reactionCooldown.current = true;
    setTimeout(() => { reactionCooldown.current = false; }, 2000);
  };

  const handleKick = (targetUserId: string) => {
    socketRef.current?.emit("focus:kick_participant", { roomId, targetUserId });
  };

  const handleMute = (targetUserId: string) => {
    socketRef.current?.emit("focus:mute_participant", { roomId, targetUserId });
  };

  const handleUnmute = (targetUserId: string) => {
    socketRef.current?.emit("focus:unmute_participant", { roomId, targetUserId });
  };

  const handleSendMessage = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && chatInput.trim() && !isChatLocked) {
      socketRef.current?.emit("focus:chat_message", { roomId, text: chatInput.trim() });
      setChatInput("");
    }
  };

  const chatAuthorName = (userId: string) => {
    if (userId === user?.id) return "You";
    const p = participants.find((x) => x.userId === userId);
    return p?.displayName ?? "Partner";
  };

  const renderChatMessages = () => {
    if (chatMessages.length === 0) {
      return (
        <div className="text-xs text-center text-muted-foreground py-6 border border-dashed rounded-lg">
          Deep Focus Zone 🎯<br />
          Chat is {isChatLocked ? "locked 🔒" : "open 💬"}
        </div>
      );
    }
    return (
      <div className="flex flex-col gap-2">
        {chatMessages.map((msg) => (
          <div
            key={`${msg.time}-${msg.userId}-${msg.text.slice(0, 8)}`}
            className={`text-xs rounded-lg px-2.5 py-2 ${
              msg.userId === user?.id ? "bg-primary/15 ml-4" : "bg-muted/60 mr-4"
            }`}
          >
            <span className="font-semibold text-[10px] text-muted-foreground block mb-0.5">
              {chatAuthorName(msg.userId)}
            </span>
            <span className="break-words">{msg.text}</span>
          </div>
        ))}
      </div>
    );
  };

  const updateTask = (newTask: string, isPrivate: boolean) => {
    setTask(newTask);
    setIsTaskPrivate(isPrivate);
  };

  // Debounce task broadcasts — skip the initial mount (empty task) to avoid a pointless emit
  const taskDirtyRef = useRef(false);
  useEffect(() => {
    if (!taskDirtyRef.current) {
      taskDirtyRef.current = true;
      return;
    }
    const timer = setTimeout(() => {
      if (socketRef.current) {
        socketRef.current.emit("focus:task_update", { roomId, task, isPrivate: isTaskPrivate });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [task, isTaskPrivate, roomId]);

  // ── Helpers ──
  const formatTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0)
      return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const formatTodayTime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    if (h > 0) return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const getTier = (s: number) =>
    s >= 36000 ? 4 : s >= 25200 ? 3 : s >= 10800 ? 2 : 1;

  const statusColor = (status: string) =>
    status === "studying" || status === "focusing"
      ? "bg-primary"
      : status === "break"
      ? "bg-amber-500"
      : "bg-muted-foreground/30";

  const statusLabel = (status: string) =>
    status === "studying" || status === "focusing"
      ? "Focusing"
      : status === "break"
      ? "Break"
      : status === "offline"
      ? "Offline"
      : "Ready";

  // ── Build participant grid ──
  const myCard = {
    userId: user?.id ?? "me",
    displayName: user?.fullName ?? user?.username ?? "You",
    avatarUrl: myAvatarUrl,
    status: localStatus === "idle" ? "idle" : localStatus,
    totalStudySeconds: localSeconds,
    todayStudySeconds: todayLiveSeconds,
    isSelf: true,
    currentTask: task || undefined,
    isTaskPrivate,
  };

  const others = dedup([...participants]).filter((p) => p.userId !== user?.id);

  const allCards = [myCard, ...others].sort(
    (a, b) => (b.todayStudySeconds || 0) - (a.todayStudySeconds || 0)
  );

  const isModOrOwner =
    !!(room as { hostId?: string })?.hostId && (room as { hostId?: string }).hostId === user?.id;
  const isStudying = localStatus === "studying";

  // Deduped switchable rooms for the fullscreen "Switch Room" dropdown
  const switchableRooms = (() => {
    const others = myRooms.filter((r) => r.id !== roomId);
    const nameCount = new Map<string, number>();
    others.forEach((r) => nameCount.set(r.name, (nameCount.get(r.name) ?? 0) + 1));
    const seen = new Set<string>();
    return others
      .map((r) => ({
        id: r.id,
        label: nameCount.get(r.name)! > 1 && r.exam ? `${r.name} · ${r.exam}` : r.name,
      }))
      .filter((r) => { if (seen.has(r.label)) return false; seen.add(r.label); return true; });
  })();

  const globalStudiers = (() => {
    const currentActive = allCards
      .filter((p) => p.status !== "offline" && p.status !== "idle")
      .map((p) => ({ ...p, roomName: room?.name ?? "", roomId: roomId ?? "" }));
    const otherStudiers = liveRooms.flatMap((lr) =>
      lr.participants.map((p) => ({ ...p, roomName: lr.roomName, roomId: lr.roomId, isSelf: p.userId === user?.id }))
    );
    const seen = new Set<string>();
    return [...currentActive, ...otherStudiers]
      .filter((p) => { if (seen.has(p.userId)) return false; seen.add(p.userId); return true; })
      .sort((a, b) => (b.totalStudySeconds || 0) - (a.totalStudySeconds || 0));
  })();

  const globalRankMap = new Map<string, number>();
  globalStudiers.forEach((p, idx) => globalRankMap.set(p.userId, idx + 1));

  // True when people are studying in other rooms (drives the green "live elsewhere" dot)
  const hasOtherRoomStudiers = liveRooms.some((lr) => lr.participants.length > 0);

  const fetchPeekData = (targetRoomId: string) => {
    if (peekData?.roomId === targetRoomId) return;
    setPeekLoading(true);
    customFetch<any>(`/api/focus-rooms/${targetRoomId}`)
      .then((data) => {
        const sorted = [...(data.participants ?? [])].sort(
          (a: any, b: any) => (b.todayStudySeconds ?? 0) - (a.todayStudySeconds ?? 0)
        );
        setPeekData({ roomId: targetRoomId, participants: sorted });
      })
      .catch(() => setPeekData({ roomId: targetRoomId, participants: [] }))
      .finally(() => setPeekLoading(false));
  };

  const renderGroupedGlobalView = (dark = false) => {
    // Pills: This Room first, then all other joined rooms (deduped by room ID)
    const otherRooms = myRooms.filter((r) => r.id !== roomId);
    // Find names that appear more than once so we can add exam suffix to distinguish
    const nameCount = new Map<string, number>();
    otherRooms.forEach((r) => nameCount.set(r.name, (nameCount.get(r.name) ?? 0) + 1));
    const pills = [
      { id: roomId ?? "", name: room?.name ?? "", isOwn: true },
      ...otherRooms.map((r) => ({
        id: r.id,
        name: nameCount.get(r.name)! > 1 && r.exam ? `${r.name} · ${r.exam}` : r.name,
        isOwn: false,
      })),
    ];
    const showPills = pills.length > 1;
    const activeId = pills.find((p) => p.id === selectedGlobalRoom)?.id ?? (roomId ?? "");
    const activePill = pills.find((p) => p.id === activeId) ?? pills[0];

    // Live counts from socket (for non-own rooms)
    const liveCountMap = new Map(liveRooms.map((lr) => [lr.roomId, lr.participants.length]));

    const handlePillClick = (pill: { id: string; isOwn: boolean }) => {
      setSelectedGlobalRoom(pill.id);
      if (!pill.isOwn) {
        if (dark) {
          // Fullscreen: peek inline
          fetchPeekData(pill.id);
        } else {
          // Normal view: navigate to room
          navigate(`/focus-rooms/${pill.id}`);
        }
      }
    };

    // Cards to show for selected pill
    const renderCards = () => {
      if (activePill.isOwn) {
        return (
          <div className={`grid gap-3 ${dark ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"}`}>
            <AnimatePresence mode="popLayout">
              {allCards.map((p, idx) => renderParticipantCard(p, idx, dark))}
            </AnimatePresence>
          </div>
        );
      }
      // Non-own room: peek data (fullscreen) or empty (normal navigates away)
      if (peekLoading) {
        return (
          <div className="flex items-center justify-center py-12">
            <div className={`text-xs ${dark ? "text-white/30" : "text-muted-foreground"}`}>Loading...</div>
          </div>
        );
      }
      const rawPeekParticipants = peekData?.roomId === activeId ? peekData.participants : [];
      // Inject current user's live card — they're a member of this room but connected
      // via socket to a different room, so they won't appear in the API response.
      const isActiveUser = localStatus !== "idle" && localStatus !== "offline";
      const peekParticipants = isActiveUser
        ? [myCard, ...rawPeekParticipants.filter((p: any) => p.userId !== user?.id)]
        : rawPeekParticipants.filter((p: any) => p.userId !== user?.id);
      if (peekParticipants.length === 0) {
        return (
          <p className={`text-center text-sm py-8 ${dark ? "text-white/30" : "text-muted-foreground"}`}>
            No one is studying there right now.
          </p>
        );
      }
      return (
        <div className={`grid gap-3 ${dark ? "grid-cols-3 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5"}`}>
          <AnimatePresence mode="popLayout">
            {peekParticipants.map((p: any, idx: number) =>
              renderCrossRoomCard({ ...p, roomId: activeId, roomName: activePill.name, isSelf: p.userId === user?.id }, idx + 1, idx)
            )}
          </AnimatePresence>
        </div>
      );
    };

    return (
      <div className="flex flex-col gap-4">
        {showPills && !dark && (
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {pills.map((pill) => {
              const liveCount = pill.isOwn
                ? allCards.filter((p) => p.status !== "offline" && p.status !== "idle").length
                : liveCountMap.get(pill.id) ?? 0;
              return (
                <button
                  key={pill.id}
                  onClick={() => handlePillClick(pill)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all shrink-0 ${
                    activeId === pill.id
                      ? "bg-primary text-primary-foreground shadow-md"
                      : dark
                        ? "bg-white/10 text-white/60 hover:bg-white/15"
                        : "bg-muted text-muted-foreground hover:bg-muted/80"
                  }`}
                >
                  {pill.isOwn ? "🏠 " : ""}{pill.name}
                  {liveCount > 0 && <span className="opacity-60 ml-0.5">· {liveCount}</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* Go to room CTA — only in fullscreen peek mode, desktop only */}
        {dark && !activePill.isOwn && (
          <button
            onClick={() => {
              sessionStorage.setItem("focus_carry_status", localStatusRef.current);
              navigate(`/focus-rooms/${activeId}`);
            }}
            className="hidden sm:flex items-center justify-center gap-1.5 text-xs font-semibold px-4 py-2 rounded-xl bg-primary/20 text-primary hover:bg-primary/30 border border-primary/30 transition-all"
          >
            Go to {activePill.name} <ArrowRight className="w-3.5 h-3.5" />
          </button>
        )}

        <div
          className="overflow-y-auto pr-1"
          style={{ maxHeight: dark ? "calc(100dvh - 280px)" : "420px", scrollbarWidth: "thin", scrollbarColor: "rgba(255,255,255,0.1) transparent" }}
        >
          {renderCards()}
        </div>
      </div>
    );
  };

  const renderCrossRoomCard = (p: any, globalRank: number, animIdx = 0) => {
    const secs = p.totalStudySeconds || 0;
    return (
      <motion.div
        key={p.userId}
        layout
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ type: "spring", stiffness: 300, damping: 28, delay: animIdx * 0.025 }}
        className={`relative flex flex-col items-center justify-between gap-2 p-3 pt-4 pb-3 rounded-[20px] bg-card border overflow-hidden min-h-[130px] ${
          p.isSelf ? "border-primary/50 shadow-[0_0_15px_hsl(var(--primary)/0.15)]" : "border-border"
        }`}
      >
        <div className="flex items-start justify-between absolute top-2.5 left-2.5 right-2.5 z-10">
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shadow-sm ${
            globalRank === 1 ? "bg-[#FFB800] text-black" : globalRank === 2 ? "bg-[#E0E0E0] text-black" : globalRank === 3 ? "bg-[#CD7F32] text-black" : "bg-muted text-muted-foreground"
          }`}>
            {globalRank}
          </div>
          {p.isSelf && (
            <div className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-bold border border-primary/30 uppercase tracking-wider">
              You
            </div>
          )}
        </div>
        <div className="relative mt-2">
          <Avatar className="w-14 h-14 border-2 border-border">
            <AvatarImage src={p.avatarUrl} className="object-cover" />
            <AvatarFallback
              className="text-sm font-bold text-foreground"
              style={{ background: `hsl(${(p.displayName.charCodeAt(0) * 37) % 360}, 55%, 35%)` }}
            >
              {p.displayName.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
        </div>
        <div className="text-center w-full mt-1">
          <div className="font-semibold text-[12px] text-foreground truncate px-1">{p.isSelf ? (user?.fullName ?? "You") : p.displayName}</div>
          <div className={`text-[12px] font-mono tracking-wider mt-0.5 ${p.isSelf ? "text-primary" : "text-muted-foreground"}`}>
            {formatTodayTime(p.todayStudySeconds ?? 0)}
          </div>
        </div>
      </motion.div>
    );
  };

  if (isLoading || !room) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <Skeleton className="h-full w-full rounded-xl" />
      </div>
    );
  }

  /* ── Participant Card (reused in both views) ── */
  const renderParticipantCard = (p: any, idx: number, compact = false) => {
    const isActive = p.status === "studying" || p.status === "focusing";
    const onBreak = p.status === "break";
    const secs = p.totalStudySeconds || 0;
    const size = compact ? "w-14 h-14" : "w-20 h-20";
    // For other participants: derive a live today total from the last-broadcast snapshot so
    // the display ticks every second (via totalStudySeconds) instead of lagging 30 s.
    // Formula: today_live = participantTodayBase + (totalStudySeconds - participantBaseSecs)
    const todaySecs = p.isSelf
      ? todayLiveSeconds
      : (() => {
          if (isActive) {
            const tBase = participantTodayBase.current.get(p.userId);
            const sBase = participantBaseSecs.current.get(p.userId);
            if (tBase !== undefined && sBase !== undefined) {
              return tBase + Math.max(0, (p.totalStudySeconds || 0) - sBase);
            }
          }
          return p.todayStudySeconds ?? 0;
        })();
    const tierMins = Math.floor(todaySecs / 60);
    const cardTier = getTierInfo(tierMins);

    return (
      <motion.div
        layout
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.8 }}
        transition={{ type: "spring", stiffness: 300, damping: 28, delay: idx * 0.025 }}
        className={`group relative flex flex-col items-center justify-between gap-2 p-3 ${compact ? 'pt-4 pb-3' : 'pt-5 pb-4'} rounded-[20px] transition-all border ${p.isSelf ? 'border-primary/50 shadow-[0_0_15px_hsl(var(--primary)/0.15)]' : cardTier ? '' : 'border-border'} overflow-hidden min-h-[140px]`}
        style={{
          background: cardTier
            ? `linear-gradient(135deg, rgba(${cardTier.glowRgb},0.15) 0%, rgba(${cardTier.glowRgb},0.08) 100%), hsl(var(--card))`
            : 'hsl(var(--card))',
          borderColor: !p.isSelf && cardTier ? cardTier.cardBorder : undefined,
        }}
      >
        {/* Top Row: Rank & Actions */}
        <div className="flex items-start justify-between absolute top-2.5 left-2.5 right-2.5 z-10 pointer-events-none">
          {/* Rank Badge */}
          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-black shadow-sm ${idx === 0 ? "bg-[#FFB800] text-black" : idx === 1 ? "bg-[#E0E0E0] text-black" : idx === 2 ? "bg-[#CD7F32] text-black" : "bg-muted text-muted-foreground"}`}>
            {idx + 1}
          </div>
          {p.isSelf && (
            <div className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-bold border border-primary/30 uppercase tracking-wider">
              You
            </div>
          )}
        </div>

        {/* Avatar Area */}
        <div className="relative mt-2">
          {p.isSelf ? (
            <div className="relative">
              <AvatarWithAura
                src={p.avatarUrl}
                fallback={p.displayName.substring(0, 2).toUpperCase()}
                todayMinutes={tierMins}
                size={compact ? "md" : "lg"}
              />
              <div className="absolute -bottom-1 -right-1 z-10">
                <UserTierBadge minutes={tierMins} showIconOnly />
              </div>
            </div>
          ) : (
            <UserProfilePopover
              userId={p.userId}
              onMessage={(uid) => {
                navigate(`/dms?conv=${uid}`);
              }}
              trigger={
                <div className="relative cursor-pointer">
                  <AvatarWithAura
                    src={p.avatarUrl}
                    fallback={p.displayName.substring(0, 2).toUpperCase()}
                    todayMinutes={tierMins}
                    size={compact ? "md" : "lg"}
                  />
                  <div className="absolute -bottom-1 -right-1 z-10 pointer-events-none">
                    <UserTierBadge minutes={tierMins} showIconOnly />
                  </div>
                </div>
              }
            />
          )}
        </div>

        {/* Details */}
        <div className="text-center w-full mt-1 flex-1 flex flex-col justify-end">
          <div className="font-semibold text-[13px] text-foreground truncate px-1">
            {p.isSelf ? (user?.fullName ?? "You") : p.displayName}
          </div>
          <div className={`text-[13px] font-mono tracking-wider mt-0.5 ${p.isSelf ? "text-primary" : "text-foreground/70"}`}>
            {formatTodayTime(p.isSelf ? todayLiveSeconds : (p.todayStudySeconds ?? 0))}
          </div>
          {tierMins >= 60 && (
            <div className="flex justify-center mt-1">
              <UserTierBadge minutes={tierMins} />
            </div>
          )}

          {/* Status Dot & Label */}
          <div className="flex items-center justify-center gap-1.5 mt-2 mb-1">
            <span className={`w-2 h-2 rounded-full shadow-sm ${isActive ? "bg-[#10B981] shadow-[#10B981]/40" : onBreak ? "bg-[#F59E0B] shadow-[#F59E0B]/40" : "bg-muted-foreground/50"}`} />
            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-widest">
              {isActive ? "Focusing" : onBreak ? "Break" : "Offline"}
            </span>
          </div>
        </div>

        {/* Host controls — only shown on hover for non-self participants */}
        {isModOrOwner && !p.isSelf && (
          <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-auto z-20">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="w-5 h-5 rounded bg-muted/60 hover:bg-muted flex items-center justify-center">
                  <MoreVertical className="w-3 h-3 text-muted-foreground" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="min-w-[120px]" style={{ zIndex: 100001 }}>
                <DropdownMenuItem
                  className="text-destructive focus:text-destructive text-xs cursor-pointer"
                  onClick={() => setKickTarget({ userId: p.userId, name: p.displayName })}
                >
                  Kick from room
                </DropdownMenuItem>
                <DropdownMenuItem
                  className="text-xs cursor-pointer"
                  onClick={() => p.micOn ? handleMute(p.userId) : handleUnmute(p.userId)}
                >
                  {p.micOn ? "Mute" : "Unmute"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </motion.div>
    );
  };

  /* ── Sidebar participant list (normal view) ── */
  const renderSidebarParticipants = () => {
    const statusDotClass = (status: string) => {
      if (status === "studying" || status === "focusing")
        return "bg-emerald-400 shadow-[0_0_5px_2px_rgba(52,211,153,0.45)]";
      if (status === "break") return "bg-amber-400 shadow-[0_0_5px_2px_rgba(251,191,36,0.35)]";
      return "bg-muted-foreground/50";
    };
    return (
      <div className="flex flex-col h-full">
        <div className="px-4 py-3 border-b flex items-center justify-between shrink-0">
          <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Participants</span>
          <span className="text-xs font-bold bg-muted px-2 py-0.5 rounded-full text-muted-foreground">{allCards.length}</span>
        </div>
        <ScrollArea className="flex-1">
          <div className="p-3 flex flex-col gap-1">
            {allCards.map((p, idx) => {
              const rank = idx + 1;
              const isActive = p.status === "studying" || p.status === "focusing";
              const todaySecs = p.isSelf
                ? todayLiveSeconds
                : (() => {
                    if (isActive) {
                      const tBase = participantTodayBase.current.get(p.userId);
                      const sBase = participantBaseSecs.current.get(p.userId);
                      if (tBase !== undefined && sBase !== undefined) {
                        return tBase + Math.max(0, (p.totalStudySeconds || 0) - sBase);
                      }
                    }
                    return p.todayStudySeconds ?? 0;
                  })();
              const isOnBreak = p.status === "break";
              const tier = getTierInfo(Math.floor(todaySecs / 60));
              const animDuration = tier ? (isActive ? 2.5 : isOnBreak ? 5 : 0) : 0;
              return (
                <motion.div
                  key={p.userId}
                  className={`group flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all border ${
                    !tier
                      ? p.isSelf
                        ? "bg-primary/10 border-primary/20"
                        : isActive
                          ? "bg-muted/30 hover:bg-muted/50 border-transparent"
                          : isOnBreak
                            ? "bg-amber-500/5 hover:bg-amber-500/10 border-transparent"
                            : "opacity-50 hover:opacity-70 border-transparent"
                      : "hover:brightness-110"
                  }`}
                  style={tier ? {
                    background: tier.cardBg,
                    borderColor: isActive ? tier.cardBorder : `rgba(${tier.glowRgb}, 0.1)`,
                    opacity: !isActive && !isOnBreak && !p.isSelf ? 0.5 : 1,
                  } : undefined}
                >
                  <motion.div
                    className="relative shrink-0"
                    animate={animDuration > 0 ? { filter: tier!.animateFilter } : { filter: "none" }}
                    transition={{ duration: animDuration, repeat: animDuration > 0 ? Infinity : 0, ease: "easeInOut" }}
                  >
                    <Avatar className="w-9 h-9">
                      <AvatarImage src={p.avatarUrl} />
                      <AvatarFallback className="text-xs font-bold">
                        {p.displayName?.slice(0, 2).toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card ${statusDotClass(p.status)}`} />
                  </motion.div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className={`text-sm font-semibold truncate leading-tight ${p.isSelf ? "text-primary" : "text-foreground"}`}>
                        {p.isSelf ? "You" : p.displayName}
                      </span>
                      {p.isSelf && (
                        <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-bold leading-none shrink-0">YOU</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[11px] font-mono text-muted-foreground">
                        {formatTodayTime(todaySecs)}
                      </span>
                      <span className={`text-[9px] font-semibold ${
                        isActive ? "text-emerald-400" : isOnBreak ? "text-amber-400" : "text-muted-foreground/50"
                      }`}>
                        {isActive ? "focusing" : isOnBreak ? "break" : "offline"}
                      </span>
                    </div>
                  </div>
                  <div className="shrink-0 flex items-center">
                    <span className={`text-xs font-black ${p.isSelf ? "" : "group-hover:hidden"} ${
                      rank === 1 ? "text-amber-400" : rank === 2 ? "text-foreground/60" : rank === 3 ? "text-amber-600/80" : "text-muted-foreground/40"
                    }`}>
                      #{rank}
                    </span>
                    {!p.isSelf && (
                      <div className="hidden group-hover:flex items-center gap-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-primary"
                          title={`Connect with ${p.displayName}`}
                          onClick={() => handleConnect(p.userId, p.displayName)}
                        >
                          <UserPlus className="w-3.5 h-3.5" />
                        </Button>
                        {isModOrOwner && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-muted-foreground hover:text-destructive"
                            title={`Kick ${p.displayName}`}
                            onClick={() => setKickTarget({ userId: p.userId, name: p.displayName })}
                          >
                            <LogOut className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </ScrollArea>
      </div>
    );
  };

  return (
    <>
      {/* ── Session Summary Modal — portalled above fullscreen overlay ── */}
      {showSessionSummary && createPortal(
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 flex items-center justify-center px-4"
          style={{ zIndex: 100001, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            className="w-full max-w-sm bg-card border rounded-2xl p-6 shadow-2xl"
          >
            <div className="flex items-center gap-2 text-lg font-bold mb-4">
              <Trophy className="w-5 h-5 text-amber-400" /> Session Complete
            </div>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <div className="text-2xl font-mono font-black">{formatTime(localSeconds)}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">This Session</div>
              </div>
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <div className="text-2xl font-black text-primary">{formatTodayTime(todayLiveSeconds)}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Today</div>
              </div>
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <div className="text-2xl font-black">#{(allCards.findIndex((c) => c.userId === user?.id) ?? 0) + 1}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Room Rank</div>
              </div>
            </div>
            {task && (
              <div className="bg-primary/5 border border-primary/20 rounded-xl px-3 py-2 text-sm text-center mb-4">
                <span className="text-muted-foreground text-xs">Working on: </span>
                <span className="font-medium">{task}</span>
              </div>
            )}
            {localSeconds < 60 && (
              <p className="text-xs text-muted-foreground text-center mb-4">Study at least 1 minute to save to analytics.</p>
            )}
            <div className="flex items-start gap-1.5 text-[11px] text-muted-foreground bg-muted/40 border rounded-lg px-3 py-2 mb-4">
              <LogOut className="w-3.5 h-3.5 mt-0.5 shrink-0" />
              <span>Leaving removes you from this room — you'll need the invite link to rejoin. Use <span className="font-semibold text-foreground">Go Offline</span> instead to stay a member.</span>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowSessionSummary(false)}>
                Keep Going
              </Button>
              <Button variant="destructive" className="flex-1" onClick={confirmLeave}>
                EXIT
              </Button>
            </div>
          </motion.div>
        </motion.div>,
        document.body
      )}

      {/* ════════════════════════════════════════════════════════
          PORTALLED FULLSCREEN FOCUS OVERLAY
          Rendered directly into document.body to cover EVERYTHING
          ════════════════════════════════════════════════════════ */}
      {isStudying &&
        createPortal(
          <motion.div
            key="focus-overlay"
            ref={overlayRef}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            className="fixed inset-0 flex flex-col overflow-hidden bg-background"
            style={{
              zIndex: 99999,
              backgroundImage:
                "radial-gradient(ellipse at 50% 0%, hsl(var(--primary)/0.12) 0%, transparent 65%)",
              // Safe area for notch / dynamic island
              paddingTop: "env(safe-area-inset-top)",
            }}
          >
            {/* Overlay top bar */}
            <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/30 shrink-0 bg-background/80 backdrop-blur-md">
              <div className="flex items-center gap-3 min-w-0">
                <motion.div
                  className="flex items-center gap-1.5 bg-primary/10 text-primary px-3 py-1.5 rounded-lg text-xs font-black border border-primary/20 uppercase tracking-wider whitespace-nowrap shrink-0"
                  animate={{
                    boxShadow: [
                      "0 0 0 0 hsl(var(--primary)/0.4)",
                      "0 0 0 6px hsl(var(--primary)/0)",
                      "0 0 0 0 hsl(var(--primary)/0)",
                    ],
                  }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                >
                  <Flame className="w-3.5 h-3.5" /> Deep Focus Zone
                </motion.div>
                <span className="text-sm text-muted-foreground hidden sm:block truncate max-w-48">{room.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {switchableRooms.length > 0 && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs text-primary border-primary/40 hover:bg-primary/10">
                        <Users className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Switch Room</span>
                        <span className="text-[10px] bg-primary/20 px-1.5 py-0.5 rounded-full font-bold">{switchableRooms.length}</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-60 max-h-72 overflow-y-auto" style={{ zIndex: 100001 }}>
                      {switchableRooms.map((r) => (
                        <DropdownMenuItem key={r.id} onClick={() => {
                          // Persist studying status so the overlay survives the remount
                          sessionStorage.setItem("focus_carry_status", localStatusRef.current);
                          navigate(`/focus-rooms/${r.id}`);
                        }}>
                          <ArrowRight className="w-3.5 h-3.5 mr-2 opacity-40" />
                          <span className="truncate">{r.label}</span>
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden sm:flex gap-1.5 text-muted-foreground text-xs"
                  onClick={() => setShowInvite(true)}
                >
                  <Share2 className="w-3.5 h-3.5" /> Invite
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 text-xs text-amber-500 border-amber-500/30 hover:bg-amber-500/10"
                  onClick={handleBreak}
                >
                  <Coffee className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Take Break</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="hidden sm:flex gap-1.5 text-xs text-muted-foreground"
                  onClick={handleOffline}
                >
                  <WifiOff className="w-3.5 h-3.5" /> Offline
                </Button>
                <Button variant="destructive" size="sm" className="gap-1.5 text-xs" onClick={() => setShowExitConfirm(true)}>
                  <LogOut className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Exit</span>
                </Button>
              </div>
            </div>

            {/* Big timer — shrinks on small screens so the participant grid always has room */}
            <div className="flex flex-col items-center pt-4 pb-3 sm:pt-6 sm:pb-4 shrink">
              <motion.div
                className="font-mono font-black tracking-tighter tabular-nums select-none cursor-pointer"
                style={{
                  fontSize: "clamp(3rem, 14vw, 9rem)",
                  textShadow: "0 0 60px hsl(var(--primary)/0.4)",
                  lineHeight: 1,
                  color: timerDisplay === "today" ? "hsl(var(--primary))" : undefined,
                }}
                key={timerDisplay + String(Math.floor(localSeconds / 60))}
                initial={{ y: -8, opacity: 0.6 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.25 }}
                onClick={() => setTimerDisplay((d) => d === "session" ? "today" : "session")}
              >
                {timerDisplay === "session" ? formatTime(localSeconds) : formatTodayTime(todayLiveSeconds)}
              </motion.div>

              {/* Toggle pills */}
              <div className="flex items-center gap-1 mt-3 bg-white/5 rounded-full p-0.5 border border-white/10">
                <button
                  onClick={() => setTimerDisplay("session")}
                  className={`px-3 py-0.5 rounded-full text-[11px] font-bold transition-all ${timerDisplay === "session" ? "bg-white/15 text-white" : "text-white/30 hover:text-white/50"}`}
                >
                  Session
                </button>
                <button
                  onClick={() => setTimerDisplay("today")}
                  className={`px-3 py-0.5 rounded-full text-[11px] font-bold transition-all ${timerDisplay === "today" ? "bg-primary/40 text-primary" : "text-white/30 hover:text-white/50"}`}
                >
                  Today
                </button>
              </div>

              {/* Secondary value */}
              <div className="mt-1.5 text-xs text-white/30 font-medium tracking-wide">
                {timerDisplay === "session"
                  ? <>Today: <span className="text-primary/60 font-bold">{formatTodayTime(todayLiveSeconds)}</span></>
                  : <>Session: <span className="text-white/40 font-bold">{formatTime(localSeconds)}</span></>}
              </div>

              {task && !isTaskPrivate && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-3 flex items-center gap-2 text-sm text-muted-foreground bg-muted/60 px-4 py-1.5 rounded-full border"
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  {task}
                </motion.div>
              )}

              <div className="mt-3 flex items-center gap-1.5 text-xs font-bold text-primary">
                <motion.span
                  className="w-2 h-2 rounded-full bg-primary"
                  animate={{ opacity: [1, 0.2, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
                Focusing • Session saved to Analytics on leave
              </div>

              {/* Music Player */}
              <div className="mt-4 flex items-center gap-2 bg-muted/40 rounded-full px-3 py-1.5 border border-white/5">
                <Music className="w-3.5 h-3.5 text-muted-foreground" />
                {MUSIC_TRACKS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => {
                      if (musicTrack === t.id && musicPlaying) {
                        audioRef.current?.pause();
                        setMusicPlaying(false);
                        setMusicTrack(null);
                      } else {
                        // Stop ambience so music and ambience never overlap
                        ambienceAudioRef.current?.pause();
                        setAmbience("none");
                        if (audioRef.current) { audioRef.current.pause(); }
                        const audio = new Audio(t.url);
                        audio.loop = true;
                        audio.volume = 0.3;
                        audio.muted = musicMuted;
                        audio.play().catch(() => {});
                        audioRef.current = audio;
                        setMusicTrack(t.id);
                        setMusicPlaying(true);
                      }
                    }}
                    className={`text-[10px] px-2 py-0.5 rounded-full font-medium transition-all ${
                      musicTrack === t.id && musicPlaying
                        ? "bg-primary/20 text-primary border border-primary/30"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    }`}
                  >
                    {t.emoji} {t.label}
                  </button>
                ))}
                {musicPlaying && (
                  <button
                    onClick={() => {
                      if (audioRef.current) {
                        audioRef.current.muted = !audioRef.current.muted;
                        setMusicMuted(!musicMuted);
                      }
                    }}
                    className="text-muted-foreground hover:text-foreground ml-1"
                  >
                    {musicMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
                  </button>
                )}
              </div>
            </div>

            {/* Participant grid — min-h-0 prevents flex shrink from collapsing it to zero */}
            <div
              className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 pb-6"
              style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
            >
              {renderGroupedGlobalView(true)}
            </div>
          </motion.div>,
          document.body,
        )}

      {/* ════════════════════════════════════════════════════════
          INVITE MODAL (portalled)
          ════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showInvite && (
          <InviteModal room={room} allCards={allCards} onClose={() => setShowInvite(false)} />
        )}
      </AnimatePresence>

      {/* ════════════════════════════════════════════════════════
          NORMAL PAGE (shown when idle / break / offline)
          ════════════════════════════════════════════════════════ */}
      {!isStudying && (<>
        <div className="flex flex-col h-[calc(100vh-8rem)] gap-4">
          {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between bg-card border rounded-xl shadow-sm p-4 shrink-0 gap-4">
          <div className="flex items-center gap-3 min-w-0 w-full sm:w-auto">
            <div className="w-12 h-12 rounded-xl border bg-muted/50 flex flex-col items-center justify-center shrink-0">
              <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-0.5">Focus</span>
              <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded border border-primary/20 font-bold">Zone</span>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="font-bold text-base leading-tight truncate">{room.name}</h2>
              <p className="text-xs text-muted-foreground truncate hidden sm:block">{room.description}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 w-full sm:w-auto sm:justify-end">
            <Button
              variant="outline"
              size="sm"
              className="gap-1.5 text-xs flex-1 sm:flex-none"
              onClick={() => setShowInvite(true)}
            >
              <Share2 className="w-3.5 h-3.5" /> Invite
            </Button>
            {room.linkedCircleId && (
              <Link href={`/circles/${room.linkedCircleId}`} className="flex-1 sm:flex-none">
                <Button variant="outline" size="sm" className="gap-1.5 text-xs w-full hidden sm:flex">
                  <ExternalLink className="w-3.5 h-3.5" /> Circle
                </Button>
              </Link>
            )}
            <Button variant="destructive" size="sm" className="gap-1.5 text-xs flex-1 sm:flex-none" onClick={handleLeave}>
              <LogOut className="w-3.5 h-3.5" /> Leave
            </Button>
          </div>
        </div>

        <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
          {/* Main */}
          <div className="flex-1 flex flex-col gap-4 min-h-0">
            {/* Controls */}
            <div className="bg-card border rounded-xl shadow-sm p-4 shrink-0">
              <div className="flex flex-col md:flex-row items-stretch gap-5">
                {/* Task + Ambience */}
                <div className="flex flex-col gap-3 flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <BookOpen className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                      <Input
                        placeholder="What are you focusing on?"
                        className="pl-9"
                        value={task}
                        onChange={(e) => updateTask(e.target.value, isTaskPrivate)}
                      />
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isTaskPrivate ? (
                        <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                      ) : (
                        <Unlock className="w-3.5 h-3.5 text-muted-foreground" />
                      )}
                      <span className="text-xs text-muted-foreground hidden sm:block">
                        {isTaskPrivate ? "Private" : "Public"}
                      </span>
                      <Switch
                        checked={isTaskPrivate}
                        onCheckedChange={(c) => updateTask(task, c)}
                      />
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                      Ambience:
                    </span>
                    {(["none", "lofi", "rain"] as const).map((a) => (
                      <Button
                        key={a}
                        variant={ambience === a ? "secondary" : "ghost"}
                        size="sm"
                        className="h-7 text-xs gap-1"
                        onClick={() => setAmbience(a)}
                      >
                        {a === "none" ? (
                          "Off"
                        ) : a === "lofi" ? (
                          <><Headphones className="w-3 h-3" /> Lo-Fi</>
                        ) : (
                          <><CloudRain className="w-3 h-3" /> Rain</>
                        )}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Timer block */}
                <div className="flex flex-col items-center gap-2 shrink-0 bg-muted/30 rounded-xl p-4 border border-dashed w-full md:w-auto md:min-w-50">
                  {/* Status badge */}
                  <div
                    className={`text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-full border flex items-center gap-1.5
                    ${isStudying ? "bg-primary/10 text-primary border-primary/20" : localStatus === "break" ? "bg-amber-500/10 text-amber-500 border-amber-500/20" : localStatus === "offline" ? "bg-muted text-muted-foreground/50 border-border" : "bg-muted text-muted-foreground border-border"}`}
                  >
                    <Timer className="w-3 h-3" />
                    {isStudying ? "Focusing" : localStatus === "break" ? "On Break" : localStatus === "offline" ? "Offline" : "Ready"}
                  </div>

                  {/* Today total — always the primary number */}
                  <div className="flex flex-col items-center gap-0.5 my-1">
                    <div className="text-4xl sm:text-5xl lg:text-4xl font-mono font-black tracking-tighter tabular-nums">
                      {formatTodayTime(todayLiveSeconds)}
                    </div>
                    <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-widest">Today</span>
                  </div>

                  {/* Session time — secondary, only visible while active or on break */}
                  {(isStudying || localStatus === "break") && localSeconds > 0 && (
                    <div className="text-xs text-muted-foreground font-mono -mt-1 mb-0.5">
                      Session: {formatTime(localSeconds)}
                    </div>
                  )}

                  <div className="flex flex-col gap-1.5 w-full">
                    {localStatus === "idle" && (
                      <Button className="w-full gap-2 rounded-full shadow-lg text-sm" onClick={handleStart}>
                        <Play className="w-4 h-4 fill-current" />
                        {todayLiveSeconds > 0 ? "Resume Focusing" : "Start Focusing"}
                      </Button>
                    )}
                    {isStudying && (
                      <Button
                        variant="outline"
                        className="w-full gap-1.5 rounded-full text-amber-500 border-amber-500/30 hover:bg-amber-500/10 text-sm"
                        onClick={handleBreak}
                      >
                        <Coffee className="w-4 h-4" /> Take Break
                      </Button>
                    )}
                    {localStatus === "break" && (
                      <Button className="w-full gap-2 rounded-full shadow-lg text-sm" onClick={handleResume}>
                        <Play className="w-4 h-4 fill-current" /> Resume Focusing
                      </Button>
                    )}
                    {localStatus === "offline" && (
                      <Button className="w-full gap-2 rounded-full shadow-lg text-sm" onClick={handleComeBack}>
                        <Zap className="w-4 h-4" /> Come Back
                      </Button>
                    )}
                    {(isStudying || localStatus === "break") && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="w-full gap-1 text-muted-foreground text-xs"
                        onClick={handleOffline}
                      >
                        <WifiOff className="w-3 h-3" /> Go Offline
                      </Button>
                    )}
                  </div>
                  {localSeconds > 0 && (
                    <p className="text-[9px] text-muted-foreground text-center">
                      Saved to analytics on leave
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Mobile participants strip — sidebar handles this on lg+ */}
            <div className="lg:hidden bg-card border rounded-xl px-4 py-3 flex items-center gap-3 shrink-0">
              <div className="flex -space-x-2 shrink-0">
                {allCards.slice(0, 5).map((p) => (
                  <Avatar key={p.userId} className="w-7 h-7 border-2 border-card">
                    <AvatarImage src={p.avatarUrl} />
                    <AvatarFallback className="text-[10px] font-bold">
                      {p.displayName.slice(0, 1).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                ))}
              </div>
              <div className="flex-1 min-w-0 text-xs">
                <span className="font-semibold">
                  {allCards.filter((p) => p.status === "studying" || p.status === "focusing").length || "No one"} focusing
                </span>
                <span className="text-muted-foreground"> · {allCards.length} in room</span>
              </div>
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="gap-1.5 text-xs shrink-0">
                    <Users className="w-3.5 h-3.5" /> People
                  </Button>
                </SheetTrigger>
                <SheetContent side="bottom" className="h-[70vh] p-0 flex flex-col">
                  <div className="flex-1 overflow-hidden">
                    {renderSidebarParticipants()}
                  </div>
                </SheetContent>
              </Sheet>
            </div>

          </div>

          {/* Participants Sidebar */}
          <div className="hidden lg:flex w-60 bg-card border rounded-xl flex-col overflow-hidden shrink-0 h-full">
            {renderSidebarParticipants()}
          </div>
        </div>
      </div>

      </>)}

      {/* ── Floating Chat FAB + Window ── */}
      {!isStudying && createPortal(
        <>
          <AnimatePresence>
            {showChatWindow && (
              <motion.div
                key="chat-window"
                initial={{ opacity: 0, y: 12, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.95 }}
                transition={{ duration: 0.2, ease: "easeOut" }}
                className="fixed bottom-20 right-5 w-80 bg-card border rounded-2xl shadow-2xl flex flex-col overflow-hidden"
                style={{ height: 400, zIndex: 1000 }}
              >
                <div className="px-4 py-3 border-b flex items-center justify-between shrink-0 bg-muted/20">
                  <span className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider">
                    <MessageSquare className="w-3.5 h-3.5" /> Room Chat
                  </span>
                  <div className="flex items-center gap-1">
                    {isModOrOwner ? (
                      <Button variant="ghost" size="icon" className={`h-6 w-6 ${isChatLocked ? "text-destructive" : "text-emerald-500"}`}
                        onClick={() => { const next = !isChatLocked; setIsChatLocked(next); socketRef.current?.emit("focus:toggle_chat", { roomId, isEnabled: !next }); }}>
                        {isChatLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                      </Button>
                    ) : isChatLocked ? (
                      <Lock className="w-3 h-3 text-muted-foreground" />
                    ) : (
                      <Unlock className="w-3 h-3 text-emerald-500" />
                    )}
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground"
                      onClick={() => setShowChatWindow(false)}>
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
                <ScrollArea className="flex-1 px-3 py-2 min-h-0">
                  {renderChatMessages()}
                </ScrollArea>
                <div className="p-3 border-t bg-muted/10 shrink-0">
                  {isChatLocked && !isModOrOwner ? (
                    <div className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground py-2 border border-dashed rounded-lg bg-muted/50">
                      <Lock className="w-3 h-3" /> Locked by owner
                    </div>
                  ) : (
                    <Input placeholder="Message the room..." className="bg-background text-sm h-9"
                      value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={handleSendMessage} />
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.92 }}
            onClick={() => { setShowChatWindow((v) => !v); if (!showChatWindow) setUnreadCount(0); }}
            className="fixed bottom-5 right-5 w-13 h-13 bg-primary rounded-full shadow-xl flex items-center justify-center"
            style={{ zIndex: 1001, width: 52, height: 52 }}
          >
            {showChatWindow
              ? <X className="w-5 h-5 text-primary-foreground" />
              : <MessageSquare className="w-5 h-5 text-primary-foreground" />
            }
            <AnimatePresence>
              {unreadCount > 0 && !showChatWindow && (
                <motion.span
                  key="badge"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  exit={{ scale: 0 }}
                  className="absolute -top-1 -right-1 w-5 h-5 bg-destructive text-destructive-foreground text-[10px] font-black rounded-full flex items-center justify-center"
                >
                  {unreadCount > 9 ? "9+" : unreadCount}
                </motion.span>
              )}
            </AnimatePresence>
          </motion.button>
        </>,
        document.body
      )}

      {/* ── Fullscreen exit confirmation (Session-Complete style) ── */}
      {showExitConfirm && createPortal(
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 flex items-center justify-center px-4"
          style={{ zIndex: 100002, background: "rgba(0,0,0,0.75)", backdropFilter: "blur(8px)" }}
        >
          <motion.div
            initial={{ scale: 0.9, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 340, damping: 30 }}
            className="w-full max-w-sm bg-card border rounded-2xl p-6 shadow-2xl"
          >
            <div className="flex items-center gap-2 text-lg font-bold mb-4">
              <LogOut className="w-5 h-5 text-muted-foreground" /> Exit Focus Mode?
            </div>
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <div className="text-2xl font-mono font-black">{formatTime(localSeconds)}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">This Session</div>
              </div>
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <div className="text-2xl font-black text-primary">{formatTodayTime(todayLiveSeconds)}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Today</div>
              </div>
              <div className="bg-muted/50 rounded-xl p-3 text-center">
                <div className="text-2xl font-black">#{(allCards.findIndex((c) => c.userId === user?.id) ?? 0) + 1}</div>
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-1">Room Rank</div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={() => setShowExitConfirm(false)}>
                Keep Going
              </Button>
              <Button variant="outline" className="flex-1 bg-red-500/15 border-red-500/30 text-red-400 hover:bg-red-500/25 hover:text-red-300" onClick={() => { setShowExitConfirm(false); handleOffline(); }}>
                Exit
              </Button>
            </div>
          </motion.div>
        </motion.div>,
        document.body
      )}

      {/* ── Kick confirmation ── */}
      <AlertDialog open={!!kickTarget} onOpenChange={(open) => { if (!open) setKickTarget(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Kick {kickTarget?.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              They'll be removed from this room and will need an invite link to rejoin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => { if (kickTarget) { handleKick(kickTarget.userId); setKickTarget(null); } }}
            >
              Kick
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
