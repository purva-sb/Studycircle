import { useState, useEffect } from "react";
import {
  LiveKitRoom,
} from "@livekit/components-react";
import { CustomVideoLayout } from "./custom-video-layout";
import "@livekit/components-styles";
import { Loader2, AlertCircle, PhoneOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth, useUser } from "@clerk/clerk-react";
import { customFetch } from "@workspace/api-client-react";

interface VoiceChannelRoomProps {
  channelId: string;
  channelName: string;
  circleId: string;
  onLeave?: () => void;
}

export function VoiceChannelRoom({ channelId, channelName, onLeave }: VoiceChannelRoomProps) {
  const { user } = useUser();
  const { getToken } = useAuth();
  
  const [token, setToken] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string>("");

  const displayName = user?.fullName || user?.primaryEmailAddress?.emailAddress?.split("@")[0] || "You";

  useEffect(() => {
    let cancelled = false;

    const fetchToken = async () => {
      try {
        await getToken(); // Ensure valid Clerk session
        const roomName = `circle-${channelId}`;

        // Fetch a secure signed token from our backend
        const res = await customFetch<{ token: string }>(
          `/api/livekit/token?roomName=${encodeURIComponent(roomName)}&participantName=${encodeURIComponent(displayName)}`,
        );

        if (!cancelled) {
          setToken(res.token);
        }
      } catch (err: any) {
        if (!cancelled) {
          setErrorMsg(err?.message || "Failed to connect to voice channel");
        }
      }
    };

    fetchToken();

    return () => {
      cancelled = true;
    };
  }, [channelId, displayName, getToken]);

  if (errorMsg) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-background">
        <div className="flex flex-col items-center justify-center gap-3 p-8 rounded-3xl bg-destructive/10 border border-destructive/20 max-w-md w-full">
          <AlertCircle className="w-10 h-10 text-destructive" />
          <h2 className="text-lg font-bold text-destructive">Connection Failed</h2>
          <p className="text-sm font-medium text-destructive/80 text-center">
            {errorMsg}
          </p>
          <Button variant="outline" size="sm" onClick={onLeave} className="mt-2">
            Return to Text Channels
          </Button>
        </div>
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center bg-card">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-8 h-8 text-violet-500 animate-spin" />
          <p className="text-sm text-muted-foreground font-medium animate-pulse">
            Connecting to {channelName}...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-w-0 bg-card relative studycircle-livekit-theme">
      {/* Top Header overlay */}
      <div className="absolute top-0 left-0 right-0 p-4 z-10 flex justify-between items-center bg-gradient-to-b from-background/80 dark:from-black/60 to-transparent pointer-events-none">
        <div>
          <h2 className="text-foreground font-bold text-lg drop-shadow-md">#{channelName}</h2>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
            <span className="text-emerald-500 dark:text-emerald-400 text-xs font-semibold tracking-wider uppercase drop-shadow-md">
              Voice Connected
            </span>
          </div>
        </div>
      </div>

      <LiveKitRoom
        video={false} // Camera starts off by default
        audio={true}  // Mic starts on by default
        token={token}
        serverUrl={import.meta.env.VITE_LIVEKIT_URL}
        connect={true} // <-- CRITICAL: Tells the room to automatically connect!
        onDisconnected={onLeave}
        // Customize LiveKit to fit our layout fully
        className="flex-1 h-full w-full custom-lk-room"
      >
        {/* Custom Video Grid and Controls */}
        <CustomVideoLayout />
      </LiveKitRoom>
    </div>
  );
}
