import { useEffect, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { useUser, SignInButton, SignUpButton } from "@clerk/clerk-react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, BookOpen, Zap, Lock, CheckCircle2, ArrowRight, Star, Eye } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { customFetch } from "@workspace/api-client-react";

interface InviteData {
  code: string;
  circle: {
    id: string;
    name: string;
    description: string;
    exam: string;
    coverColor: string;
    memberCount: number;
    members: Array<{ userId: string | null; displayName: string | null; avatarUrl: string | null }>;
  };
}

export default function InvitePage() {
  const [, params] = useRoute("/invite/:code");
  const [, setLocation] = useLocation();
  const { isSignedIn, user, isLoaded } = useUser();
  const code = params?.code || "";

  const [inviteData, setInviteData] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!code) return;
    fetch(`/api/invite/${code}`)
      .then(r => r.json())
      .then(data => {
        if (data.error) setError(data.error);
        else setInviteData(data);
      })
      .catch(() => setError("Failed to load invite"))
      .finally(() => setLoading(false));
  }, [code]);



  const handleJoin = async () => {
    if (!isSignedIn || !inviteData) return;
    setJoining(true);
    try {
      const data: any = await customFetch(`/api/invite/${code}/join`, {
        method: "POST",
      });
      if (data.success) {
        setJoined(true);
        setTimeout(() => setLocation(`/circles/${data.circleId}`), 1500);
      } else {
        toast.error(data.error || "Failed to join");
      }
    } catch {
      toast.error("Failed to join circle");
    } finally {
      setJoining(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-violet-500/30 border-t-violet-500 animate-spin" />
      </div>
    );
  }

  if (error || !inviteData) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-20 h-20 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
          <Lock className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white text-center">Invite Invalid</h1>
        <p className="text-gray-400 text-center">{error || "This invite link has expired or is no longer valid."}</p>
        <Button onClick={() => setLocation("/")} variant="outline" className="mt-2 border-white/10 text-white hover:bg-white/5">
          Go to StudyCircle
        </Button>
      </div>
    );
  }

  const { circle } = inviteData;

  return (
    <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center px-4 relative overflow-hidden">
      {/* Animated background gradient blobs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-20 blur-3xl animate-pulse"
          style={{ background: `radial-gradient(circle, ${circle.coverColor}, transparent)` }} />
        <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full opacity-15 blur-3xl animate-pulse"
          style={{ background: `radial-gradient(circle, ${circle.coverColor}88, transparent)`, animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full opacity-5 blur-3xl"
          style={{ background: `radial-gradient(circle, ${circle.coverColor}, transparent)` }} />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 30, scale: 0.95 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="relative z-10 w-full max-w-md"
      >
        {/* Invite Card */}
        <div className="bg-[#13131a]/90 backdrop-blur-xl border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
          {/* Circle Banner */}
          <div className="h-32 relative" style={{ background: `linear-gradient(135deg, ${circle.coverColor}cc, ${circle.coverColor}44)` }}>
            <div className="absolute inset-0 bg-gradient-to-b from-transparent to-[#13131a]/80" />
            <div className="absolute bottom-0 left-0 right-0 p-4 flex items-end gap-3">
              <div className="w-16 h-16 rounded-xl border-4 border-[#13131a] flex items-center justify-center text-3xl shadow-xl"
                style={{ background: `linear-gradient(135deg, ${circle.coverColor}, ${circle.coverColor}88)` }}>
                📚
              </div>
              <div>
                <h2 className="text-white font-bold text-xl leading-tight">{circle.name}</h2>
                <Badge className="text-[10px] mt-1 border-0" style={{ background: `${circle.coverColor}44`, color: circle.coverColor }}>
                  {circle.exam}
                </Badge>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-5">
            {/* Invitation text */}
            <div className="text-center">
              <p className="text-gray-300 text-sm">{circle.description}</p>
            </div>

            {/* Member preview */}
            <div className="bg-white/5 rounded-xl p-4 border border-white/5">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                  <Users className="w-3 h-3 inline mr-1" />{circle.memberCount} Members
                </span>
                <div className="flex -space-x-2">
                  {circle.members.slice(0, 5).map((m, i) => (
                    <Avatar key={m.userId || i} className="relative h-7 w-7 border-2 border-[#13131a]">
                      <AvatarImage src={m.avatarUrl || ""} />
                      <AvatarFallback className="text-[10px]" style={{ background: circle.coverColor }}>{m.displayName?.substring(0, 2)}</AvatarFallback>
                    </Avatar>
                  ))}
                  {circle.memberCount > 5 && (
                    <div className="relative h-7 w-7 rounded-full border-2 border-[#13131a] bg-white/10 flex items-center justify-center text-[10px] text-gray-400">
                      +{circle.memberCount - 5}
                    </div>
                  )}
                </div>
              </div>

              {/* Features */}
              <div className="space-y-1.5">
                {["Real-time group chat", "Exam-focused study rooms", "Live doubt solving"].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs text-gray-400">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                    {f}
                  </div>
                ))}
              </div>
            </div>

            {/* CTA — changes based on auth state */}
            <AnimatePresence mode="wait">
              {joined ? (
                <motion.div key="joined" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  className="flex flex-col items-center gap-2 py-3">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <CheckCircle2 className="w-6 h-6 text-emerald-400" />
                  </div>
                  <p className="text-emerald-400 font-semibold">Redirecting...</p>
                </motion.div>
              ) : isSignedIn && user?.id && circle.members.some(m => m.userId === user.id) ? (
                <motion.div key="already_member" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  <p className="text-center text-emerald-400 text-sm font-semibold">You are already a member!</p>
                  <Button
                    onClick={() => setLocation(`/circles/${circle.id}`)}
                    className="w-full h-12 text-base font-bold gap-2 border-0 bg-white/10 hover:bg-white/20 text-white"
                  >
                    Open Circle <ArrowRight className="w-4 h-4" />
                  </Button>
                </motion.div>
              ) : isSignedIn ? (
                <motion.div key="join" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Button
                    onClick={handleJoin}
                    disabled={joining}
                    className="w-full h-12 text-base font-bold gap-2 border-0"
                    style={{ background: `linear-gradient(135deg, ${circle.coverColor}, ${circle.coverColor}88)` }}
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
                  <p className="text-center text-gray-400 text-sm">You're invited to join this study circle</p>
                  <SignUpButton mode="modal" forceRedirectUrl={`/invite/${code}`}>
                    <Button className="w-full h-12 text-base font-bold gap-2 border-0"
                      style={{ background: `linear-gradient(135deg, ${circle.coverColor}, ${circle.coverColor}88)` }}>
                      <Star className="w-4 h-4" /> Create Account & Join <ArrowRight className="w-4 h-4" />
                    </Button>
                  </SignUpButton>
                  <Button
                    variant="outline"
                    className="w-full h-10 border-white/10 text-gray-300 hover:bg-white/5 hover:text-white gap-2"
                    onClick={() => setLocation(`/preview/${code}`)}
                  >
                    <Eye className="w-4 h-4" /> Preview Circle First
                  </Button>
                  <SignInButton mode="modal" forceRedirectUrl={`/invite/${code}`}>
                    <Button variant="ghost" className="w-full h-9 text-gray-500 hover:text-gray-300 text-sm">
                      Already have an account? Sign in
                    </Button>
                  </SignInButton>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 mt-4">
          <BookOpen className="w-4 h-4 text-gray-600" />
          <p className="text-gray-600 text-xs">
            StudyCircle — Where toppers study together
          </p>
        </div>
      </motion.div>
    </div>
  );
}
