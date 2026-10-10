import { useState, useEffect, useRef, useCallback } from "react";
import { useRoute, useLocation } from "wouter";
import { useGetCircle, useListCircleChannels, useListChannelMessages, useSendChannelMessage, getListChannelMessagesQueryKey, getGetCircleQueryKey, getListCircleChannelsQueryKey, customFetch } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth, useUser } from "@clerk/clerk-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Hash, Volume2, Send, SmilePlus, Pin, PinOff, Shield, Video, Phone, Monitor, PhoneOff, Mic, MicOff, VideoOff, ScreenShare, Settings, Users, Plus, ChevronDown, Sun, Moon, Paperclip, X, Reply, Forward, MoreHorizontal, Pencil, Trash2, Menu, Link2, Search, MessageSquare } from "lucide-react";
import { format } from "date-fns";
import { VoiceChannelRoom } from "@/components/voice-channel-room";
import { UserProfilePopover } from "@/components/user-profile-popover";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useTheme } from "next-themes";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator, DropdownMenuLabel } from "@/components/ui/dropdown-menu";
import { io } from "socket.io-client";
import { EmojiPicker } from "@/components/emoji-picker";
import { liveChatQueryOptions } from "@/lib/query-client";
import { MessageSearch } from "@/components/message-search";

export default function CircleWorkspace() {
  const [, params] = useRoute("/circles/:id");
  const [, setLocation] = useLocation();
  const circleId = params?.id || "";
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { getToken } = useAuth();
  const { theme, setTheme } = useTheme();

  const displayName = user?.fullName || user?.primaryEmailAddress?.emailAddress?.split("@")[0] || "You";
  const avatarUrl = user?.imageUrl || "";

  const { data: circle, isLoading: loadingCircle } = useGetCircle(circleId, {
    query: { enabled: !!circleId, staleTime: 2 * 60 * 1000, refetchOnWindowFocus: false },
  });
  const { data: channels, isLoading: loadingChannels } = useListCircleChannels(circleId, {
    query: { enabled: !!circleId, staleTime: 2 * 60 * 1000, refetchOnWindowFocus: false },
  });

  const [activeChannelId, setActiveChannelId] = useState<string>("");
  const [message, setMessage] = useState("");
  const [pendingImage, setPendingImage] = useState<string | null>(null);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState("");
  const [activeVoiceChannel, setActiveVoiceChannel] = useState<{id: string, name: string} | null>(null);
  const [replyTo, setReplyTo] = useState<any | null>(null);
  const [inVoice, setInVoice] = useState(false);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(false);
  const [screenShare, setScreenShare] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [newChannelName, setNewChannelName] = useState("");
  const [newChannelKind, setNewChannelKind] = useState<"general" | "doubts" | "announcements" | "voice">("general");
  const [isCreatingChannel, setIsCreatingChannel] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showMembers, setShowMembers] = useState(false);
  const [typingUsers, setTypingUsers] = useState<Map<string, string>>(new Map());
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const typingTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const socketRef = useRef<any>(null);
  // Keep a ref to the latest activeChannelId so socket handlers never
  // go stale without requiring the whole socket to reconnect.
  const activeChannelIdRef = useRef(activeChannelId);
  useEffect(() => { activeChannelIdRef.current = activeChannelId; }, [activeChannelId]);
  
  // @Mentions
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionIndex, setMentionIndex] = useState(0);

  // Search and Pinned states
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showPinned, setShowPinned] = useState(false);
  
  // Global Ctrl+K search
  const [globalSearchOpen, setGlobalSearchOpen] = useState(false);

  // Image Lightbox state
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  // Emoji Picker: stores the msg.id whose picker is currently open
  const [openPickerMsgId, setOpenPickerMsgId] = useState<string | null>(null);

  // Role definitions with colors and icons
  const roleConfig: Record<string, { color: string; label: string; icon: string }> = {
    "owner":      { color: "text-amber-400",   label: "Owner",      icon: "👑" },
    "co-owner":   { color: "text-orange-400",  label: "Co-Owner",   icon: "⭐" },
    "co-leader":  { color: "text-rose-400",    label: "Co-Leader",  icon: "🔥" },
    "moderator":  { color: "text-blue-400",    label: "Moderator",  icon: "🛡️" },
    "legend":     { color: "text-purple-400",  label: "Legend",     icon: "💎" },
    "elder":      { color: "text-emerald-400", label: "Elder",      icon: "🌿" },
    "member":     { color: "text-foreground",  label: "Member",     icon: "" },
  };
  
  // Check if current user is the owner
  const myMembership = circle?.members?.find((m: any) => m.userId === user?.id);
  const isOwner = myMembership?.role === "owner";
  const canModerateMessages = isOwner || ["moderator", "co-owner", "co-leader"].includes(myMembership?.role);
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editCircleName, setEditCircleName] = useState("");
  const [editCircleDesc, setEditCircleDesc] = useState("");
  const [editCircleColor, setEditCircleColor] = useState("");
  const [isUpdatingCircle, setIsUpdatingCircle] = useState(false);

  useEffect(() => {
    if (channels && channels.length > 0 && !activeChannelId) {
      setActiveChannelId(channels[0].id);
    }
  }, [channels, activeChannelId]);

  // Ctrl+K / Cmd+K → open global search
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "k") {
        e.preventDefault();
        setGlobalSearchOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  const { data: messages, isLoading: loadingMessages } = useListChannelMessages(activeChannelId, {
    query: { enabled: !!activeChannelId, ...liveChatQueryOptions },
  });
  const sendMessage = useSendChannelMessage();

  const prevMessageCountRef = useRef<number>(0);
  useEffect(() => {
    const count = Array.isArray(messages) ? messages.length : (messages as any)?.messages?.length ?? 0;
    if (count > prevMessageCountRef.current) {
      // Only scroll to bottom when NEW messages arrive, not on reaction updates
      if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevMessageCountRef.current = count;
  }, [messages]);

  // Stable WebSocket connection — does NOT reconnect on channel switch.
  // All message handlers read activeChannelId from a ref.
  useEffect(() => {
    if (!circleId || !user?.id) return;

    let cancelled = false;
    let socket: ReturnType<typeof io> | null = null;

    const connect = async () => {
      const token = await getToken();
      if (!token || cancelled) return;

      socket = io(window.location.origin, { auth: { token }, transports: ["websocket"] });
      socketRef.current = socket;

      socket.on("connect", () => {
        socket?.emit("join_circle", { circleId, userId: user.id });
        if (activeChannelIdRef.current) {
          socket?.emit("join_channel", activeChannelIdRef.current);
        }
      });

      socket.on("message:new", (msg: Record<string, unknown>) => {
        if (!msg?.id) return;
        const channelId = activeChannelIdRef.current;
        if (!channelId) return;
        const bodyStr = String(msg.body || "");
        if (msg.authorId !== user?.id && bodyStr.includes(`@${displayName}`)) {
          if ("Notification" in window && Notification.permission === "granted") {
            new Notification("StudyCircle", { body: "You were mentioned!", icon: "/favicon.ico" });
          }
        }
        queryClient.setQueryData(getListChannelMessagesQueryKey(channelId), (old: unknown) => {
          const list = Array.isArray(old) ? old : [];
          if (list.some((m: { id?: string }) => m.id === msg.id)) return list;
          return [...list, msg];
        });
      });

      socket.on("message:edit", (payload: { id: string } & Record<string, unknown>) => {
        if (!payload?.id) return;
        const channelId = activeChannelIdRef.current;
        if (!channelId) return;
        queryClient.setQueryData(getListChannelMessagesQueryKey(channelId), (old: unknown) => {
          const list = Array.isArray(old) ? old : [];
          return list.map((m: { id: string }) => (m.id === payload.id ? { ...m, ...payload } : m));
        });
      });

      socket.on("message:delete", (payload: { id: string }) => {
        if (!payload?.id) return;
        const channelId = activeChannelIdRef.current;
        if (!channelId) return;
        queryClient.setQueryData(getListChannelMessagesQueryKey(channelId), (old: unknown) => {
          const list = Array.isArray(old) ? old : [];
          return list.filter((m: { id: string }) => m.id !== payload.id);
        });
      });

      socket.on("message:reactions", (payload: { messageId: string; reactions: unknown[] }) => {
        if (!payload?.messageId) return;
        const channelId = activeChannelIdRef.current;
        if (!channelId) return;
        queryClient.setQueryData(getListChannelMessagesQueryKey(channelId), (old: unknown) => {
          const list = Array.isArray(old) ? old : [];
          return list.map((m: { id: string; reactions?: unknown[] }) =>
            m.id === payload.messageId ? { ...m, reactions: payload.reactions } : m,
          );
        });
      });

      socket.on("presence:update", ({ onlineUserIds: ids }: { onlineUserIds: string[] }) => {
        setOnlineUserIds(new Set(ids));
      });

      socket.on("typing:start", ({ userId: typerId, displayName: typerName }: { userId: string; displayName: string }) => {
        setTypingUsers(prev => new Map(prev).set(typerId, typerName));
      });
      socket.on("typing:stop", ({ userId: typerId }: { userId: string }) => {
        setTypingUsers(prev => {
          const next = new Map(prev);
          next.delete(typerId);
          return next;
        });
      });
    };

    void connect();

    return () => {
      cancelled = true;
      socket?.disconnect();
      socketRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [circleId, user?.id, getToken, queryClient, displayName]); // intentionally excludes activeChannelId — use ref

  // Lightweight channel subscription — join/leave without reconnecting the socket
  useEffect(() => {
    if (!activeChannelId) return;
    socketRef.current?.emit("join_channel", activeChannelId);
    return () => {
      socketRef.current?.emit("leave_channel", activeChannelId);
    };
  }, [activeChannelId]);

  // Request notification permissions for @mentions
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  useEffect(() => {
    if (!searchQuery) {
      setSearchResults(null);
      setIsSearching(false);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data: any = await customFetch(`/api/channels/${activeChannelId}/messages/search?q=${encodeURIComponent(searchQuery)}`);
        setSearchResults(data.messages);
      } catch (err) {
        setSearchResults([]);
      } finally {
        setIsSearching(false);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [searchQuery, activeChannelId]);

  if (loadingCircle || !circle || loadingChannels) {
    return (
      <div className="flex h-[calc(100vh-4rem)] gap-0 rounded-xl overflow-hidden border border-white/10">
        <Skeleton className="w-60 h-full" />
        <Skeleton className="flex-1 h-full" />
        <Skeleton className="w-60 h-full" />
      </div>
    );
  }

  const textChannels = channels?.filter(c => ["general", "doubts", "announcements"].includes(c.kind)) || [];
  const voiceChannels = channels?.filter(c => c.kind === "voice") || [];
  const activeChannel = channels?.find(c => c.id === activeChannelId);

  const handleChangeRole = async (targetUserId: string, newRole: string) => {
    try {
      await customFetch(`/api/circles/${circleId}/members/${targetUserId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ role: newRole })
      });
      toast.success(`Role updated to ${roleConfig[newRole]?.label || newRole}`);
      queryClient.invalidateQueries({ queryKey: getGetCircleQueryKey(circleId) });
    } catch (err) {
      toast.error("Failed to change role");
    }
  };

  const handleKickMember = async (targetUserId: string, name: string) => {
    if (!confirm(`Are you sure you want to kick ${name}?`)) return;
    try {
      await customFetch(`/api/circles/${circleId}/members/${targetUserId}`, {
        method: "DELETE",
      });
      toast.success(`${name} has been kicked`);
      queryClient.invalidateQueries({ queryKey: getGetCircleQueryKey(circleId) });
    } catch (err) {
      toast.error("Failed to kick member");
    }
  };

  const handleInvite = async () => {
    try {
      const data: any = await customFetch(`/api/circles/${circleId}/invites`, { method: "POST" });
      const fullUrl = `${window.location.origin}/invite/${data.code}`;
      
      // Fallback for clipboard
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(fullUrl);
      } else {
        const textArea = document.createElement("textarea");
        textArea.value = fullUrl;
        document.body.appendChild(textArea);
        textArea.select();
        document.execCommand("copy");
        textArea.remove();
      }

      toast.success("Invite link copied! Share it with friends 🔗", { duration: 4000 });
    } catch (err: any) {
      toast.error(err?.message || "Failed to create invite link");
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!message.trim() && !pendingImage) || !activeChannelId || isUploading) return;

    let finalImageUrl = null;

    if (pendingImageFile) {
      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", pendingImageFile);
        
        const res = await customFetch<{secure_url: string}>(`/api/upload`, {
          method: "POST",
          body: formData
        });
        
        if (!res.secure_url) throw new Error("Upload failed");
        finalImageUrl = res.secure_url;
      } catch (err) {
        toast.error("Failed to upload image. Please try again.");
        setIsUploading(false);
        return;
      }
      setIsUploading(false);
    }
    if (finalImageUrl && !message.trim()) {
      setPendingImage(null);
      setPendingImageFile(null);
      
      sendMessage.mutateAsync({ id: activeChannelId, data: { body: finalImageUrl } }).catch(() => {
        toast.error("Failed to send message");
      });
    }
    
    if (message.trim()) {
      let finalBody = message.trim();
      
      // If message and image sent together, append the image URL to the body
      if (finalImageUrl) {
        finalBody = `${finalBody}\n\n${finalImageUrl}`;
      }

      if (replyTo) {
        let snippet = replyTo.body;
        // Check for base64 or cloudinary url
        if (snippet.startsWith("data:image/") || snippet.startsWith("http")) snippet = "[Image Attachment]";
        else snippet = snippet.split('\n')[0].substring(0, 60) + (snippet.length > 60 ? "..." : "");
        
        finalBody = `> **@${replyTo.authorName}** ${snippet}\n\n${finalBody}`;
      }

      setMessage("");
      setReplyTo(null);
      setPendingImage(null);
      setPendingImageFile(null);

      sendMessage.mutateAsync({ id: activeChannelId, data: { body: finalBody } }).catch(() => {
        toast.error("Failed to send message");
      });
    }
  };

  const handlePinMessage = async (msgId: string) => {
    const queryKey = getListChannelMessagesQueryKey(activeChannelId);
    try {
      await customFetch(`/api/messages/${msgId}/pin`, { method: "PATCH" });
      // Socket `message:edit` patches cache; fallback if socket missed:
      queryClient.setQueryData(queryKey, (old: unknown) => {
        const list = Array.isArray(old) ? old : [];
        return list.map((m: { id: string; pinned?: boolean }) =>
          m.id === msgId ? { ...m, pinned: !m.pinned } : m,
        );
      });
    } catch (err) {
      toast.error("Failed to pin message");
    }
  };

  const handleStartDM = async (targetUserId: string) => {
    if (targetUserId === user?.id) {
      toast("You can't message yourself!");
      return;
    }
    try {
      const data: any = await customFetch(`/api/dms/user/${targetUserId}`, { method: "POST" });
      queryClient.invalidateQueries({ queryKey: ["dms", "conversations"] });
      setLocation(`/dms?conv=${data.conversation.id}`);
    } catch (err: any) {
      toast.error(err?.message || "Failed to start conversation");
    }
  };


  const handleDeleteMessage = async (messageId: string) => {
    try {
      await customFetch(`/api/messages/${messageId}`, { method: "DELETE" });
      toast.success("Message deleted");
    } catch (err) {
      toast.error("Failed to delete message");
    }
  };

  const handleEditMessage = async (messageId: string, newTextPart: string) => {
    const originalMsg = messages?.find(m => m.id === messageId);
    if (!originalMsg) return;

    const isReply = originalMsg.body.startsWith("> **@");
    const parts = isReply ? originalMsg.body.split('\n\n') : [originalMsg.body];
    const replyHeader = isReply ? parts[0] : null;
    const actualBody = isReply ? parts.slice(1).join('\n\n') : originalMsg.body;
    
    const bodyLines = actualBody.split('\n\n');
    const lastLine = bodyLines[bodyLines.length - 1];
    const hasImageAttachment = lastLine?.startsWith("data:image/") || lastLine?.includes("res.cloudinary.com");
    const imgUrl = hasImageAttachment ? lastLine : null;

    let finalBody = newTextPart.trim();
    if (imgUrl) finalBody = finalBody ? `${finalBody}\n\n${imgUrl}` : imgUrl;
    if (replyHeader) finalBody = `${replyHeader}\n\n${finalBody}`;

    try {
      await customFetch(`/api/messages/${messageId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ body: finalBody })
      });
      setEditingMessageId(null);
      setEditingContent("");
      queryClient.setQueryData(getListChannelMessagesQueryKey(activeChannelId), (old: unknown) => {
        const list = Array.isArray(old) ? old : [];
        return list.map((m: { id: string; body?: string }) =>
          m.id === messageId ? { ...m, body: finalBody } : m,
        );
      });
    } catch (err) {
      toast.error("Failed to edit message");
    }
  };

  const handleCreateChannel = async () => {
    if (!newChannelName.trim()) {
      toast.error("Channel name cannot be empty");
      return;
    }
    
    setIsCreatingChannel(true);
    try {
      const newChannel: any = await customFetch(`/api/circles/${circleId}/channels`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newChannelName,
          kind: newChannelKind,
          description: "New channel"
        })
      });
      
      toast.success(`Channel #${newChannel.name} created!`);
      
      // Refresh channels list
      queryClient.invalidateQueries({ queryKey: getListCircleChannelsQueryKey(circleId) });
      
      // Auto-switch to new channel if it's a text channel
      if (newChannelKind !== "voice") {
        setActiveChannelId(newChannel.id);
      }
      
      setIsCreateChannelOpen(false);
      setNewChannelName("");
    } catch (err) {
      toast.error("Failed to create channel");
    } finally {
      setIsCreatingChannel(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChannelId) return;
    
    // limit to 5MB
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File is too large! Please select an image under 5MB.");
      return;
    }

    setPendingImageFile(file);

    const reader = new FileReader();
    reader.onload = (event) => {
       const dataUrl = event.target?.result as string;
       setPendingImage(dataUrl);
    };
    reader.readAsDataURL(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleReaction = async (messageId: string, emoji: string) => {
    if (!activeChannelId) return;
    const queryKey = getListChannelMessagesQueryKey(activeChannelId);
    
    // Optimistic Update — create NEW objects, never mutate in-place
    queryClient.setQueryData(queryKey, (old: any) => {
      if (!old) return old;
      const msgs = Array.isArray(old) ? old : (old.messages || []);
      const updatedMsgs = msgs.map((m: any) => {
        if (m.id !== messageId) return m;
        const reactions = m.reactions ? [...m.reactions] : [];
        const existingIdx = reactions.findIndex((r: any) => r.emoji === emoji);
        let newReactions: any[];
        if (existingIdx >= 0) {
          const r = reactions[existingIdx];
          const newCount = r.mine ? r.count - 1 : r.count + 1;
          if (newCount <= 0) {
            newReactions = reactions.filter((_: any, i: number) => i !== existingIdx);
          } else {
            newReactions = reactions.map((r: any, i: number) =>
              i === existingIdx ? { ...r, count: newCount, mine: !r.mine } : r
            );
          }
        } else {
          newReactions = [...reactions, { emoji, count: 1, mine: true }];
        }
        return { ...m, reactions: newReactions };
      });
      return Array.isArray(old) ? updatedMsgs : { ...old, messages: updatedMsgs };
    });

    try {
      await customFetch(`/api/messages/${messageId}/reactions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji, userId: user?.id || "u_me" })
      });
    } catch (err) {
      queryClient.invalidateQueries({ queryKey });
      toast.error("Failed to update reaction");
    }
  };


  return (
    <div className="flex h-[100dvh] w-screen overflow-hidden bg-background">
      {/* Mobile Channel Sidebar overlay */}
      {mobileSidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setMobileSidebarOpen(false)} />
      )}

      {/* Channel Sidebar */}
      <div className={`${mobileSidebarOpen ? "fixed inset-y-0 left-0 z-50" : "hidden"} md:relative md:flex w-64 md:w-60 bg-background md:bg-muted/30 border-r border-border/50 flex-col shrink-0 transition-all`}>
        {/* Back to Home */}
        <button 
          onClick={() => setLocation('/dashboard')} 
          className="h-12 shrink-0 flex items-center px-4 border-b border-border/50 hover:bg-muted/50 transition-colors group text-left w-full"
        >
          <div className="w-6 h-6 rounded-md bg-background border border-border flex items-center justify-center mr-3 shrink-0 group-hover:border-violet-500/50 transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground group-hover:text-foreground"><path d="m15 18-6-6 6-6"/></svg>
          </div>
          <span className="font-medium text-sm text-muted-foreground group-hover:text-foreground transition-colors">Home</span>
        </button>

        {/* Server Header */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <div className="h-12 shrink-0 flex items-center px-4 border-b border-border/50 transition-colors bg-background/30 hover:bg-muted/30 cursor-pointer">
              <span className="font-bold text-sm truncate flex-1">{circle.name}</span>
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            </div>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="start" sideOffset={8}>
            <DropdownMenuItem 
              className="text-violet-500 font-medium cursor-pointer"
              onClick={async (e) => {
                e.preventDefault();
                try {
                  const res = await customFetch(`/api/circles/${circleId}/invites`, { method: 'POST' });
                  const data = res as any;
                  if (data.url) {
                    await navigator.clipboard.writeText(window.location.origin + data.url);
                    toast.success("Invite link copied to clipboard!");
                  } else {
                    throw new Error("Failed to generate link");
                  }
                } catch(e) {
                  toast.error("Could not copy invite link");
                }
              }}
            >
              <Link2 className="w-4 h-4 mr-2" />
              Copy Invite Link
            </DropdownMenuItem>
            
            {isOwner && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem 
                  className="cursor-pointer"
                  onClick={() => {
                    setEditCircleName(circle.name || "");
                    setEditCircleDesc(circle.description || "");
                    setEditCircleColor(circle.coverColor || "");
                    setIsSettingsOpen(true);
                  }}
                >
                  <Settings className="w-4 h-4 mr-2" />
                  Circle Settings
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem className="cursor-pointer" onClick={() => setLocation('/circles')}>
              Leave Circle
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        <ScrollArea className="flex-1">
          <div className="p-2 space-y-4 mt-2">
            {/* Text Channels */}
            <div>
              <div className="flex items-center justify-between px-2 mb-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Text Channels</span>
                {canModerateMessages && (
                  <Plus 
                    className="w-3 h-3 text-muted-foreground cursor-pointer hover:text-foreground transition-colors" 
                    onClick={() => {
                      setNewChannelKind("general");
                      setIsCreateChannelOpen(true);
                    }}
                  />
                )}
              </div>
              {textChannels.map(channel => (
                <button
                  key={channel.id}
                  onClick={() => { setActiveChannelId(channel.id); setActiveVoiceChannel(null); }}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-all ${
                    activeChannelId === channel.id
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground/80 hover:bg-muted/50"
                  }`}
                >
                  <Hash className="w-4 h-4 shrink-0 opacity-60" />
                  <span className="truncate">{channel.name}</span>
                  {channel.unread > 0 && (
                    <div className="ml-auto bg-red-500 text-white text-[10px] font-bold px-1.5 rounded-full">{channel.unread}</div>
                  )}
                </button>
              ))}
            </div>

            {/* Voice Channels */}
            <div>
              <div className="flex items-center justify-between px-2 mb-1">
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest">Voice Channels</span>
                {canModerateMessages && (
                  <Plus
                    className="w-3 h-3 text-muted-foreground cursor-pointer hover:text-foreground transition-colors"
                    onClick={() => { setNewChannelKind("voice"); setIsCreateChannelOpen(true); }}
                  />
                )}
              </div>
              {voiceChannels.map(vc => (
                <button
                  key={vc.id}
                  onClick={() => { 
                    setInVoice(true); 
                    setActiveVoiceChannel({ id: vc.id, name: vc.name });
                    setActiveChannelId("");
                  }}
                  className={`w-full flex flex-col gap-1 px-2 py-1.5 rounded-md text-sm transition-all ${
                    activeVoiceChannel?.id === vc.id
                      ? "bg-muted text-foreground font-medium"
                      : "text-muted-foreground hover:text-foreground/80 hover:bg-muted/50"
                  }`}
                >
                  <div className="flex items-center gap-2 w-full">
                    <Volume2 className="w-4 h-4 shrink-0 opacity-60" />
                    <span className="truncate">{vc.name}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </ScrollArea>

        {/* Voice Connected Panel */}
        <AnimatePresence>
          {inVoice && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
              className="border-t border-border/50 bg-emerald-500/10 overflow-hidden"
            >
              <div className="p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-xs font-bold text-emerald-500 dark:text-emerald-400">Voice Connected</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{activeVoiceChannel?.name || "Voice"}</p>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" className={`h-8 w-8 rounded-full ${micOn ? "text-foreground" : "text-red-500 dark:text-red-400 bg-red-500/20"}`}
                    onClick={() => setMicOn(!micOn)}>
                    {micOn ? <Mic className="w-4 h-4" /> : <MicOff className="w-4 h-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" className={`h-8 w-8 rounded-full ${camOn ? "text-foreground bg-muted" : "text-muted-foreground"}`}
                    onClick={() => setCamOn(!camOn)}>
                    {camOn ? <Video className="w-4 h-4" /> : <VideoOff className="w-4 h-4" />}
                  </Button>
                  <Button size="icon" variant="ghost" className={`h-8 w-8 rounded-full ${screenShare ? "text-emerald-500 dark:text-emerald-400 bg-emerald-500/20" : "text-muted-foreground"}`}
                    onClick={() => { setScreenShare(!screenShare); toast.success(screenShare ? "Screen sharing stopped" : "Screen sharing started"); }}>
                    <Monitor className="w-4 h-4" />
                  </Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-red-400 hover:bg-red-500/20 ml-auto"
                    onClick={() => { setInVoice(false); setScreenShare(false); setCamOn(false); setActiveVoiceChannel(null); toast.info("Disconnected from voice"); }}>
                    <PhoneOff className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* User Panel (bottom) */}
        <div className="p-2 border-t border-border/50 flex items-center gap-2 bg-background/50">
          <div className="relative cursor-pointer hover:opacity-80 transition-opacity">
            <Avatar className="h-8 w-8">
              <AvatarImage src={avatarUrl} />
              <AvatarFallback className="text-xs">{displayName.substring(0, 2)}</AvatarFallback>
            </Avatar>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-background rounded-full bg-emerald-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold truncate">{displayName}</p>
            <p className="text-[10px] text-emerald-500 dark:text-emerald-400 leading-none">Online</p>
          </div>
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-md" onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}>
              <Sun className="h-3.5 w-3.5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-muted-foreground" />
              <Moon className="absolute h-3.5 w-3.5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-muted-foreground" />
            </Button>
            <Button size="icon" variant="ghost" className="h-7 w-7 rounded-md" onClick={() => setLocation('/settings')}>
              <Settings className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col min-w-0 bg-background">
        {activeVoiceChannel ? (
          <VoiceChannelRoom
            channelId={activeVoiceChannel.id}
            channelName={activeVoiceChannel.name}
            circleId={circleId}
            onLeave={() => { setActiveVoiceChannel(null); setInVoice(false); }}
          />
        ) : (
          <>
        {/* Channel Header */}
        <div className="h-12 flex items-center justify-between px-4 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-2">
            <button className="md:hidden p-1 hover:bg-muted rounded-md" onClick={() => setMobileSidebarOpen(true)}>
              <Menu className="w-5 h-5 text-muted-foreground" />
            </button>
            <Hash className="w-4 h-4 text-muted-foreground" />
            <span className="font-bold text-sm">{activeChannel?.name || "general"}</span>
            {activeChannel?.description && (
              <span className="text-xs text-muted-foreground border-l border-border pl-2 ml-2 hidden md:block truncate max-w-xs">
                {activeChannel.description}
              </span>
            )}
          </div>
          <button
            onClick={() => setGlobalSearchOpen(true)}
            className="hidden md:flex items-center gap-2 bg-muted/40 hover:bg-muted/70 border border-border/50 px-3 h-8 rounded-lg text-xs text-muted-foreground transition-all mr-2 group"
            title="Search messages (Ctrl+K)"
          >
            <Search className="w-3.5 h-3.5" />
            <span>Search…</span>
            <kbd className="ml-2 text-[10px] bg-background/60 border border-border/60 rounded px-1 py-0.5 group-hover:border-violet-500/40 transition-colors">Ctrl K</kbd>
          </button>
          <div className="flex items-center gap-1">
            <Button 
              size="icon" 
              variant="ghost" 
              className={`h-8 w-8 hidden sm:inline-flex ${showPinned ? 'text-amber-500 bg-amber-500/10' : 'text-muted-foreground hover:text-foreground'}`} 
              onClick={() => { setShowPinned(!showPinned); setSearchQuery(""); }} 
              title="Pinned Messages"
            >
              <Pin className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 text-violet-400 hover:text-violet-300 hover:bg-violet-500/10" onClick={handleInvite} title="Copy invite link">
              <Link2 className="w-4 h-4" />
            </Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 hidden md:inline-flex text-muted-foreground hover:text-foreground"><Phone className="w-4 h-4" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 hidden md:inline-flex text-muted-foreground hover:text-foreground"><Video className="w-4 h-4" /></Button>
            <Button size="icon" variant="ghost" className="h-8 w-8 hidden md:inline-flex text-muted-foreground hover:text-foreground"><ScreenShare className="w-4 h-4" /></Button>
            <div className="w-px h-4 bg-border mx-1 hidden sm:block" />
            <Button size="icon" variant="ghost" className={`h-8 w-8 ${showMembers ? 'text-violet-400 bg-violet-500/10' : 'text-muted-foreground hover:text-foreground'}`} onClick={() => setShowMembers(!showMembers)}><Users className="w-4 h-4" /></Button>
          </div>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4" ref={scrollRef}>
          {isSearching ? (
            <div className="flex flex-col items-center justify-center h-full text-muted-foreground">
              <span className="w-6 h-6 border-2 border-violet-500 border-t-transparent rounded-full animate-spin mb-2" />
              Searching...
            </div>
          ) : (showPinned || searchResults !== null) ? (
            <div className="space-y-4">
              <div className="mb-4 pb-2 border-b border-border">
                <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                  {showPinned ? <><Pin className="w-4 h-4 text-amber-500" /> Pinned Messages</> : <><Search className="w-4 h-4 text-violet-500" /> Search Results for "{searchQuery}"</>}
                </h3>
              </div>
              {((showPinned ? messages?.filter(m => m.pinned) : searchResults) || []).length === 0 ? (
                <p className="text-sm text-muted-foreground text-center pt-8">Nothing found.</p>
              ) : (
                (showPinned ? messages?.filter(m => m.pinned) : searchResults)!.map((msg: any) => {
                  const isReply = msg.body.startsWith("> **@");
                  const parts = isReply ? msg.body.split('\n\n') : [msg.body];
                  const actualBody = isReply ? parts.slice(1).join('\n\n') : msg.body;
                  const bodyLines = actualBody.split('\n\n');
                  const lastLine = bodyLines[bodyLines.length - 1];
                  const hasImageAttachment = lastLine?.startsWith("data:image/") || lastLine?.includes("res.cloudinary.com");
                  const textPart = hasImageAttachment ? bodyLines.slice(0, -1).join('\n\n') : actualBody;
                  const imgUrl = hasImageAttachment ? lastLine : null;
                  return (
                    <div key={msg.id} className="flex gap-3 bg-muted/20 p-3 rounded-lg border border-border/50 relative group">
                      <Avatar className="h-10 w-10 shrink-0">
                        <AvatarImage src={msg.author?.avatarUrl || ""} />
                        <AvatarFallback>{msg.author?.displayName?.substring(0,2) || "U"}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-baseline gap-2">
                          <span className="font-bold text-[15px]">{msg.author?.displayName || "Unknown User"}</span>
                          <span className="text-[11px] text-muted-foreground">{format(new Date(msg.createdAt), "MMM d, h:mm a")}</span>
                        </div>
                        <p className="text-sm text-gray-300 whitespace-pre-wrap mt-0.5">{textPart}</p>
                        {imgUrl && <img src={imgUrl} alt="attachment" className="mt-2 max-h-48 rounded-md border border-border" />}
                      </div>
                      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-amber-500 hover:bg-muted" onClick={() => handlePinMessage(msg.id)}>
                          {msg.pinned ? <PinOff className="w-4 h-4" /> : <Pin className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          ) : loadingMessages ? (
            <div className="space-y-4">
              {[1,2,3].map(i => (
                <div key={i} className="flex gap-3"><Skeleton className="w-10 h-10 rounded-full" /><div className="space-y-2 flex-1"><Skeleton className="h-4 w-32" /><Skeleton className="h-12 w-3/4 rounded-lg" /></div></div>
              ))}
            </div>
          ) : messages && messages.length > 0 ? (
            <div className="space-y-4">
              {messages.map((msg, idx) => {
                const isConsecutive = idx > 0 && messages[idx-1].authorId === msg.authorId;
                
                // Parse Reply Block & Image Attachment out early
                const isReply = msg.body.startsWith("> **@");
                const parts = isReply ? msg.body.split('\n\n') : [msg.body];
                const replyHeader = isReply ? parts[0] : null;
                const actualBody = isReply ? parts.slice(1).join('\n\n') : msg.body;
                
                // Only show (edited) if updatedAt exists AND is meaningfully different from createdAt
                const wasEdited = msg.updatedAt && msg.createdAt && 
                  new Date(msg.updatedAt).getTime() - new Date(msg.createdAt).getTime() > 1000;
                
                const bodyLines = actualBody.split('\n\n');
                const lastLine = bodyLines[bodyLines.length - 1];
                const hasImageAttachment = lastLine?.startsWith("data:image/") || lastLine?.includes("res.cloudinary.com");
                const textPart = hasImageAttachment ? bodyLines.slice(0, -1).join('\n\n') : actualBody;
                const imgUrl = hasImageAttachment ? lastLine : null;

                const isMe = msg.authorId === user?.id || msg.authorId === "u_me";
                const isMentioned = !isMe && textPart.includes(`@${displayName}`);
                
                return (
                  <div key={msg.id} className={`flex w-full group relative ${isMe ? "justify-end" : "justify-start"} ${isConsecutive ? "mt-1.5" : "mt-6"}`}>
                    
                    {/* Hover Action Menu */}
                    <div className={`absolute -top-6 ${isMe ? "right-10" : "left-10"} opacity-0 group-hover:opacity-100 transition-all duration-200 bg-white dark:bg-[#1e1f22] shadow-md border border-border/40 rounded-full flex items-center px-1 py-0.5 z-10 scale-95 group-hover:scale-100`}>
                      <div className="flex items-center gap-0.5 pr-1 border-r border-border/40">
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" onClick={() => handleReaction(msg.id, "👍")}>
                          <span className="text-[14px]">👍</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" onClick={() => handleReaction(msg.id, "😂")}>
                          <span className="text-[14px]">😂</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" onClick={() => handleReaction(msg.id, "💯")}>
                          <span className="text-[14px]">💯</span>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted" onClick={() => handleReaction(msg.id, "❤️")}>
                          <span className="text-[14px]">❤️</span>
                        </Button>
                      </div>
                      <div className="flex items-center gap-0.5 pl-1">
                        {/* Full Emoji Picker — viewport-aware via Radix Popover */}
                        <EmojiPicker
                          onEmojiSelect={(emoji) => handleReaction(msg.id, emoji)}
                          open={openPickerMsgId === msg.id}
                          onOpenChange={(o) => setOpenPickerMsgId(o ? msg.id : null)}
                          isActive={openPickerMsgId === msg.id}
                          side="top"
                          align={isMe ? "start" : "end"}
                        />
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted" onClick={() => handlePinMessage(msg.id)}>
                          {msg.pinned ? <PinOff className="w-4 h-4 text-amber-500" /> : <Pin className="w-4 h-4" />}
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted" onClick={() => setReplyTo(msg)}>
                          <Reply className="w-4 h-4" />
                        </Button>
                        {isMe && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted" onClick={() => { setEditingMessageId(msg.id); setEditingContent(textPart); }}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        )}
                        {(isMe || canModerateMessages) && (
                          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-red-400 hover:text-red-500 hover:bg-red-500/10" onClick={() => handleDeleteMessage(msg.id)}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className={`flex items-end gap-2 max-w-[85%] md:max-w-[75%] ${isMe ? "flex-row-reverse" : "flex-row"}`}>
                      {!isMe && (
                        <div className="shrink-0 mb-1">
                          {!isConsecutive ? (
                            <UserProfilePopover 
                              userId={msg.authorId}
                              onMessage={handleStartDM}
                              trigger={
                                <Avatar className="w-8 h-8 cursor-pointer hover:opacity-80 transition-opacity ring-2 ring-background shadow-sm">
                                  <AvatarImage src={msg.authorAvatar} />
                                  <AvatarFallback>{msg.authorName?.substring(0,2)}</AvatarFallback>
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
                          <div className="flex items-baseline gap-2 mb-1 ml-1">
                            <UserProfilePopover 
                              userId={msg.authorId}
                              onMessage={handleStartDM}
                              trigger={
                                <span className="text-xs font-medium cursor-pointer hover:underline text-foreground/80">{msg.authorName}</span>
                              }
                            />
                          </div>
                        )}
                        
                        {/* Reply Block */}
                        {isReply && (
                          <div className={`flex items-center gap-1.5 text-xs mb-1 p-2 rounded-lg opacity-80 cursor-default ${isMe ? 'bg-violet-500/20 text-white' : 'bg-muted/50 text-muted-foreground border-l-2 border-violet-500/50'}`}>
                            <span className="truncate max-w-[200px] md:max-w-xs flex items-center gap-1">
                              <strong className={`font-semibold ${isMe ? 'text-white' : 'text-foreground'}`}>
                                {replyHeader?.split('**')[1] || "@user"}
                              </strong>
                              <span className="opacity-90">
                                {replyHeader?.split('**')[2]?.trim() === "[Image Attachment]" ? (
                                  <span className="italic">🖼️</span>
                                ) : (
                                  replyHeader?.split('**')[2]?.trim()
                                )}
                              </span>
                            </span>
                          </div>
                        )}

                        {/* Body / Editing */}
                        {(() => {
                          const isImageOnly = !textPart && !!imgUrl;
                          
                          return (
                            <div className={`relative shadow-sm w-fit max-w-xs sm:max-w-sm md:max-w-md flex flex-col ${
                              isImageOnly 
                                ? `p-0 border border-black/30 dark:border-zinc-700 rounded-[20px] overflow-hidden ${isMentioned ? 'ring-2 ring-amber-500' : ''}`
                                : `text-[15px] ${imgUrl ? 'p-0 overflow-hidden' : 'overflow-hidden'} ${isMe ? "bg-gradient-to-br from-violet-500 to-indigo-600 text-white border-none" : isMentioned ? "bg-amber-100 dark:bg-amber-500/20 border border-amber-500/50 text-foreground" : "bg-white dark:bg-[#1e1f22] border border-border/40 text-foreground"} ${
                                    isConsecutive 
                                      ? isMe ? "rounded-2xl rounded-tr-sm" : "rounded-2xl rounded-tl-sm"
                                      : isMe ? "rounded-2xl rounded-tr-sm rounded-br-2xl" : "rounded-2xl rounded-tl-sm rounded-bl-2xl"
                                  }`
                            }`}>
                              {editingMessageId === msg.id ? (
                                <div className={`flex flex-col gap-2 min-w-[200px] ${isImageOnly ? 'p-3' : 'mt-1'}`}>
                                  <textarea 
                                    value={editingContent}
                                    onChange={(e) => setEditingContent(e.target.value)}
                                    className="w-full bg-muted/50 border border-border rounded-md p-2 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                                    rows={2}
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === 'Escape') setEditingMessageId(null);
                                      if (e.key === 'Enter' && !e.shiftKey) {
                                        e.preventDefault();
                                        handleEditMessage(msg.id, editingContent);
                                      }
                                    }}
                                  />
                                  <div className="flex items-center gap-2 text-[10px] opacity-80">
                                    <span>esc to <span className="font-bold cursor-pointer hover:underline" onClick={() => setEditingMessageId(null)}>cancel</span> • enter to <span className="font-bold cursor-pointer hover:underline" onClick={() => handleEditMessage(msg.id, editingContent)}>save</span></span>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col relative">
                                  {imgUrl && (
                                    <img 
                                      src={imgUrl} 
                                      onClick={() => setSelectedImage(imgUrl)}
                                      className={`${isImageOnly ? 'w-full max-w-[280px] md:max-w-[320px] max-h-[300px]' : 'w-full max-w-sm max-h-[260px]'} object-cover cursor-pointer hover:brightness-95 transition-all`} 
                                      alt="attachment" 
                                    />
                                  )}
                                  
                                  {isImageOnly ? (
                                    // Image-only: floating pill timestamp
                                    <div className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px] whitespace-nowrap bg-black/50 backdrop-blur-md text-white/90 px-2 py-1 rounded-full shadow-sm z-10">
                                      {wasEdited && <span>(edited)</span>}
                                      <span>{format(new Date(msg.createdAt), "HH:mm")}</span>
                                      {isMe && <span className="text-blue-200 ml-0.5">✓✓</span>}
                                      {msg.pinned && <Pin className="w-3 h-3 ml-0.5 fill-amber-500 text-amber-500" />}
                                    </div>
                                  ) : imgUrl && textPart ? (
                                    // Image + text: frosted glass caption overlay at bottom of image
                                    <div className="absolute bottom-0 left-0 right-0 bg-black/45 backdrop-blur-md px-3 py-2 flex items-end justify-between gap-2 z-10">
                                      <p className="text-white text-[13px] leading-snug break-words flex-1 drop-shadow-sm">{textPart}</p>
                                      <div className="flex items-center gap-1 text-[10px] whitespace-nowrap text-white/80 shrink-0 mb-0.5">
                                        {wasEdited && <span>(edited)</span>}
                                        <span>{format(new Date(msg.createdAt), "HH:mm")}</span>
                                        {isMe && <span className="text-blue-200 ml-0.5">✓✓</span>}
                                        {msg.pinned && <Pin className="w-3 h-3 ml-0.5 fill-amber-500 text-amber-500" />}
                                      </div>
                                    </div>
                                  ) : (
                                    // Text only: text + timestamp inline, bubble shrinks to content
                                    <div className="px-3.5 py-2 flex flex-col">
                                      {textPart && (
                                        <p className="whitespace-pre-wrap leading-snug break-words text-[14.5px]">
                                          {textPart}
                                          {/* Invisible spacer so text never overlaps timestamp */}
                                          <span className="inline-block w-[68px]" aria-hidden="true" />
                                        </p>
                                      )}
                                      <div className={`flex items-center gap-1 text-[10px] whitespace-nowrap self-end -mt-3.5 ${isMe ? 'text-white/70' : 'text-muted-foreground'}`}>
                                        {wasEdited && <span>(edited)</span>}
                                        <span>{format(new Date(msg.createdAt), "HH:mm")}</span>
                                        {isMe && <span className="text-blue-200 ml-0.5">✓✓</span>}
                                        {msg.pinned && <Pin className="w-3 h-3 ml-0.5 fill-amber-500 text-amber-500" />}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Reactions */}
                        {msg.reactions?.length > 0 && (
                          <div className={`flex flex-wrap gap-1.5 mt-1.5 ${isMe ? 'justify-end' : 'justify-start'}`}>
                            {msg.reactions.map((r: any, i: number) => (
                              <span key={i} onClick={() => handleReaction(msg.id, r.emoji)} className={`border px-1.5 py-0.5 rounded-md text-xs flex items-center gap-1 cursor-pointer hover:opacity-80 transition-opacity ${r.mine ? "bg-violet-500/20 border-violet-500/50 text-violet-600 dark:text-violet-300 font-medium" : "bg-white/50 dark:bg-zinc-800/50 border-border/50 text-foreground"}`}>{r.emoji} {r.count}</span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
              <div className="w-16 h-16 rounded-full bg-violet-600/10 flex items-center justify-center mb-4">
                <Hash className="w-8 h-8 text-violet-500" />
              </div>
              <h3 className="font-bold text-lg text-foreground mb-1">Welcome to #{activeChannel?.name}!</h3>
              <p className="text-sm text-center max-w-sm">This is the beginning of this channel. Send a message to start the conversation!</p>
            </div>
          )}
        </div>

        {/* Message Input */}
        <div className="p-4 shrink-0 bg-background">
          <form onSubmit={handleSend} className="relative max-w-4xl mx-auto flex flex-col transition-all overflow-visible">
            {replyTo && (
              <div className="flex items-center justify-between px-3 py-2 bg-muted/30 border border-violet-400/30 rounded-t-2xl text-xs mb-1">
                <div className="flex items-center gap-2 truncate text-muted-foreground">
                  <Reply className="w-3.5 h-3.5" />
                  <span>Replying to <span className="font-semibold text-foreground">@{replyTo.authorName}</span></span>
                </div>
                <button type="button" onClick={() => setReplyTo(null)} className="hover:text-foreground transition-colors p-1 rounded-full hover:bg-muted">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {pendingImage && (
              <div className="p-3 border border-border/60 relative group bg-muted/10 rounded-2xl mb-2 w-fit">
                <div className="relative inline-block">
                  <img src={pendingImage} alt="preview" className="h-24 w-auto rounded-lg object-cover shadow-sm border border-border/50" />
                  <button type="button" onClick={() => { setPendingImage(null); setPendingImageFile(null); }} className="absolute -top-2 -right-2 bg-muted text-foreground p-1 rounded-full shadow hover:bg-muted/80 transition-colors">
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
            
            <div className="relative flex items-end gap-2 bg-muted/30 border border-border/60 focus-within:border-violet-500/50 rounded-2xl px-3 py-2 transition-all">
              <input type="file" accept="image/*" hidden ref={fileInputRef} onChange={handleFileUpload} />
              
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="shrink-0 text-muted-foreground hover:text-violet-400 transition-colors mb-2"
                title="Attach image"
              >
                <Paperclip className="w-5 h-5" />
              </button>

              {/* @Mention Popup */}
              {mentionQuery !== null && (() => {
                const filtered = circle?.members?.filter((m: any) =>
                  m.displayName.toLowerCase().includes(mentionQuery.toLowerCase())
                ) || [];
                if (filtered.length === 0) return null;
                return (
                  <div className="absolute bottom-[105%] left-10 mb-1 w-64 max-h-48 overflow-y-auto bg-white dark:bg-[#1e1f22] border border-border/50 rounded-xl shadow-2xl z-50 p-1">
                    {filtered.map((m: any, idx: number) => (
                      <div
                        key={m.userId}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm ${
                          idx === mentionIndex ? 'bg-violet-500/10 text-violet-600 dark:text-violet-400 font-medium' : 'hover:bg-muted'
                        }`}
                        onMouseDown={e => {
                          e.preventDefault();
                          const ta = document.querySelector('textarea') as HTMLTextAreaElement;
                          const cursor = ta?.selectionStart || message.length;
                          const before = message.substring(0, cursor);
                          const after = message.substring(cursor);
                          const atMatch = before.match(/@([a-zA-Z0-9_ ]*)$/);
                          if (atMatch) {
                            setMessage(before.substring(0, atMatch.index) + `@${m.displayName} ` + after);
                            setMentionQuery(null);
                            ta?.focus();
                          }
                        }}
                      >
                        <Avatar className="w-6 h-6">
                          <AvatarImage src={m.avatarUrl} />
                          <AvatarFallback className="text-[10px]">{m.displayName?.substring(0, 2)}</AvatarFallback>
                        </Avatar>
                        <span className="truncate">{m.displayName}</span>
                      </div>
                    ))}
                  </div>
                );
              })()}

              <textarea
                placeholder={`Message #${activeChannel?.name || "general"}`}
                className="flex-1 min-h-[36px] max-h-[160px] resize-none bg-transparent border-0 focus:outline-none text-[14px] leading-relaxed py-0.5"
                value={message}
                onChange={e => {
                  const val = e.target.value;
                  setMessage(val);

                  // Detect @mention trigger
                  const cursor = e.target.selectionStart;
                  const before = val.substring(0, cursor);
                  const match = before.match(/@([a-zA-Z0-9_ ]*)$/);
                  if (match && !match[1].includes("  ")) {
                    setMentionQuery(match[1]);
                    setMentionIndex(0);
                  } else {
                    setMentionQuery(null);
                  }

                  // Emit typing start
                  if (socketRef.current && activeChannelId && user?.id) {
                    socketRef.current.emit("typing:start", { channelId: activeChannelId, userId: user.id, displayName });
                    if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
                    typingTimeoutRef.current = setTimeout(() => {
                      socketRef.current?.emit("typing:stop", { channelId: activeChannelId, userId: user?.id });
                    }, 2000);
                  }
                }}
                onKeyDown={e => {
                  // @mention keyboard navigation
                  if (mentionQuery !== null) {
                    const filtered = circle?.members?.filter((m: any) =>
                      m.displayName.toLowerCase().includes(mentionQuery.toLowerCase())
                    ) || [];
                    if (e.key === 'ArrowDown') { e.preventDefault(); setMentionIndex(p => (p + 1) % (filtered.length || 1)); return; }
                    if (e.key === 'ArrowUp')   { e.preventDefault(); setMentionIndex(p => (p - 1 + filtered.length) % (filtered.length || 1)); return; }
                    if (e.key === 'Escape')    { setMentionQuery(null); return; }
                    if (e.key === 'Enter' && filtered[mentionIndex]) {
                      e.preventDefault();
                      const m = filtered[mentionIndex];
                      const cursor = (e.target as HTMLTextAreaElement).selectionStart;
                      const before = message.substring(0, cursor);
                      const after = message.substring(cursor);
                      const atMatch = before.match(/@([a-zA-Z0-9_ ]*)$/);
                      if (atMatch) {
                        setMessage(before.substring(0, atMatch.index) + `@${m.displayName} ` + after);
                        setMentionQuery(null);
                      }
                      return;
                    }
                  }
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(e as any);
                  }
                }}
                rows={1}
              />
              
              <div className="flex items-center gap-1">
                <Button type="button" size="icon" variant="ghost" className="h-9 w-9 shrink-0 text-muted-foreground hover:text-amber-500 rounded-full">
                  <SmilePlus className="w-5 h-5" />
                </Button>
                <Button 
                  type="submit" 
                  size="icon" 
                  className={`h-9 w-9 shrink-0 rounded-xl transition-all ${(message.trim() || pendingImage) ? "bg-violet-600 hover:bg-violet-500 text-white shadow-lg shadow-violet-500/25" : "bg-muted text-muted-foreground"}`} 
                  disabled={!(message.trim() || pendingImage) || isUploading}
                >
                  {isUploading ? <span className="animate-spin text-[10px]">⏳</span> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          </form>
          <div className="max-w-4xl mx-auto mt-1 flex justify-between px-2 min-h-[20px]">
            {(() => {
              const typers = Array.from(typingUsers.entries()).filter(([id]) => id !== user?.id);
              if (typers.length === 0) return <p className="text-[10px] text-muted-foreground"><strong>Shift + Enter</strong> to add a new line</p>;
              const names = typers.map(([, name]) => name);
              return (
                <p className="text-[10px] text-violet-400 animate-pulse">
                  <strong>{names.join(", ")}</strong> {names.length === 1 ? "is" : "are"} typing
                  <span className="inline-flex ml-0.5">
                    <span className="animate-bounce" style={{ animationDelay: '0ms' }}>.</span>
                    <span className="animate-bounce" style={{ animationDelay: '150ms' }}>.</span>
                    <span className="animate-bounce" style={{ animationDelay: '300ms' }}>.</span>
                  </span>
                </p>
              );
            })()}
          </div>
        </div>
        </>
        )}
      </div>

      {/* Members Sidebar */}
      {showMembers && (
        <>
          {/* Mobile Members Overlay */}
          <div className="fixed inset-0 z-40 bg-black/50 md:hidden" onClick={() => setShowMembers(false)} />
          <div className="w-64 md:w-60 bg-background md:bg-muted/30 border-l border-border/50 flex flex-col shrink-0 absolute right-0 top-0 bottom-0 z-50 md:relative shadow-2xl md:shadow-none transition-all">
          <div className="h-12 flex items-center justify-between px-4 border-b border-border/50">
            <span className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Members — {circle.members?.length || 0}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6 md:hidden" onClick={() => setShowMembers(false)}><X className="w-3 h-3" /></Button>
          </div>
        <ScrollArea className="flex-1 py-3">
          <div className="px-3 space-y-4">
            {(() => {
              const allMembers = circle.members || [];
              // Use WebSocket presence for real-time online status
              const onlineMembers = allMembers.filter((m: any) => onlineUserIds.has(m.userId));
              const offlineMembers = allMembers.filter((m: any) => !onlineUserIds.has(m.userId));
              
              const renderMember = (member: any, isOnline: boolean) => {
                const rc = roleConfig[member.role] || roleConfig["member"];
                const canManage = isOwner && member.role !== "owner";
                
                const memberCard = (
                  <div className={`flex items-center gap-2.5 p-1.5 rounded-md hover:bg-muted/50 cursor-pointer transition-colors ${!isOnline ? "opacity-50" : ""}`}>
                    <div className="relative">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={member.avatarUrl} />
                        <AvatarFallback className="text-xs">{member.displayName?.substring(0, 2)}</AvatarFallback>
                      </Avatar>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 border-2 border-background rounded-full ${isOnline ? "bg-emerald-500" : "bg-gray-500"}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium flex items-center gap-1 truncate ${rc.color}`}>
                        {rc.icon && <span className="text-xs">{rc.icon}</span>}
                        {member.displayName}
                      </p>
                      <p className="text-[10px] text-muted-foreground capitalize">{rc.label}</p>
                    </div>
                  </div>
                );
                
                return (
                  <DropdownMenu key={member.userId}>
                    <DropdownMenuTrigger asChild>
                      {memberCard}
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="start" className="w-48">
                      <DropdownMenuLabel className="flex items-center gap-2">
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={member.avatarUrl} />
                          <AvatarFallback className="text-[10px]">{member.displayName?.substring(0, 2)}</AvatarFallback>
                        </Avatar>
                        <span className="truncate">{member.displayName}</span>
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                      
                      <DropdownMenuItem 
                        onClick={() => handleStartDM(member.userId)}
                        className="text-violet-400 focus:text-violet-400 focus:bg-violet-500/10 cursor-pointer"
                      >
                        <MessageSquare className="w-3.5 h-3.5 mr-2" />
                        Message User
                      </DropdownMenuItem>

                      {canManage && (
                        <>
                          <DropdownMenuSeparator />
                          <DropdownMenuLabel className="text-[10px] text-muted-foreground font-normal">Assign Role</DropdownMenuLabel>
                          {Object.entries(roleConfig).filter(([k]) => k !== "owner").map(([key, cfg]) => (
                            <DropdownMenuItem 
                              key={key} 
                              onClick={() => handleChangeRole(member.userId, key)}
                              className={member.role === key ? "bg-muted font-semibold cursor-pointer" : "cursor-pointer"}
                            >
                              <span className="mr-2">{cfg.icon || "👤"}</span>
                              <span className={cfg.color}>{cfg.label}</span>
                              {member.role === key && <span className="ml-auto text-xs">✓</span>}
                            </DropdownMenuItem>
                          ))}
                          <DropdownMenuSeparator />
                          <DropdownMenuItem 
                            onClick={() => handleKickMember(member.userId, member.displayName)}
                            className="text-red-400 focus:text-red-400 focus:bg-red-500/10 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5 mr-2" />
                            Kick Member
                          </DropdownMenuItem>
                        </>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                );
              };
              
              return (
                <>
                  {onlineMembers.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1 mb-2">Online — {onlineMembers.length}</p>
                      {onlineMembers.map((m: any) => renderMember(m, true))}
                    </div>
                  )}
                  {offlineMembers.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest px-1 mb-2">Offline — {offlineMembers.length}</p>
                      {offlineMembers.map((m: any) => renderMember(m, false))}
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        </ScrollArea>
      </div>
        </>
      )}

      {/* Create Channel Modal */}
      <Dialog open={isCreateChannelOpen} onOpenChange={setIsCreateChannelOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Channel</DialogTitle>
            <DialogDescription>
              Add a new channel to your circle.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Channel Type</label>
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant={newChannelKind !== "voice" ? "default" : "outline"}
                  onClick={() => setNewChannelKind("general")}
                  className="w-full justify-start"
                >
                  <Hash className="w-4 h-4 mr-2" />
                  Text
                </Button>
                <Button
                  type="button"
                  variant={newChannelKind === "voice" ? "default" : "outline"}
                  onClick={() => setNewChannelKind("voice")}
                  className="w-full justify-start"
                >
                  <Volume2 className="w-4 h-4 mr-2" />
                  Voice
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Channel Name</label>
              <div className="relative">
                <Hash className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="new-channel"
                  className="pl-9"
                  value={newChannelName}
                  onChange={(e) => setNewChannelName(e.target.value.toLowerCase().replace(/\s+/g, '-'))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCreateChannelOpen(false)}>Cancel</Button>
            <Button onClick={handleCreateChannel} disabled={!newChannelName || isCreatingChannel}>
              {isCreatingChannel ? "Creating..." : "Create Channel"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" 
            alt="fullscreen attachment" 
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Circle Settings Modal */}
      <Dialog open={isSettingsOpen} onOpenChange={setIsSettingsOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Circle Settings</DialogTitle>
            <DialogDescription>
              Update your circle's details and appearance.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Circle Name</label>
              <Input
                value={editCircleName}
                onChange={(e) => setEditCircleName(e.target.value)}
                placeholder="Name"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Input
                value={editCircleDesc}
                onChange={(e) => setEditCircleDesc(e.target.value)}
                placeholder="Description"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium">Cover Color (Hex or CSS)</label>
              <Input
                value={editCircleColor}
                onChange={(e) => setEditCircleColor(e.target.value)}
                placeholder="#8b5cf6"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSettingsOpen(false)}>Cancel</Button>
            <Button 
              disabled={isUpdatingCircle || !editCircleName.trim()} 
              onClick={async () => {
                setIsUpdatingCircle(true);
                try {
                  await customFetch(`/api/circles/${circleId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ name: editCircleName, description: editCircleDesc, coverColor: editCircleColor })
                  });
                  toast.success("Circle updated successfully");
                  queryClient.invalidateQueries({ queryKey: getGetCircleQueryKey(circleId) });
                  setIsSettingsOpen(false);
                } catch (err) {
                  toast.error("Failed to update circle");
                } finally {
                  setIsUpdatingCircle(false);
                }
              }}
            >
              {isUpdatingCircle ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Global Ctrl+K message search */}
      <MessageSearch
        circleId={circleId}
        channels={(channels as any[] | undefined) || []}
        open={globalSearchOpen}
        onClose={() => setGlobalSearchOpen(false)}
        onJumpToMessage={(channelId, _messageId) => {
          setActiveChannelId(channelId);
          setActiveVoiceChannel(null);
          setGlobalSearchOpen(false);
        }}
      />
    </div>
  );
}
