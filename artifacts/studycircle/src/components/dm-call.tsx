import { useState, useEffect, useRef } from "react";
import { LiveKitRoom } from "@livekit/components-react";
import { CustomVideoLayout } from "./custom-video-layout";
import { customFetch } from "@workspace/api-client-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PhoneOff, Loader2, AlertCircle, Maximize2, Minimize2, Phone, Video } from "lucide-react";

interface DmCallProps {
  convId: string;
  mode: "voice" | "video";
  otherUser: { displayName: string; avatarUrl?: string };
  myName: string;
  myAvatar?: string;
  onEnd: () => void;
}

export function DmCall({
  convId,
  mode,
  otherUser,
  myName,
  onEnd,
}: DmCallProps) {
  const [token, setToken] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [isFullscreen, setIsFullscreen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handleFsChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handleFsChange);
    return () => document.removeEventListener("fullscreenchange", handleFsChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const fetchToken = async () => {
      try {
        const roomName = `dm-${convId}`;
        const res = await customFetch<{ token: string }>(
          `/api/livekit/token?roomName=${encodeURIComponent(roomName)}&participantName=${encodeURIComponent(myName)}`
        );
        if (!cancelled) setToken(res.token);
      } catch (err: any) {
        if (!cancelled) setErrorMsg(err?.message || "Failed to connect to call");
      }
    };
    fetchToken();
    return () => { cancelled = true; };
  }, [convId, myName]);


  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/80 backdrop-blur-md">
      <div
        ref={containerRef}
        className={`relative rounded-3xl overflow-hidden shadow-2xl border border-white/10 flex flex-col items-center bg-gradient-to-br from-[#0B0B13] to-[#14142a] studycircle-livekit-theme transition-all duration-300 ${
          isFullscreen
            ? "w-screen h-screen rounded-none"
            : "w-[840px] max-w-[95vw] h-[540px]"
        }`}
      >
        {/* Header (Top left) */}
        <div className="absolute top-4 left-4 z-50 flex items-center gap-3 bg-black/40 backdrop-blur-md rounded-full pr-4 p-1.5 border border-white/10 shadow-lg pointer-events-none">
          <Avatar className="h-8 w-8 ring-2 ring-violet-500/50">
            <AvatarImage src={otherUser.avatarUrl} />
            <AvatarFallback className="text-xs bg-violet-900 font-bold">
              {otherUser.displayName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <span className="text-white text-sm font-semibold tracking-wide">
            {otherUser.displayName}
          </span>
        </div>

        {/* Fullscreen toggle (Top right) */}
        <button
          onClick={toggleFullscreen}
          className="absolute top-4 right-4 z-50 bg-black/40 hover:bg-black/60 backdrop-blur-md text-white rounded-full p-2 border border-white/10 transition-all hover:scale-110 shadow-lg"
          title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
        >
          {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
        </button>

        {/* LiveKit Room */}
        {errorMsg ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-6 w-full h-full">
            <AlertCircle className="w-12 h-12 text-red-500" />
            <p className="text-white font-medium">{errorMsg}</p>
          </div>
        ) : !token ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-4 w-full h-full">
            <Loader2 className="w-10 h-10 text-violet-500 animate-spin" />
            <p className="text-white/70 text-sm font-medium animate-pulse">Connecting to call...</p>
          </div>
        ) : (
          <LiveKitRoom
            video={mode === "video"}
            audio={true}
            token={token}
            serverUrl={import.meta.env.VITE_LIVEKIT_URL}
            connect={true}
            onDisconnected={onEnd}
            className="flex-1 w-full h-full custom-lk-room relative"
          >
            <CustomVideoLayout />
          </LiveKitRoom>
        )}
      </div>
    </div>
  );
}

// Incoming call notification modal
interface IncomingCallProps {
  callerName: string;
  callerAvatar?: string;
  mode: "voice" | "video";
  onAccept: () => void;
  onDecline: () => void;
}

export function IncomingCallNotification({
  callerName,
  callerAvatar,
  mode,
  onAccept,
  onDecline,
}: IncomingCallProps) {
  return (
    <div className="fixed bottom-6 right-6 z-[300] w-80 rounded-2xl bg-[#1a1a2e] border border-violet-500/30 shadow-2xl shadow-violet-500/20 p-5 flex flex-col gap-4 animate-in slide-in-from-right-5">
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar className="h-12 w-12 ring-2 ring-violet-500">
            <AvatarImage src={callerAvatar} />
            <AvatarFallback className="bg-violet-900 text-lg">
              {callerName.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {/* Pulse ring */}
          <span className="absolute inset-0 rounded-full ring-2 ring-violet-400 animate-ping opacity-40" />
        </div>
        <div>
          <p className="text-white font-semibold">{callerName}</p>
          <p className="text-violet-300 text-sm flex items-center gap-1">
            {mode === "video" ? <Video className="w-3 h-3" /> : <Phone className="w-3 h-3" />}
            Incoming {mode} call...
          </p>
        </div>
      </div>
      <div className="flex gap-3">
        <Button
          onClick={onDecline}
          className="flex-1 bg-red-500/20 hover:bg-red-500/40 text-red-400 border border-red-500/30 rounded-xl h-10"
        >
          <PhoneOff className="w-4 h-4 mr-1" /> Decline
        </Button>
        <Button
          onClick={onAccept}
          className="flex-1 bg-green-500 hover:bg-green-600 text-white rounded-xl h-10 shadow-lg shadow-green-500/20"
        >
          <Phone className="w-4 h-4 mr-1" /> Accept
        </Button>
      </div>
    </div>
  );
}
