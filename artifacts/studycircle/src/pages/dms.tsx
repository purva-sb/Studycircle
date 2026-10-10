import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import { useAuth, useUser } from "@clerk/clerk-react";
import { customFetch } from "@workspace/api-client-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { format } from "date-fns";
import {
  Send, Phone, Video, Search, MessageSquarePlus, SmilePlus,
  Reply, MoreHorizontal, Pencil, Trash2, X, Paperclip, Image as ImageIcon,
  ArrowLeft,
} from "lucide-react";
import { toast } from "sonner";
import { io } from "socket.io-client";
import { UserProfilePopover } from "@/components/user-profile-popover";
import { EmojiPicker } from "@/components/emoji-picker";
import { liveChatQueryOptions, slowDataQueryOptions } from "@/lib/query-client";
import { DmCall, IncomingCallNotification } from "@/components/dm-call";

export default function DirectMessages() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();

  const getConvIdFromUrl = () => new URLSearchParams(window.location.search).get("conv");
  const [activeConvId, setActiveConvId] = useState<string | null>(getConvIdFromUrl);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const convParam = params.get("conv");
    const callParam = params.get("call") as "voice" | "video" | null;
    
    if (convParam) setActiveConvId(convParam);
    if (callParam && convParam) {
      setCallConvId(convParam);
      setCallMode(callParam);
      
      // Clean up URL so it doesn't keep calling on refresh
      const newUrl = window.location.pathname + (convParam ? `?conv=${convParam}` : "");
      window.history.replaceState({}, '', newUrl);
    }
  }, [location]);

  const [message, setMessage] = useState("");
  const [onlineUsers, setOnlineUsers] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<any>(null);
  const [openPickerMsgId, setOpenPickerMsgId] = useState<string | null>(null);
  const [peerIsTyping, setPeerIsTyping] = useState(false);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingEmitTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Image upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imagePreview, setImagePreview] = useState<{ file: File; url: string } | null>(null);
  const [uploadingImage, setUploadingImage] = useState(false);

  // Call state
  const [callMode, setCallMode] = useState<null | "voice" | "video">(null);
  const [callConvId, setCallConvId] = useState<string | null>(null); // which conv we are in a call with
  const [incomingCall, setIncomingCall] = useState<{
    convId: string;
    mode: "voice" | "video";
    callerName: string;
    callerAvatar?: string;
  } | null>(null);

  // Light-box
  const [selectedImage, setSelectedImage] = useState<string | null>(null);

  const [tab, setTab] = useState<"dms" | "connections">("dms");

  const { data: conversations, isLoading: loadingConvs } = useQuery({
    queryKey: ["dms", "conversations"],
    queryFn: async () => {
      const res: any = await customFetch("/api/dms");
      return res.conversations;
    },
    ...slowDataQueryOptions,
  });

  const { data: messages, isLoading: loadingMessages } = useQuery({
    queryKey: ["dms", "messages", activeConvId],
    queryFn: async () => {
      const res: any = await customFetch(`/api/dms/${activeConvId}/messages`);
      return res.messages;
    },
    enabled: !!activeConvId,
    ...liveChatQueryOptions,
  });

  const { data: connectionsData, isLoading: loadingConnections } = useQuery({
    queryKey: ["dms", "connections"],
    queryFn: async () => {
      const res: any = await customFetch("/api/connections");
      return res.connections || [];
    },
    ...slowDataQueryOptions,
  });

  const acceptConnection = useMutation({
    mutationFn: async (id: string) => customFetch(`/api/connections/${id}/accept`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dms", "connections"] }),
  });

  const rejectConnection = useMutation({
    mutationFn: async (id: string) => customFetch(`/api/connections/${id}/reject`, { method: "POST" }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["dms", "connections"] }),
  });

  const sendMessage = useMutation({
    mutationFn: async (body: string) => {
      return customFetch(`/api/dms/${activeConvId}/messages`, {
        method: "POST",
        body: JSON.stringify({ body }),
      });
    },
    onSettled: () => {
      // Always refetch to get the real message and remove temp entries cleanly
      queryClient.invalidateQueries({ queryKey: ["dms", "messages", activeConvId] });
      queryClient.invalidateQueries({ queryKey: ["dms", "conversations"] });
    },
  });

  // Socket setup
  const activeConvIdRef = useRef(activeConvId);
  useEffect(() => {
    activeConvIdRef.current = activeConvId;
  }, [activeConvId]);

  const conversationsRef = useRef<any[]>([]);
  useEffect(() => {
    conversationsRef.current = conversations || [];
  }, [conversations]);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    let socket: ReturnType<typeof io> | null = null;

    const connect = async () => {
      const token = await getToken();
      if (!token || cancelled) return;

      socket = io(window.location.origin, {
        path: "/socket.io",
        auth: { token },
        transports: ["websocket"],
      });
      socketRef.current = socket;

      const joinAllRooms = () => {
        const convs = conversationsRef.current;
        if (convs && convs.length > 0) {
          convs.forEach((c: any) => socket?.emit("join_dm", c.id));
        }
      };

      socket.on("connect", () => {
        joinAllRooms();
      });

      socket.on("reconnect", () => {
        joinAllRooms();
      });

      socket.on("dm:presence", ({ userId, online }: { userId: string; online: boolean }) => {
        setOnlineUsers((prev) => {
          const next = new Set(prev);
          online ? next.add(userId) : next.delete(userId);
          return next;
        });
      });

      socket.on("dm:new", (payload: any) => {
        const msg = payload?.message;
        const currentActive = activeConvIdRef.current;
        if (!msg || !currentActive || msg.conversationId !== currentActive) {
          queryClient.invalidateQueries({ queryKey: ["dms", "conversations"] });
          return;
        }
        // Always invalidate — let the server be the source of truth for message shape
        queryClient.invalidateQueries({ queryKey: ["dms", "messages", currentActive] });
        queryClient.invalidateQueries({ queryKey: ["dms", "conversations"] });
      });

      socket.on("dm:typing", (data: { convId: string; userId: string }) => {
        if (data.convId === activeConvIdRef.current && data.userId !== user.id) {
          setPeerIsTyping(true);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => setPeerIsTyping(false), 3000);
        }
      });

      socket.on("dm:stop_typing", (data: { convId: string; userId: string }) => {
        if (data.convId === activeConvIdRef.current && data.userId !== user.id) {
          setPeerIsTyping(false);
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        }
      });

      // Call signalling
      socket.on("dm:call_decline", () => {
        toast("Call declined", { description: "The other user declined your call." });
        setCallMode(null);
      });
      socket.on("dm:call_end", () => {
        setCallMode(null);
        setCallConvId(null);
        setIncomingCall(null); // clears notification if caller cancels before callee responds
        toast("Call ended");
      });
      socket.on("dm:call_invite", (data: { convId: string; mode: "voice" | "video"; callerName: string; callerAvatar?: string }) => {
        setIncomingCall(data);
      });
    };

    void connect();
    return () => {
      cancelled = true;
      socket?.disconnect();
      socketRef.current = null;
      if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
      if (typingEmitTimeoutRef.current) clearTimeout(typingEmitTimeoutRef.current);
    };
  }, [user, queryClient, getToken]);

  // Join all conversation rooms whenever the list loads/updates
  // This covers the case where conversations load AFTER the socket connects
  useEffect(() => {
    if (socketRef.current?.connected && conversations && conversations.length > 0) {
      conversations.forEach((c: any) => {
        socketRef.current?.emit("join_dm", c.id);
      });
    }
  }, [conversations]);

  // Auto-scroll on new messages
  const prevCountRef = useRef(0);
  useEffect(() => {
    if (!scrollRef.current) return;
    const count = Array.isArray(messages) ? messages.length : 0;
    if (count > prevCountRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevCountRef.current = count;
  }, [messages]);

  const emitTyping = () => {
    if (!activeConvId || !socketRef.current) return;
    socketRef.current.emit("dm:typing", { convId: activeConvId, userId: user?.id });
    if (typingEmitTimeoutRef.current) clearTimeout(typingEmitTimeoutRef.current);
    typingEmitTimeoutRef.current = setTimeout(() => {
      socketRef.current?.emit("dm:stop_typing", { convId: activeConvId, userId: user?.id });
    }, 2500);
  };

  // ---- Image picker ----
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Only images are supported"); return; }
    if (file.size > 10 * 1024 * 1024) { toast.error("Image too large (max 10 MB)"); return; }
    setImagePreview({ file, url: URL.createObjectURL(file) });
  };

  const removeImage = () => {
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // ---- Send ----
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!message.trim() && !imagePreview) || !activeConvId) return;

    const textBody = message.trim();
    setMessage("");
    socketRef.current?.emit("dm:stop_typing", { convId: activeConvId, userId: user?.id });
    if (typingEmitTimeoutRef.current) clearTimeout(typingEmitTimeoutRef.current);

    let finalBody = textBody;

    // Upload image first if attached
    if (imagePreview) {
      setUploadingImage(true);
      const preview = imagePreview;
      setImagePreview(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      try {
        const formData = new FormData();
        formData.append("file", preview.file);
        const result = await customFetch<{ secure_url: string }>("/api/upload", {
          method: "POST",
          body: formData,
        });
        finalBody = textBody ? `${textBody}\n\n${result.secure_url}` : result.secure_url;
      } catch {
        toast.error("Image upload failed");
        setUploadingImage(false);
        return;
      }
      setUploadingImage(false);
    }

    if (!finalBody) return;

    // Optimistic update
    const tempId = "temp-" + Date.now();
    const tempMsg = {
      id: tempId,
      body: finalBody,
      createdAt: new Date().toISOString(),
      author: { id: user?.id, displayName: user?.fullName || "You", avatarUrl: user?.imageUrl },
    };
    queryClient.setQueryData(["dms", "messages", activeConvId], (old: any) => {
      if (!old) return [tempMsg];
      if (Array.isArray(old)) return [...old, tempMsg];
      return old;
    });

    sendMessage.mutate(finalBody);
  };

  // ---- Call helpers ----
  const startCall = (mode: "voice" | "video") => {
    if (!activeConvId || !socketRef.current) return;
    socketRef.current.emit("dm:call_invite", { 
      convId: activeConvId, 
      mode,
      callerName: user?.fullName || user?.username || "Someone",
      callerAvatar: user?.imageUrl
    });
    setCallConvId(activeConvId);
    setCallMode(mode);
  };

  const endCall = () => {
    if (socketRef.current) {
      // use callConvId which is the conv we are in a call with
      const convToClear = callConvId || activeConvId;
      if (convToClear) {
        socketRef.current.emit("dm:call_end", { convId: convToClear });
      }
    }
    setCallMode(null);
    setCallConvId(null);
  };

  const activeConv = conversations?.find((c: any) => c.id === activeConvId);

  return (
    <div className="flex h-[calc(100vh-4rem)] border border-border rounded-lg overflow-hidden bg-background">

      {/* Incoming call notification */}
      {incomingCall && !callMode && (
        <IncomingCallNotification
          callerName={incomingCall.callerName}
          callerAvatar={incomingCall.callerAvatar}
          mode={incomingCall.mode}
          onAccept={() => {
            socketRef.current?.emit("dm:call_accept", { convId: incomingCall.convId });
            setCallConvId(incomingCall.convId);
            setCallMode(incomingCall.mode);
            setIncomingCall(null);
          }}
          onDecline={() => {
            socketRef.current?.emit("dm:call_decline", { convId: incomingCall.convId });
            setIncomingCall(null);
          }}
        />
      )}

      {/* Active call overlay - uses callConvId so it works even when no conv is selected */}
      {callMode && callConvId && (() => {
        const callConv = conversations?.find((c: any) => c.id === callConvId);
        return (
          <DmCall
            convId={callConvId}
            mode={callMode}
            otherUser={callConv?.otherUser || { displayName: "User" }}
            myName={user?.fullName || user?.primaryEmailAddress?.emailAddress?.split("@")[0] || "Me"}
            myAvatar={user?.imageUrl}
            onEnd={endCall}
          />
        );
      })()}

      {/* Sidebar */}
      <div className={`${activeConvId ? "hidden md:flex" : "flex"} w-full md:w-72 border-r border-border bg-muted/10 flex-col shrink-0`}>
        <div className="p-4 border-b border-border flex items-center justify-between">
          <div className="flex gap-4">
            <button onClick={() => setTab("dms")} className={`font-bold text-lg tracking-tight ${tab === "dms" ? "text-foreground" : "text-muted-foreground"}`}>Messages</button>
            <button onClick={() => setTab("connections")} className={`font-bold text-lg tracking-tight relative ${tab === "connections" ? "text-foreground" : "text-muted-foreground"}`}>
              Requests
              {connectionsData?.some((c: any) => c.status === "pending" && c.recipientId === user?.id) && (
                <span className="absolute -top-1 -right-2.5 w-2 h-2 rounded-full bg-red-500" />
              )}
            </button>
          </div>
          <Button size="icon" variant="ghost" onClick={() => toast("New DM coming soon")}>
            <MessageSquarePlus className="w-4 h-4" />
          </Button>
        </div>
        {tab === "dms" ? (
          <>
            <div className="p-2">
              <div className="relative">
                <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input placeholder="Search conversations…" className="pl-9 bg-muted/30 border-none h-9 text-sm" />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {loadingConvs ? (
                <div className="space-y-2 p-2">
                  {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 w-full rounded-xl" />)}
                </div>
              ) : conversations?.length === 0 ? (
                <div className="text-center p-6 text-muted-foreground text-sm mt-10">
                  <MessageSquarePlus className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  No conversations yet
                </div>
              ) : (
                conversations?.map((conv: any) => {
                  const isActive = activeConvId === conv.id;
                  return (
                    <button
                      key={conv.id}
                      onClick={() => setActiveConvId(conv.id)}
                      className={`w-full flex items-center gap-3 p-2.5 rounded-xl transition-all text-left group ${
                        isActive
                          ? "bg-violet-500/20 ring-1 ring-violet-500/30"
                          : "hover:bg-muted/50"
                      }`}
                    >
                      <div className="relative shrink-0">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={conv.otherUser.avatarUrl} />
                          <AvatarFallback className="bg-violet-900/50 text-sm">
                            {conv.otherUser.displayName.substring(0, 2).toUpperCase()}
                          </AvatarFallback>
                        </Avatar>
                        {onlineUsers.has(conv.otherUser.id) && (
                          <span className="absolute bottom-0 right-0 w-3 h-3 rounded-full bg-green-400 border-2 border-background" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-sm truncate">{conv.otherUser.displayName}</div>
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {conv.lastMessage?.body?.startsWith("https://res.cloudinary.com")
                            ? "📷 Photo"
                            : conv.lastMessage?.body || "Start a conversation"}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {loadingConnections ? (
              <div className="space-y-4">
                {[1, 2].map(i => <Skeleton key={i} className="h-20 w-full rounded-xl" />)}
              </div>
            ) : connectionsData?.filter((c: any) => c.status === "pending" && c.recipientId === user?.id).length === 0 ? (
              <div className="text-center p-6 text-muted-foreground text-sm mt-10">
                No pending requests
              </div>
            ) : (
              connectionsData?.filter((c: any) => c.status === "pending" && c.recipientId === user?.id).map((req: any) => (
                <div key={req.id} className="bg-muted/30 p-3 rounded-xl border border-border">
                  <div className="flex items-center gap-3 mb-3">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={req.requester?.avatarUrl} />
                      <AvatarFallback>{req.requester?.displayName?.substring(0,2)}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate">{req.requester?.displayName}</p>
                      {req.context && <p className="text-[10px] text-muted-foreground truncate">{req.context}</p>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button 
                      size="sm" 
                      className="flex-1 h-8 bg-violet-600 hover:bg-violet-700 text-white"
                      disabled={acceptConnection.isPending}
                      onClick={() => acceptConnection.mutate(req.id)}
                    >
                      Accept
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1 h-8 border-border"
                      disabled={rejectConnection.isPending}
                      onClick={() => rejectConnection.mutate(req.id)}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {/* Main Chat Area */}
      <div className={`${!activeConvId ? "hidden md:flex" : "flex"} flex-1 flex-col min-w-0`}>
        {activeConvId ? (
          <>
            {/* Header */}
            <div className="h-14 border-b border-border px-4 flex items-center justify-between bg-background/80 backdrop-blur-sm shrink-0">
              <div className="flex items-center gap-3">
                <Button variant="ghost" size="icon" className="md:hidden -ml-2 mr-1" onClick={() => setLocation("/dms")}>
                  <ArrowLeft className="h-5 w-5" />
                </Button>
                <div className="relative">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={activeConv?.otherUser?.avatarUrl} />
                  <AvatarFallback className="bg-violet-900/50 text-sm">
                    {activeConv?.otherUser?.displayName?.substring(0, 2) || "..."}
                  </AvatarFallback>
                </Avatar>
                {onlineUsers.has(activeConv?.otherUser?.id) && (
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-background" />
                )}
              </div>
              {activeConv ? (
                <div>
                  <h3 className="font-bold text-sm leading-tight">{activeConv.otherUser.displayName}</h3>
                  <p className="text-xs text-muted-foreground">
                    {onlineUsers.has(activeConv.otherUser.id)
                      ? <span className="text-green-400">Online</span>
                      : "Offline"}
                  </p>
                </div>
              ) : (
                <Skeleton className="h-8 w-32" />
              )}
            </div>
            <div className="flex items-center gap-1">
              <Button variant="ghost" size="icon" onClick={() => startCall("voice")} className="h-9 w-9 text-muted-foreground hover:bg-violet-500/20 hover:text-violet-400 rounded-xl transition-all">
                <Phone className="h-4 w-4" />
              </Button>
              <Button variant="ghost" size="icon" onClick={() => startCall("video")} className="h-9 w-9 text-muted-foreground hover:bg-violet-500/20 hover:text-violet-400 rounded-xl transition-all">
                <Video className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-1" ref={scrollRef}>
            {loadingMessages ? (
              <div className="space-y-4">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex gap-3">
                    <Skeleton className="h-9 w-9 rounded-full shrink-0" />
                    <div className="space-y-2">
                      <Skeleton className="h-3 w-24" />
                      <Skeleton className="h-10 w-52" />
                    </div>
                  </div>
                ))}
              </div>
            ) : messages?.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-muted-foreground py-20">
                <Avatar className="h-20 w-20 mb-4 ring-4 ring-violet-500/20">
                  <AvatarImage src={activeConv?.otherUser?.avatarUrl} />
                  <AvatarFallback className="text-3xl bg-violet-900/50">
                    {activeConv?.otherUser?.displayName?.substring(0, 2) || "?"}
                  </AvatarFallback>
                </Avatar>
                <p className="text-base font-semibold text-foreground">
                  Start chatting with {activeConv?.otherUser?.displayName || "this user"}
                </p>
                <p className="text-sm mt-1">Send a message or start a call 👋</p>
              </div>
            ) : (
              messages?.map((msg: any, idx: number) => {
                // Guard: skip rendering if author is missing (malformed/temp message)
                if (!msg?.author) return null;

                const isMe = msg.author.id === user?.id;
                const prevMsg = idx > 0 ? messages[idx - 1] : null;
                const isConsecutive =
                  !!prevMsg?.author &&
                  prevMsg.author.id === msg.author.id &&
                  new Date(msg.createdAt).getTime() - new Date(prevMsg.createdAt).getTime() < 5 * 60 * 1000;
                const isTemp = String(msg.id).startsWith("temp-");

                const bodyLines = msg.body?.split("\n\n") || [];
                const lastLine = bodyLines[bodyLines.length - 1];
                const hasImage = lastLine?.includes("res.cloudinary.com") || lastLine?.startsWith("data:image/");
                const textPart = hasImage ? bodyLines.slice(0, -1).join("\n\n") : msg.body;
                const imgUrl = hasImage ? lastLine : null;
                const isImageOnly = !textPart && !!imgUrl;

                return (
                  <div
                    key={msg.id}
                    className={`flex w-full group relative ${isMe ? "justify-end" : "justify-start"} ${isConsecutive ? "mt-1" : "mt-5"} ${isTemp ? "opacity-70" : ""}`}
                  >
                    {/* Hover actions */}
                    <div className={`absolute -top-7 ${isMe ? "right-10" : "left-10"} opacity-0 group-hover:opacity-100 transition-all duration-150 bg-white dark:bg-[#1e1f22] shadow-lg border border-border/40 rounded-full flex items-center px-1 py-0.5 z-10`}>
                      <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-sm" onClick={() => toast("Reply coming soon")}>
                        <Reply className="w-3.5 h-3.5" />
                      </Button>
                      {isMe && (
                        <>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-sm" onClick={() => toast("Edit coming soon")}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button variant="ghost" size="icon" className="h-7 w-7 rounded-full text-red-400 hover:text-red-500 text-sm" onClick={() => toast("Delete coming soon")}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </>
                      )}
                    </div>

                    <div className={`flex items-end gap-2 max-w-[72%] ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                      {!isMe && (
                        <div className="shrink-0 mb-1">
                          {!isConsecutive ? (
                            <UserProfilePopover
                              userId={msg.author.id}
                              trigger={
                                <Avatar className="w-8 h-8 cursor-pointer hover:opacity-80 transition-opacity ring-2 ring-background shadow-sm">
                                  <AvatarImage src={msg.author.avatarUrl} />
                                  <AvatarFallback className="text-xs bg-violet-900/50">
                                    {msg.author.displayName.substring(0, 2)}
                                  </AvatarFallback>
                                </Avatar>
                              }
                            />
                          ) : (
                            <div className="w-8" />
                          )}
                        </div>
                      )}

                      <div className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                        {!isMe && !isConsecutive && (
                          <span className="text-xs font-semibold text-muted-foreground mb-1 ml-1">
                            {msg.author.displayName}
                          </span>
                        )}

                        <div
                          className={`relative shadow-sm group/bubble flex flex-col ${
                            isImageOnly
                              ? "rounded-[18px] overflow-hidden border border-black/20 dark:border-zinc-700"
                              : `text-[15px] overflow-hidden ${
                                  isMe
                                    ? "bg-gradient-to-br from-violet-500 to-indigo-600 text-white border-none"
                                    : "bg-white dark:bg-[#1e1f22] border border-border/40 text-foreground"
                                } ${
                                  isConsecutive
                                    ? isMe ? "rounded-2xl rounded-tr-sm" : "rounded-2xl rounded-tl-sm"
                                    : isMe ? "rounded-2xl rounded-tr-sm rounded-br-2xl" : "rounded-2xl rounded-tl-sm rounded-bl-2xl"
                                }`
                          }`}
                        >
                          {imgUrl && (
                            <img
                              src={imgUrl}
                              onClick={() => setSelectedImage(imgUrl)}
                              className={`${isImageOnly ? "max-w-[280px] max-h-[300px]" : "max-w-[240px] max-h-[200px] mb-2 rounded-xl"} object-cover cursor-pointer hover:opacity-90 transition-opacity w-full`}
                              alt="attachment"
                            />
                          )}
                          {!isImageOnly && (
                            <div className="px-3.5 py-2 flex flex-col">
                              {textPart && (
                                <p className="whitespace-pre-wrap leading-snug break-words text-[14.5px]">
                                  {textPart}
                                  {/* Invisible spacer so text never overlaps timestamp */}
                                  <span className="inline-block w-[52px]" aria-hidden="true" />
                                </p>
                              )}
                              <div
                                className={`flex items-center gap-1 text-[10px] font-medium whitespace-nowrap self-end -mt-3.5 ${isMe ? "text-white/70" : "text-muted-foreground"}`}
                              >
                                {isTemp && <span className="italic">sending…</span>}
                                <span>{format(new Date(msg.createdAt), "HH:mm")}</span>
                                {isMe && !isTemp && <span className="text-white/70">✓✓</span>}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Typing indicator */}
          {peerIsTyping && (
            <div className="px-6 pb-1 flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-muted/60 border border-border/30 rounded-full px-3 py-1.5 shadow-sm">
                <span className="text-[11px] text-muted-foreground">
                  {activeConv?.otherUser?.displayName} is typing
                </span>
                <span className="flex gap-0.5 items-center">
                  {[0, 1, 2].map((i) => (
                    <span
                      key={i}
                      className="w-1.5 h-1.5 rounded-full bg-violet-400 animate-bounce"
                      style={{ animationDelay: `${i * 0.15}s`, animationDuration: "0.8s" }}
                    />
                  ))}
                </span>
              </div>
            </div>
          )}

          {/* Input */}
          <div className="p-3 shrink-0 bg-background border-t border-border/50">
            {/* Image preview */}
            {imagePreview && (
              <div className="mb-2 relative w-fit">
                <img
                  src={imagePreview.url}
                  alt="preview"
                  className="h-20 w-20 object-cover rounded-xl border border-border/40"
                />
                <button
                  onClick={removeImage}
                  className="absolute -top-2 -right-2 bg-background border border-border/60 rounded-full p-0.5 hover:bg-red-500/10 hover:border-red-500/50 transition-all"
                >
                  <X className="w-3 h-3 text-red-400" />
                </button>
              </div>
            )}

            <form
              onSubmit={handleSend}
              className="relative flex items-end gap-2 bg-muted/30 border border-border/60 focus-within:border-violet-500/50 rounded-2xl px-3 py-2 transition-all"
            >
              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleFileChange}
              />

              {/* Attachment button */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 text-muted-foreground hover:text-violet-400 transition-colors mb-2"
                title="Attach image"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              <textarea
                placeholder={`Message ${activeConv ? `@${activeConv.otherUser.displayName}` : "..."}`}
                className="flex-1 min-h-[36px] max-h-[160px] resize-none bg-transparent border-0 focus:outline-none text-[14px] leading-relaxed py-0.5"
                value={message}
                onChange={(e) => { setMessage(e.target.value); emitTyping(); }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e as any);
                  }
                }}
                rows={1}
              />

              <Button
                type="submit"
                size="icon"
                className={`h-9 w-9 shrink-0 rounded-xl transition-all ${
                  (message.trim() || imagePreview) && !uploadingImage
                    ? "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/25"
                    : "bg-muted text-muted-foreground"
                }`}
                disabled={(!message.trim() && !imagePreview) || sendMessage.isPending || uploadingImage}
              >
                {uploadingImage || sendMessage.isPending ? (
                  <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </Button>
            </form>
          </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground bg-muted/5 gap-4">
            <div className="w-16 h-16 rounded-2xl bg-violet-500/10 flex items-center justify-center">
              <MessageSquarePlus className="w-8 h-8 text-violet-400" />
            </div>
            <div className="text-center">
              <p className="font-semibold text-foreground">Your messages</p>
              <p className="text-sm mt-1">Select a conversation to start chatting</p>
            </div>
          </div>
        )}
      </div>

      {/* Image Lightbox */}
      {selectedImage && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 backdrop-blur-sm"
          onClick={() => setSelectedImage(null)}
        >
          <button
            className="absolute top-6 right-6 text-white/70 hover:text-white bg-black/50 hover:bg-black/80 rounded-full p-2 transition-all"
            onClick={(e) => { e.stopPropagation(); setSelectedImage(null); }}
          >
            <X className="w-6 h-6" />
          </button>
          <img
            src={selectedImage}
            className="max-w-full max-h-full object-contain rounded-xl shadow-2xl"
            alt="fullscreen"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
