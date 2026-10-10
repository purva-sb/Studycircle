import { useEffect, useRef, useState } from "react";
import { useRoute, useLocation } from "wouter";
import { SignUpButton, SignInButton, useAuth } from "@clerk/clerk-react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";
import {
  Hash, Lock, Eye, Zap, ArrowRight, SmilePlus, Reply, Pin,
  BookOpen, MessageSquare, Users, Shield
} from "lucide-react";

interface PreviewMessage {
  id: string;
  body: string;
  createdAt: string;
  authorId: string;
  authorName: string | null;
  authorAvatar: string | null;
}

interface PreviewData {
  circle: {
    id: string;
    name: string;
    description: string;
    exam: string;
    coverColor: string;
  };
  channelName: string;
  messages: PreviewMessage[];
}

export default function PreviewPage() {
  const [, params] = useRoute("/preview/:code");
  const [, setLocation] = useLocation();
  const { isSignedIn } = useAuth();
  const code = params?.code || "";
  const scrollRef = useRef<HTMLDivElement>(null);

  const [data, setData] = useState<PreviewData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showJoinModal, setShowJoinModal] = useState(false);

  useEffect(() => {
    if (!code) return;
    fetch(`/api/invite/${code}/preview`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error);
        else setData(d);
      })
      .catch(() => setError("Failed to load preview"))
      .finally(() => setLoading(false));
  }, [code]);

  // Scroll to bottom on load
  useEffect(() => {
    if (data && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [data]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex items-center justify-center">
        <div className="w-12 h-12 rounded-full border-4 border-violet-500/30 border-t-violet-500 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-[#0a0a0f] flex flex-col items-center justify-center gap-4 px-4">
        <div className="w-20 h-20 rounded-2xl bg-red-500/10 flex items-center justify-center border border-red-500/20">
          <Lock className="w-10 h-10 text-red-400" />
        </div>
        <h1 className="text-2xl font-bold text-white">Preview Unavailable</h1>
        <p className="text-gray-400 text-center">{error || "This invite link has expired."}</p>
        <Button onClick={() => setLocation("/")} variant="outline" className="border-white/10 text-white hover:bg-white/5">
          Go to StudyCircle
        </Button>
      </div>
    );
  }

  const { circle, channelName, messages } = data;

  // Group consecutive messages from same author
  const grouped = messages.map((msg, idx) => ({
    ...msg,
    isConsecutive: idx > 0 && messages[idx - 1].authorId === msg.authorId,
  }));

  return (
    <div className="h-screen bg-[#0a0a0f] flex flex-col overflow-hidden">

      {/* ── Guest Banner ── */}
      <div
        className="shrink-0 flex items-center justify-between px-4 py-2.5 text-sm font-medium z-50"
        style={{ background: `linear-gradient(90deg, ${circle.coverColor}cc, ${circle.coverColor}44)` }}
      >
        <div className="flex items-center gap-2 text-white">
          <Eye className="w-4 h-4" />
          <span>You're viewing <strong>{circle.name}</strong> as a guest — messages are read-only</span>
        </div>
        <div className="flex items-center gap-2">
          <SignInButton mode="modal" forceRedirectUrl={`/invite/${code}`}>
            <Button size="sm" variant="ghost" className="text-white/80 hover:text-white hover:bg-white/10 h-7 text-xs">
              Sign in
            </Button>
          </SignInButton>
          {isSignedIn ? (
            <Button
              size="sm"
              className="h-7 text-xs font-bold gap-1.5 border-0 bg-white text-gray-900 hover:bg-white/90"
              onClick={() => setLocation(`/invite/${code}`)}
            >
              <Zap className="w-3 h-3" /> Join Circle
            </Button>
          ) : (
            <SignUpButton mode="modal" forceRedirectUrl={`/invite/${code}`}>
              <Button
                size="sm"
                className="h-7 text-xs font-bold gap-1.5 border-0 bg-white text-gray-900 hover:bg-white/90"
              >
                <Zap className="w-3 h-3" /> Join Free
              </Button>
            </SignUpButton>
          )}
        </div>
      </div>

      {/* ── Main Layout ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <div className="w-56 shrink-0 bg-[#111118] border-r border-white/5 flex flex-col">
          {/* Circle header */}
          <div
            className="p-4 border-b border-white/5"
            style={{ background: `linear-gradient(135deg, ${circle.coverColor}22, transparent)` }}
          >
            <div className="flex items-center gap-2">
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center text-base"
                style={{ background: circle.coverColor }}
              >
                📚
              </div>
              <div>
                <p className="text-white font-semibold text-sm leading-tight truncate">{circle.name}</p>
                <Badge className="text-[9px] px-1 py-0 border-0 mt-0.5" style={{ background: `${circle.coverColor}44`, color: circle.coverColor }}>
                  {circle.exam}
                </Badge>
              </div>
            </div>
          </div>

          {/* Channels */}
          <div className="p-3 flex-1">
            <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mb-2 px-1">Text Channels</p>
            <div
              className="flex items-center gap-1.5 px-2 py-1.5 rounded-md text-sm font-medium"
              style={{ background: `${circle.coverColor}22`, color: circle.coverColor }}
            >
              <Hash className="w-3.5 h-3.5 shrink-0" />
              <span className="truncate">{channelName}</span>
            </div>
          </div>

          {/* Join CTA in sidebar */}
          <div className="p-3 border-t border-white/5">
            {isSignedIn ? (
              <Button className="w-full h-9 text-xs font-bold gap-1.5 border-0"
                style={{ background: `linear-gradient(135deg, ${circle.coverColor}, ${circle.coverColor}88)` }}
                onClick={() => setLocation(`/invite/${code}`)}
              >
                <Users className="w-3.5 h-3.5" /> Join Circle
              </Button>
            ) : (
              <SignUpButton mode="modal" forceRedirectUrl={`/invite/${code}`}>
                <Button className="w-full h-9 text-xs font-bold gap-1.5 border-0"
                  style={{ background: `linear-gradient(135deg, ${circle.coverColor}, ${circle.coverColor}88)` }}>
                  <Users className="w-3.5 h-3.5" /> Join Circle
                </Button>
              </SignUpButton>
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#0d0d14]">

          {/* Channel header */}
          <div className="shrink-0 h-12 border-b border-white/5 flex items-center px-4 gap-2 bg-[#0d0d14]/80 backdrop-blur-sm">
            <Hash className="w-4 h-4 text-gray-400" />
            <span className="font-semibold text-white text-sm">{channelName}</span>
            <span className="text-gray-500 text-xs ml-1">— {circle.description}</span>
            <div className="ml-auto flex items-center gap-1.5 text-[11px] text-amber-400/80 bg-amber-400/10 border border-amber-400/20 rounded-full px-2.5 py-1">
              <Shield className="w-3 h-3" />
              <span>Read-only preview</span>
            </div>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-4 space-y-0.5">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 gap-3">
                <MessageSquare className="w-10 h-10 opacity-30" />
                <p className="text-sm">No messages yet — be the first to join!</p>
              </div>
            ) : (
              grouped.map((msg) => {
                const bodyLines = msg.body?.split('\n\n') || [];
                const lastLine = bodyLines[bodyLines.length - 1];
                const hasImage = lastLine?.startsWith("data:image/") || lastLine?.includes("res.cloudinary.com");
                const textPart = hasImage ? bodyLines.slice(0, -1).join('\n\n') : msg.body;
                const imgUrl = hasImage ? lastLine : null;

                return (
                  <div key={msg.id} className={`flex items-end gap-2 w-full ${msg.isConsecutive ? "mt-0.5" : "mt-5"}`}>
                    {/* Avatar */}
                    <div className="shrink-0 mb-0.5">
                      {!msg.isConsecutive ? (
                        <Avatar className="w-8 h-8 ring-2 ring-black/20">
                          <AvatarImage src={msg.authorAvatar || ""} />
                          <AvatarFallback className="text-[10px]" style={{ background: circle.coverColor }}>
                            {msg.authorName?.substring(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                      ) : (
                        <div className="w-8" />
                      )}
                    </div>

                    <div className="flex flex-col items-start max-w-[75%]">
                      {!msg.isConsecutive && (
                        <div className="flex items-baseline gap-2 mb-1 ml-0.5">
                          <span className="text-xs font-semibold text-white/80">{msg.authorName}</span>
                          <span className="text-[10px] text-gray-500">{format(new Date(msg.createdAt), "HH:mm")}</span>
                        </div>
                      )}

                      <div className="relative group">
                        {/* Message bubble */}
                        <div className="bg-[#1e1f2a] border border-white/5 rounded-2xl rounded-tl-sm overflow-hidden shadow-sm w-fit max-w-xs sm:max-w-sm">
                          {imgUrl && (
                            <div className="relative">
                              <img src={imgUrl} className="w-full max-w-[280px] max-h-[200px] object-cover" alt="attachment" />
                              {textPart && (
                                <div className="absolute bottom-0 left-0 right-0 bg-black/50 backdrop-blur-md px-3 py-1.5">
                                  <p className="text-white text-[13px] leading-snug">{textPart}</p>
                                </div>
                              )}
                            </div>
                          )}
                          {!imgUrl && textPart && (
                            <div className="px-3.5 py-2">
                              <p className="text-white/90 text-[14px] leading-snug whitespace-pre-wrap break-words">{textPart}</p>
                            </div>
                          )}
                        </div>

                        {/* Hover actions — all disabled with lock overlay */}
                        {isSignedIn ? (
                          <div className="absolute -top-7 left-0 opacity-0 group-hover:opacity-100 transition-all duration-150 cursor-pointer" onClick={() => setLocation(`/invite/${code}`)}>
                            <div className="bg-[#1e1f22] border border-white/10 rounded-full flex items-center px-1.5 py-0.5 gap-0.5 shadow-lg">
                              {["👍","😂","❤️"].map(e => (
                                <span key={e} className="w-7 h-7 flex items-center justify-center text-[13px] opacity-50 hover:opacity-80 transition-opacity rounded-full hover:bg-white/10">{e}</span>
                              ))}
                              <div className="w-px h-4 bg-white/10 mx-0.5" />
                              <span className="w-7 h-7 flex items-center justify-center opacity-50 rounded-full hover:bg-white/10">
                                <SmilePlus className="w-3.5 h-3.5 text-gray-400" />
                              </span>
                              <span className="w-7 h-7 flex items-center justify-center opacity-50 rounded-full hover:bg-white/10">
                                <Reply className="w-3.5 h-3.5 text-gray-400" />
                              </span>
                              <div className="flex items-center gap-1 ml-0.5 text-[10px] text-amber-400/70 bg-amber-400/10 rounded-full px-1.5 py-0.5">
                                <Lock className="w-2.5 h-2.5" />
                                <span>Join to react</span>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <SignUpButton mode="modal" forceRedirectUrl={`/invite/${code}`}>
                            <div className="absolute -top-7 left-0 opacity-0 group-hover:opacity-100 transition-all duration-150 cursor-pointer">
                              <div className="bg-[#1e1f22] border border-white/10 rounded-full flex items-center px-1.5 py-0.5 gap-0.5 shadow-lg">
                                {["👍","😂","❤️"].map(e => (
                                  <span key={e} className="w-7 h-7 flex items-center justify-center text-[13px] opacity-50 hover:opacity-80 transition-opacity rounded-full hover:bg-white/10">{e}</span>
                                ))}
                                <div className="w-px h-4 bg-white/10 mx-0.5" />
                                <span className="w-7 h-7 flex items-center justify-center opacity-50 rounded-full hover:bg-white/10">
                                  <SmilePlus className="w-3.5 h-3.5 text-gray-400" />
                                </span>
                                <span className="w-7 h-7 flex items-center justify-center opacity-50 rounded-full hover:bg-white/10">
                                  <Reply className="w-3.5 h-3.5 text-gray-400" />
                                </span>
                                <div className="flex items-center gap-1 ml-0.5 text-[10px] text-amber-400/70 bg-amber-400/10 rounded-full px-1.5 py-0.5">
                                  <Lock className="w-2.5 h-2.5" />
                                  <span>Join to react</span>
                                </div>
                              </div>
                            </div>
                          </SignUpButton>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })
            )}

            {/* Bottom fade + CTA */}
            <div className="h-6" />
          </div>

          {/* Input area — locked */}
          <div className="shrink-0 p-4 border-t border-white/5 bg-[#0d0d14]">
            {isSignedIn ? (
              <div onClick={() => setLocation(`/invite/${code}`)} className="flex items-center gap-3 bg-[#1a1a25] border border-white/10 rounded-xl px-4 py-3 cursor-pointer hover:border-violet-500/40 hover:bg-[#1e1e2e] transition-all group">
                <Lock className="w-4 h-4 text-gray-500 group-hover:text-violet-400 transition-colors shrink-0" />
                <span className="text-gray-500 text-sm group-hover:text-gray-400 transition-colors flex-1">
                  Join <strong className="text-white/60">{circle.name}</strong> to send messages...
                </span>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 px-3 py-1.5 rounded-lg transition-colors shrink-0">
                  <Zap className="w-3 h-3" />
                  Join Circle <ArrowRight className="w-3 h-3" />
                </div>
              </div>
            ) : (
              <SignUpButton mode="modal" forceRedirectUrl={`/invite/${code}`}>
                <div className="flex items-center gap-3 bg-[#1a1a25] border border-white/10 rounded-xl px-4 py-3 cursor-pointer hover:border-violet-500/40 hover:bg-[#1e1e2e] transition-all group">
                  <Lock className="w-4 h-4 text-gray-500 group-hover:text-violet-400 transition-colors shrink-0" />
                  <span className="text-gray-500 text-sm group-hover:text-gray-400 transition-colors flex-1">
                    Join <strong className="text-white/60">{circle.name}</strong> to send messages...
                  </span>
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-white bg-violet-600 hover:bg-violet-500 px-3 py-1.5 rounded-lg transition-colors shrink-0">
                    <Zap className="w-3 h-3" />
                    Join Free <ArrowRight className="w-3 h-3" />
                  </div>
                </div>
              </SignUpButton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
