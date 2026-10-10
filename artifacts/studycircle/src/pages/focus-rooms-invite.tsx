import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useUser } from "@clerk/clerk-react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, Zap, Lock, CheckCircle2, ArrowRight, Eye, MonitorPlay, Mic, MicOff, Video, Clock, ArrowLeft, Trophy, Flame, Coffee, Shield, BookOpen } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { customFetch } from "@workspace/api-client-react";
import type { FocusRoomDetail } from "@workspace/api-client-react";

export default function FocusRoomInvitePage() {
  const [, params] = useRoute("/focus-rooms/invite/:id");
  const [, setLocation] = useLocation();
  const { isSignedIn, user } = useUser();
  const roomId = params?.id || "";

  const [room, setRoom] = useState<FocusRoomDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [alreadyJoined, setAlreadyJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!roomId) return;
    customFetch(`/focus-rooms/${roomId}`)
      .then((data: any) => {
        if (data.error) setError(data.error);
        else {
          setRoom(data);
          // Check if current user is already a participant
          if (user && Array.isArray(data.participants)) {
            const isIn = data.participants.some((p: any) => p.userId === user.id);
            setAlreadyJoined(isIn);
          }
        }
      })
      .catch(() => setError("Failed to load room"))
      .finally(() => setLoading(false));
  }, [roomId, user]);

  const handleJoin = async () => {
    if (!isSignedIn || !user || !room) return;
    setJoining(true);
    try {
      const data: any = await customFetch(`/focus-rooms/${roomId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName: user.fullName ?? user.username ?? "Anonymous",
          avatarUrl: user.imageUrl ?? `https://api.dicebear.com/7.x/initials/svg?fontFamily=Inter,sans-serif&fontSize=40&seed=${encodeURIComponent(user.fullName ?? "A")}`,
        }),
      });
      if (data.error) {
        toast.error(data.error);
      } else {
        setJoined(true);
        setTimeout(() => setLocation(`/focus-rooms/${roomId}`), 1200);
      }
    } catch {
      toast.error("Failed to join room");
    } finally {
      setJoining(false);
    }
  };

  const getModeIcon = (mode: string) => {
    switch (mode) {
      case "silent": return <MicOff className="w-5 h-5" />;
      case "voice": return <Mic className="w-5 h-5" />;
      case "video": return <Video className="w-5 h-5" />;
      default: return <MicOff className="w-5 h-5" />;
    }
  };

  const getModeLabel = (mode: string) => {
    switch (mode) {
      case "silent": return "Silent Mode";
      case "voice": return "Voice Mode";
      case "video": return "Video Mode";
      default: return mode;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-violet-500/30 border-t-violet-500 animate-spin" />
      </div>
    );
  }

  if (error || !room) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-20 h-20 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
          <Lock className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white text-center">Room Not Found</h1>
        <p className="text-gray-400 text-center">{error || "This room doesn't exist or has been closed."}</p>
        <Button onClick={() => setLocation("/focus-rooms")} variant="outline" className="mt-2 border-white/10 text-white hover:bg-white/5">
          Browse Focus Rooms
        </Button>
      </div>
    );
  }

  const accentColor = room.accentColor || "#7C3AED";
  const focusingCount = room.participants?.filter((p: any) => p.status === "focusing" || p.status === "studying").length ?? 0;
  const isFull = room.participantCount >= room.maxParticipants;

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center px-4 relative overflow-hidden">
      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        <div className="bg-[#13131a] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
          {/* Header Banner */}
          <div className="relative h-32 flex flex-col items-start p-6 pb-4 bg-gradient-to-b from-violet-600 to-violet-900 border-b border-white/10">
            <div className="flex items-center gap-4 relative z-10">
              <div className="w-16 h-16 rounded-2xl bg-white/10 shadow-inner flex items-center justify-center border border-white/20 flex-shrink-0">
                <div className="grid grid-cols-2 grid-rows-2 gap-1 w-8 h-8">
                  <div className="bg-emerald-400 rounded-sm"></div>
                  <div className="bg-blue-400 rounded-sm"></div>
                  <div className="bg-amber-400 rounded-sm col-span-2"></div>
                </div>
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-white font-bold text-2xl leading-tight truncate">{room.name}</h2>
                <div className="mt-1">
                  <Badge className="text-[10px] bg-white/20 text-white hover:bg-white/30 border-0 font-medium px-2 py-0.5">
                    {room.exam}
                  </Badge>
                </div>
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* Description / Subtitle */}
            <p className="text-gray-300 text-sm text-center mb-6 break-words">
              {room.description || `Join ${room.hostName || "Host"}'s focus room`}
            </p>

            {/* Inner Features Box */}
            <div className="bg-white/5 border border-white/10 rounded-[20px] p-5 mb-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  <Users className="w-3.5 h-3.5" />
                  {room.participantCount ?? room.participants?.length ?? 0} MEMBERS
                </div>
                <Avatar className="w-7 h-7 bg-orange-600 border border-white/10">
                  <AvatarFallback className="text-[10px] font-bold text-white bg-orange-600">
                    {(room.hostName || "C").substring(0, 1).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
              </div>

              <div className="space-y-3">
                {[
                  "Real-time group chat",
                  "Exam-focused study rooms",
                  "Live doubt solving",
                ].map((feature, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="w-4 h-4 rounded-full border border-emerald-500 flex items-center justify-center flex-shrink-0">
                      <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                    </div>
                    <span className="text-sm text-gray-300 font-medium">{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* CTA */}
            <AnimatePresence mode="wait">
              {joined ? (
                <motion.div key="joined" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-2 py-2">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  </div>
                  <p className="text-emerald-400 font-semibold">Entering room...</p>
                </motion.div>
              ) : alreadyJoined ? (
                <motion.div key="already" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  <Button
                    onClick={() => setLocation(`/focus-rooms/${roomId}`)}
                    className="w-full h-12 text-base font-bold gap-2 border-0 rounded-xl bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    <Zap className="w-4 h-4" /> Go to Focus Room <ArrowRight className="w-4 h-4" />
                  </Button>
                </motion.div>
              ) : isFull ? (
                <motion.div key="full" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  <p className="text-center text-rose-400 text-sm font-semibold">Room is full ({room.maxParticipants}/{room.maxParticipants})</p>
                  <Button onClick={() => setLocation("/focus-rooms")} className="w-full h-12 bg-white/10 hover:bg-white/20 text-white rounded-xl">
                    Browse Other Rooms <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </motion.div>
              ) : isSignedIn ? (
                <motion.div key="join" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Button
                    onClick={handleJoin}
                    disabled={joining}
                    className="w-full h-12 text-base font-bold gap-2 border-0 rounded-xl bg-violet-600 hover:bg-violet-700 text-white transition-all shadow-lg shadow-violet-600/20"
                  >
                    {joining ? (
                      <span className="flex items-center gap-2"><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Joining...</span>
                    ) : (
                      <span className="flex items-center gap-2"><Zap className="w-4 h-4" /> Accept Invitation <ArrowRight className="w-4 h-4" /></span>
                    )}
                  </Button>
                </motion.div>
              ) : (
                <motion.div key="auth" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  <p className="text-center text-gray-400 text-sm">Sign in to join this focus room</p>
                  <Button
                    onClick={() => setLocation("/sign-in")}
                    className="w-full h-12 text-base font-bold gap-2 border-0 rounded-xl bg-violet-600 hover:bg-violet-700 text-white"
                  >
                    Sign In & Accept <ArrowRight className="w-4 h-4" />
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 mt-6">
          <BookOpen className="w-3.5 h-3.5 text-gray-600" />
          <p className="text-gray-600 text-[11px] font-medium tracking-wide">StudyCircle — Where toppers study together</p>
        </div>
      </motion.div>
    </div>
  );
}
