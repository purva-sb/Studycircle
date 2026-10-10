import { useState, useEffect, useRef } from "react";
import { useAuth, useUser } from "@clerk/clerk-react";
import { io, Socket } from "socket.io-client";
import { toast } from "sonner";
import { useLocation } from "wouter";
import { IncomingCallNotification } from "./dm-call";
import { customFetch } from "@workspace/api-client-react";

export function GlobalCallListener() {
  const { user } = useUser();
  const { getToken } = useAuth();
  const [, setLocation] = useLocation();
  const [incomingCall, setIncomingCall] = useState<{
    convId: string;
    callerId: string;
    callerName?: string;
    callerAvatar?: string;
  } | null>(null);

  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const connect = async () => {
      const token = await getToken();
      if (!token || cancelled) return;

      const socket = io(window.location.origin, {
        path: "/socket.io",
        auth: { token },
        transports: ["websocket"],
      });
      socketRef.current = socket;

      socket.on("connect", () => {
        // Fetch all conversations to join their rooms so we can receive calls
        customFetch("/api/dms")
          .then((res: any) => {
            if (res.conversations && !cancelled) {
              res.conversations.forEach((c: any) => socket.emit("join_dm", c.id));
            }
          })
          .catch(() => {});
      });

      socket.on("dm:call_invite", (data: { convId: string; mode: "voice" | "video"; callerId: string; callerName?: string; callerAvatar?: string }) => {
        // Ignore calls initiated by ourselves (from other tabs or concurrent sockets like dms.tsx)
        if (data.callerId === user.id) return;

        // Check Do Not Disturb (Focus Mode)
        try {
          const rawTimer = localStorage.getItem("sc_timer_state_v1");
          if (rawTimer) {
            const timerState = JSON.parse(rawTimer);
            if (timerState.isRunning) {
              // We are focusing. Reject automatically.
              socket.emit("dm:call_decline", { convId: data.convId, targetId: data.callerId });
              return;
            }
          }
        } catch (e) {
          // ignore parsing errors
        }
        
        // Also check focus room local status
        try {
           let isFocusing = false;
           for (let i = 0; i < localStorage.length; i++) {
             const key = localStorage.key(i);
             if (key?.startsWith("focus_status_")) {
               const status = localStorage.getItem(key);
               if (status === '"studying"') isFocusing = true;
             }
           }
           if (isFocusing) {
             socket.emit("dm:call_decline", { convId: data.convId, targetId: data.callerId });
             return;
           }
        } catch(e) {}

        // If we get here, ring!
        setIncomingCall(data);
      });

      socket.on("dm:call_end", () => {
        setIncomingCall(null);
      });
    };

    void connect();

    return () => {
      cancelled = true;
      socketRef.current?.disconnect();
    };
  }, [user, getToken]);

  if (!incomingCall) return null;

  return (
    <IncomingCallNotification
      mode={incomingCall.mode}
      callerName={incomingCall.callerName || "Someone"}
      callerAvatar={incomingCall.callerAvatar}
      onAccept={() => {
        // Navigate to DM with this conversation
        setLocation(`/dms?conv=${incomingCall.convId}&call=${incomingCall.mode}`);
        setIncomingCall(null);
      }}
      onDecline={() => {
        socketRef.current?.emit("dm:call_decline", {
          convId: incomingCall.convId,
          targetId: incomingCall.callerId,
        });
        setIncomingCall(null);
      }}
    />
  );
}
