import { Server } from "socket.io";
import type { Server as HttpServer } from "node:http";
import { z } from "zod";
import { logger } from "./lib/logger";
import { verifyClerkToken } from "./middleware/auth";
import { isChannelMember, isCircleMember, isDmParticipant } from "./lib/access";
import { store } from "./lib/store";
import { db } from "@workspace/db";
import { studySessionsTable, focusRoomParticipantsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { calculateAndUpdateStreak } from "./streak";
import {
  persistFocusRoomParticipantSeconds,
  persistFocusRoomParticipantStatus,
  persistFocusRoomParticipantState,
  persistFocusRoomParticipantTask,
} from "./lib/focus-room-persist";
import {
  isFocusRoomMember,
  loadAndEnsureFocusRoom,
  setFocusRoomChatEnabled,
} from "./lib/focus-room";

let io: Server;

// ---- Per-user sliding-window rate limiter ----
// key = `${userId}:${event}`, value = array of timestamps (ms)
const rateLimitBuckets = new Map<string, number[]>();
setInterval(() => rateLimitBuckets.clear(), 60_000); // GC stale entries every minute

/**
 * Returns true if the action is allowed.
 * @param userId  authenticated user id
 * @param event   event name used as namespace
 * @param max     max events allowed in the window
 * @param windowMs rolling window size in milliseconds
 */
function checkRate(userId: string, event: string, max: number, windowMs: number): boolean {
  const key = `${userId}:${event}`;
  const now = Date.now();
  const cutoff = now - windowMs;
  const hits = (rateLimitBuckets.get(key) ?? []).filter(t => t > cutoff);
  if (hits.length >= max) return false;
  hits.push(now);
  rateLimitBuckets.set(key, hits);
  return true;
}

const circlePresence = new Map<string, Set<string>>();
const socketUserMap = new Map<string, { userId: string; circleId: string }>();
// Tracks sessions already saved by the frontend (proper Exit click) to avoid double-saving on disconnect
const clientSavedSessions = new Set<string>(); // key: `${userId}:${roomId}`

async function autoSaveStudySession(userId: string, roomId: string, secs: number) {
  const mins = Math.round(secs / 60);
  if (mins < 1) return;
  try {
    await db.insert(studySessionsTable).values({
      userId,
      subjectId: "focus-room",
      mode: "focus",
      durationMinutes: mins,
      note: `Focus Room (auto-saved)`,
      startedAt: new Date(),
    });
    void calculateAndUpdateStreak(userId);
  } catch (e) {
    logger.error({ err: e, userId, roomId }, "Failed to auto-save study session on disconnect");
  }
}

// ---- Socket payload schemas (H3: validate untrusted client events) ----
const roomIdField = z.string().min(1).max(100);
const chatMessageSchema = z.object({ roomId: roomIdField, text: z.string().min(1).max(2000) });
const taskUpdateSchema = z.object({ roomId: roomIdField, task: z.string().max(200), isPrivate: z.boolean() });
const statusChangeSchema = z.object({
  roomId: roomIdField,
  status: z.enum(["studying", "break", "idle", "offline", "focusing"]),
  totalStudySeconds: z.number().int().nonnegative().max(1_000_000).optional(),
  todayStudySeconds: z.number().int().nonnegative().max(1_000_000).optional(),
});
const toggleChatSchema = z.object({ roomId: roomIdField, isEnabled: z.boolean() });
const connectRequestSchema = z.object({ roomId: roomIdField, targetUserId: z.string().min(1).max(200), fromName: z.string().max(100).optional() });
const startPomodoroSchema = z.object({ roomId: roomIdField, durationSeconds: z.number().int().positive().max(86_400).optional() });
const roomOnlySchema = z.object({ roomId: roomIdField });
const hostTargetSchema = z.object({ roomId: roomIdField, targetUserId: z.string().min(1).max(200) });
const callInviteSchema = z.object({ convId: z.string().min(1).max(100), mode: z.enum(["voice", "video"]), callerName: z.string().max(100).optional(), callerAvatar: z.string().max(2048).optional() });

// WebRTC relays carry opaque SDP/ICE blobs we can't fully schema; bound the target id and total size.
const isValidTarget = (id: unknown): id is string => typeof id === "string" && id.length > 0 && id.length < 100;
const isSmallEnough = (obj: unknown): boolean => {
  try { return JSON.stringify(obj ?? null).length < 100_000; } catch { return false; }
};

/** True if the user still has another live socket joined to this focus room (zombie-socket guard). */
function userHasOtherSocketInFocusRoom(roomId: string, userId: string, excludeSocketId: string): boolean {
  const roomSet = io.sockets.adapter.rooms.get(`focus_room_${roomId}`);
  if (!roomSet) return false;
  for (const sid of roomSet) {
    if (sid === excludeSocketId) continue;
    const s = io.sockets.sockets.get(sid);
    if (s?.data?.userId === userId) return true;
  }
  return false;
}

function parseCorsOrigins(): string[] {
  return process.env.CORS_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) ?? [
    "http://localhost:5173",
    "http://localhost:5000",
  ];
}

export function initSocket(server: HttpServer) {
  io = new Server(server, {
    cors: {
      origin: parseCorsOrigins(),
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token as string | undefined;
      if (!token) return next(new Error("Unauthorized"));
      socket.data.userId = await verifyClerkToken(token);
      next();
    } catch {
      next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    const authUserId = socket.data.userId as string;
    logger.info({ socketId: socket.id, userId: authUserId }, "Socket connected");
    socket.join(`user_${authUserId}`);

    socket.on("join_channel", async (channelId: string) => {
      if (!channelId || !(await isChannelMember(channelId, authUserId))) return;
      socket.join(`channel_${channelId}`);
    });

    socket.on("leave_channel", (channelId: string) => {
      socket.leave(`channel_${channelId}`);
    });

    socket.on("join_dm", async (convId: string) => {
      if (!convId || !(await isDmParticipant(convId, authUserId))) return;
      socket.join(`dm_${convId}`);

      // Track which DM rooms this socket joined (for offline cleanup on disconnect)
      if (!socket.data.dmRooms) socket.data.dmRooms = new Set<string>();
      (socket.data.dmRooms as Set<string>).add(convId);

      // Announce this user is online to everyone in the conv (including self)
      io.to(`dm_${convId}`).emit("dm:presence", { userId: authUserId, online: true });

      // Send back who else is already online in this conv
      const roomSockets = await io.in(`dm_${convId}`).allSockets();
      for (const sid of roomSockets) {
        if (sid === socket.id) continue;
        const s = io.sockets.sockets.get(sid);
        if (s?.data?.userId && s.data.userId !== authUserId) {
          socket.emit("dm:presence", { userId: s.data.userId as string, online: true });
        }
      }
    });

    socket.on("leave_dm", (convId: string) => {
      socket.leave(`dm_${convId}`);
    });

    socket.on("join_circle", async ({ circleId, userId }: { circleId: string; userId: string }) => {
      if (!circleId || userId !== authUserId) return;
      if (!(await isCircleMember(circleId, authUserId))) return;

      socketUserMap.set(socket.id, { userId: authUserId, circleId });

      if (!circlePresence.has(circleId)) {
        circlePresence.set(circleId, new Set());
      }
      circlePresence.get(circleId)!.add(authUserId);

      socket.join(`circle_${circleId}`);

      io.to(`circle_${circleId}`).emit("presence:update", {
        circleId,
        onlineUserIds: Array.from(circlePresence.get(circleId) || []),
      });
    });

    socket.on("typing:start", async ({ channelId, userId, displayName }: { channelId: string; userId: string; displayName: string }) => {
      if (!checkRate(authUserId, "typing", 2, 3_000)) return; // 2 typing events / 3 s
      if (userId !== authUserId || !(await isChannelMember(channelId, authUserId))) return;
      socket.to(`channel_${channelId}`).emit("typing:start", { userId, displayName });
    });

    socket.on("typing:stop", async ({ channelId, userId }: { channelId: string; userId: string }) => {
      if (userId !== authUserId || !(await isChannelMember(channelId, authUserId))) return;
      socket.to(`channel_${channelId}`).emit("typing:stop", { userId });
    });

    socket.on("dm:typing", async ({ convId, userId }: { convId: string; userId: string }) => {
      if (!checkRate(authUserId, "typing", 2, 3_000)) return; // shared bucket with channel typing
      if (userId !== authUserId || !(await isDmParticipant(convId, authUserId))) return;
      socket.to(`dm_${convId}`).emit("dm:typing", { convId, userId });
    });

    socket.on("dm:stop_typing", async ({ convId, userId }: { convId: string; userId: string }) => {
      if (userId !== authUserId || !(await isDmParticipant(convId, authUserId))) return;
      socket.to(`dm_${convId}`).emit("dm:stop_typing", { convId, userId });
    });

    const socketVoiceMap = new Map<string, string>();

    socket.on("voice:join", async ({ channelId, userId, displayName, avatarUrl }: { channelId: string; userId: string; displayName: string; avatarUrl: string }) => {
      if (userId !== authUserId || !(await isChannelMember(channelId, authUserId))) return;
      socket.join(`voice_${channelId}`);
      socketVoiceMap.set(socket.id, channelId);
      socket.to(`voice_${channelId}`).emit("voice:user-joined", { socketId: socket.id, userId, displayName, avatarUrl });
    });

    socket.on("voice:leave", ({ channelId }: { channelId: string }) => {
      socket.leave(`voice_${channelId}`);
      socketVoiceMap.delete(socket.id);
      socket.to(`voice_${channelId}`).emit("voice:user-left", { socketId: socket.id });
    });

    socket.on("voice:offer", ({ targetSocketId, offer, callerInfo }: { targetSocketId: string; offer: unknown; callerInfo: unknown }) => {
      if (!isValidTarget(targetSocketId) || !isSmallEnough(offer) || !isSmallEnough(callerInfo)) return;
      socket.to(targetSocketId).emit("voice:offer", { socketId: socket.id, offer, callerInfo });
    });

    socket.on("voice:answer", ({ targetSocketId, answer }: { targetSocketId: string; answer: unknown }) => {
      if (!isValidTarget(targetSocketId) || !isSmallEnough(answer)) return;
      socket.to(targetSocketId).emit("voice:answer", { socketId: socket.id, answer });
    });

    socket.on("voice:ice-candidate", ({ targetSocketId, candidate }: { targetSocketId: string; candidate: unknown }) => {
      if (!isValidTarget(targetSocketId) || !isSmallEnough(candidate)) return;
      socket.to(targetSocketId).emit("voice:ice-candidate", { socketId: socket.id, candidate });
    });

    socket.on("voice:mute-state", ({ channelId, isMuted, isDeafened }: { channelId: string; isMuted: boolean; isDeafened: boolean }) => {
      socket.to(`voice_${channelId}`).emit("voice:user-mute-state", { socketId: socket.id, isMuted, isDeafened });
    });

    // ---- DM Call Signalling ----
    socket.on("dm:call_invite", async (raw: unknown) => {
      if (!checkRate(authUserId, "dm:call_invite", 3, 60_000)) return; // 3 call rings / min
      const parsed = callInviteSchema.safeParse(raw);
      if (!parsed.success) return;
      const { convId, mode, callerName, callerAvatar } = parsed.data;
      if (!(await isDmParticipant(convId, authUserId))) return;
      // Forward to everyone else in the DM room (the other participant)
      socket.to(`dm_${convId}`).emit("dm:call_invite", {
        convId,
        mode,
        callerId: authUserId,
        callerName,
        callerAvatar,
      });
    });

    socket.on("dm:call_accept", async ({ convId }: { convId: string }) => {
      if (!(await isDmParticipant(convId, authUserId))) return;
      socket.to(`dm_${convId}`).emit("dm:call_accept", { convId, userId: authUserId });
    });

    socket.on("dm:call_decline", async ({ convId }: { convId: string }) => {
      if (!(await isDmParticipant(convId, authUserId))) return;
      socket.to(`dm_${convId}`).emit("dm:call_decline", { convId, userId: authUserId });
    });

    socket.on("dm:call_end", async ({ convId }: { convId: string }) => {
      if (!(await isDmParticipant(convId, authUserId))) return;
      socket.to(`dm_${convId}`).emit("dm:call_end", { convId, userId: authUserId });
    });

    // ---- Focus Room Signalling ----
    const broadcastActiveRooms = () => {
      io.to("global_focus").emit("global:rooms_activity", { rooms: store.getActiveRoomsPayload() });
    };

    socket.on("global:subscribe_rooms", () => {
      socket.join("global_focus");
      socket.emit("global:rooms_activity", { rooms: store.getActiveRoomsPayload() });
    });

    // Cache of roomIds this socket has been verified as a member of.
    // Avoids a DB SELECT on every socket event for the same room.
    if (!socket.data.verifiedRooms) socket.data.verifiedRooms = new Set<string>();

    const isVerifiedMember = async (roomId: string): Promise<boolean> => {
      if ((socket.data.verifiedRooms as Set<string>).has(roomId)) return true;
      const ok = await isFocusRoomMember(roomId, authUserId);
      if (ok) (socket.data.verifiedRooms as Set<string>).add(roomId);
      return ok;
    };

    const ensureRoomInStore = async (roomId: string): Promise<void> => {
      // Only hits DB if room was evicted from store (server restart / cold reconnect).
      if (!store.getFocusRoom(roomId)) await loadAndEnsureFocusRoom(roomId);
    };

    let currentFocusRoomId: string | null = null;

    socket.on("join_focus_room", async (payload: any) => {
      const roomId = typeof payload === "string" ? payload : payload?.roomId;
      const user = typeof payload === "string" ? null : payload?.user;

      if (!roomId) return;

      const room = await loadAndEnsureFocusRoom(roomId);
      if (!room) {
        socket.emit("focus:error", { message: "Room not found" });
        return;
      }
      if (!(await isVerifiedMember(roomId))) {
        socket.emit("focus:error", { message: "Join this room before entering the live session" });
        return;
      }

      socket.join(`focus_room_${roomId}`);
      currentFocusRoomId = roomId;

      // One-time per socket: subscribe to room_watch_${r} for every room this user is a member of.
      // Status transitions broadcast to room_watch_${roomId} so only actual members receive them —
      // not every connected user like a flat global_presence channel would.
      if (!socket.data.watchChannelsJoined) {
        socket.data.watchChannelsJoined = true;
        try {
          const memberships = await db
            .select({ roomId: focusRoomParticipantsTable.roomId })
            .from(focusRoomParticipantsTable)
            .where(eq(focusRoomParticipantsTable.userId, authUserId));
          for (const m of memberships) {
            socket.join(`room_watch_${m.roomId}`);
            // Emit current active statuses for other rooms immediately so the joining
            // client doesn't have to wait for the next transition to see correct status.
            // Uses in-memory store — no extra DB query needed.
            if (m.roomId !== roomId) {
              const otherRoom = store.getFocusRoom(m.roomId);
              if (otherRoom?.participants?.length) {
                for (const p of otherRoom.participants) {
                  if ((p.status === "studying" || p.status === "focusing" || p.status === "break") && p.userId !== authUserId) {
                    socket.emit("global:user_status", {
                      userId: p.userId,
                      status: p.status,
                      totalStudySeconds: p.totalStudySeconds,
                      displayName: p.displayName,
                      avatarUrl: p.avatarUrl,
                    });
                  }
                }
              }
            }
          }
        } catch (e) {
          logger.error({ err: e, userId: authUserId }, "Failed to load room memberships for watch channels");
        }
      }

      if (user) {
        const roomState = store.getFocusRoom(roomId);
        const stored = roomState?.participants?.find((x: any) => x.userId === authUserId);

        // When participant was removed from memory on disconnect, recover seconds from DB
        // so reconnecting users don't broadcast totalStudySeconds=0 to others
        let storedSeconds = stored?.totalStudySeconds ?? 0;
        if (!stored) {
          const [dbP] = await db
            .select({ totalStudySeconds: focusRoomParticipantsTable.totalStudySeconds })
            .from(focusRoomParticipantsTable)
            .where(and(
              eq(focusRoomParticipantsTable.roomId, roomId),
              eq(focusRoomParticipantsTable.userId, authUserId),
            ))
            .limit(1);
          storedSeconds = dbP?.totalStudySeconds ?? 0;
        }

        const merged = {
          userId: authUserId,
          displayName: user.displayName ?? stored?.displayName ?? "Anonymous",
          avatarUrl: user.avatarUrl ?? stored?.avatarUrl ?? "",
          status:
            user.status && user.status !== "idle"
              ? user.status
              : (stored?.status ?? "idle"),
          totalStudySeconds: Math.max(user.totalStudySeconds ?? 0, storedSeconds),
          lastStatusChangeAt: stored?.lastStatusChangeAt ?? user.lastStatusChangeAt,
        };
        store.joinFocusRoom(roomId, merged);

        const updated = store.getFocusRoom(roomId);
        const others = (updated?.participants ?? []).filter((p) => p.userId !== authUserId);
        socket.emit("focus:room_state", { roomId, participants: others });

        socket.to(`focus_room_${roomId}`).emit("focus:user_joined", {
          userId: merged.userId,
          displayName: merged.displayName,
          avatarUrl: merged.avatarUrl,
          status: merged.status,
          totalStudySeconds: merged.totalStudySeconds,
          lastStatusChangeAt: merged.lastStatusChangeAt ?? Date.now(),
        });
        broadcastActiveRooms();
      }
    });

    socket.on("focus:session_saved", ({ roomId }: { roomId: string }) => {
      clientSavedSessions.add(`${authUserId}:${roomId}`);
    });

    socket.on("leave_focus_room", async (roomId: string) => {
      socket.leave(`focus_room_${roomId}`);
      currentFocusRoomId = null;
      if (!userHasOtherSocketInFocusRoom(roomId, authUserId, socket.id)) {
        const mem = store.getFocusRoom(roomId);
        const secs = mem?.participants?.find((p) => p.userId === authUserId)?.totalStudySeconds;
        store.leaveFocusRoom(roomId, authUserId);
        await persistFocusRoomParticipantState(roomId, authUserId, secs ?? 0, "idle");
        const sessionKey = `${authUserId}:${roomId}`;
        if (!clientSavedSessions.has(sessionKey)) {
          void autoSaveStudySession(authUserId, roomId, secs ?? 0);
        }
        clientSavedSessions.delete(sessionKey);
        socket.to(`focus_room_${roomId}`).emit("focus:status_change", { roomId, userId: authUserId, status: "offline" });
        socket.to(`room_watch_${roomId}`).emit("global:user_status", { userId: authUserId, status: "offline" });
        broadcastActiveRooms();
      }
    });

    socket.on("focus:status_change", async (raw: unknown) => {
      if (!checkRate(authUserId, "focus:status_change", 10, 10_000)) return; // 10 / 10 s
      const parsed = statusChangeSchema.safeParse(raw);
      if (!parsed.success) return;
      const { roomId, status, totalStudySeconds, todayStudySeconds } = parsed.data;
      if (!(await isVerifiedMember(roomId))) return;
      await ensureRoomInStore(roomId);
      const changedAt = Date.now();
      // Snapshot status BEFORE update to detect transitions (heartbeats send same status)
      const prevStatus = store.getFocusRoom(roomId)?.participants?.find((x: any) => x.userId === authUserId)?.status;
      const isTransition = prevStatus !== status;
      store.updateFocusRoomParticipantStatus(roomId, authUserId, { status, totalStudySeconds });
      if (totalStudySeconds !== undefined) {
        await persistFocusRoomParticipantState(roomId, authUserId, totalStudySeconds, status);
      } else {
        await persistFocusRoomParticipantStatus(roomId, authUserId, status);
      }
      socket.to(`focus_room_${roomId}`).emit("focus:status_change", { roomId, userId: authUserId, status, totalStudySeconds, todayStudySeconds, lastStatusChangeAt: changedAt });
      // Only relay transitions — heartbeats (same status, updated seconds every 30 s) are skipped.
      // Receivers tick the timer live via participantStartTimes, so they don't need 30 s refreshes.
      if (isTransition) {
        const mem2 = store.getFocusRoom(roomId);
        const p2 = mem2?.participants?.find((x: any) => x.userId === authUserId);
        // Broadcast to room_watch_${roomId}: only members of this room receive it,
        // regardless of which room they're currently viewing.
        socket.to(`room_watch_${roomId}`).emit("global:user_status", {
          userId: authUserId,
          status,
          totalStudySeconds,
          todayStudySeconds,
          displayName: p2?.displayName,
          avatarUrl: p2?.avatarUrl,
        });
      }
    });

    socket.on("focus:task_update", async (raw: unknown) => {
      const parsed = taskUpdateSchema.safeParse(raw);
      if (!parsed.success) return;
      const { roomId, task, isPrivate } = parsed.data;
      if (!(await isVerifiedMember(roomId))) return;
      store.updateFocusRoomParticipantTask(roomId, authUserId, task, isPrivate);
      void persistFocusRoomParticipantTask(roomId, authUserId, task || null, isPrivate);
      socket.to(`focus_room_${roomId}`).emit("focus:task_update", { roomId, userId: authUserId, task, isPrivate });
    });

    socket.on("focus:toggle_chat", async (raw: unknown) => {
      const parsed = toggleChatSchema.safeParse(raw);
      if (!parsed.success) return;
      const { roomId, isEnabled } = parsed.data;
      const room = await loadAndEnsureFocusRoom(roomId);
      if (!room || room.hostId !== authUserId) return;
      await setFocusRoomChatEnabled(roomId, isEnabled);
      io.to(`focus_room_${roomId}`).emit("focus:toggle_chat", { roomId, isEnabled });
    });

    socket.on("focus:chat_message", async (raw: unknown) => {
      if (!checkRate(authUserId, "focus:chat_message", 5, 5_000)) return; // 5 msgs / 5 s
      const parsed = chatMessageSchema.safeParse(raw);
      if (!parsed.success) return;
      const { roomId, text } = parsed.data;
      if (!(await isVerifiedMember(roomId))) return;
      const mem = store.getFocusRoom(roomId);
      if (mem?.isChatEnabled === false) return;
      io.to(`focus_room_${roomId}`).emit("focus:chat_message", { roomId, userId: authUserId, text, timestamp: Date.now() });
    });

    socket.on("focus:connect_request", async (raw: unknown) => {
      const parsed = connectRequestSchema.safeParse(raw);
      if (!parsed.success) return;
      const { roomId, targetUserId, fromName } = parsed.data;
      if (!(await isVerifiedMember(roomId))) return;
      socket.to(`user_${targetUserId}`).emit("focus:connect_request", {
        roomId,
        fromUserId: authUserId,
        fromName: fromName ?? "Someone",
      });
    });

    // ---- Emoji Reactions ----
    const ALLOWED_REACTIONS = ["🔥", "💪", "✅", "👀", "☕"];
    socket.on("focus:reaction", async ({ roomId, emoji }: { roomId: string; emoji: string }) => {
      if (!checkRate(authUserId, "focus:reaction", 3, 5_000)) return; // 3 reactions / 5 s
      if (!ALLOWED_REACTIONS.includes(emoji)) return;
      if (!(await isVerifiedMember(roomId))) return;
      const mem = store.getFocusRoom(roomId);
      const sender = mem?.participants.find(p => p.userId === authUserId);
      io.to(`focus_room_${roomId}`).emit("focus:reaction_received", {
        roomId,
        fromUserId: authUserId,
        fromName: sender?.displayName ?? "Someone",
        emoji,
        id: `${authUserId}-${Date.now()}`,
      });
    });

    // ---- Pomodoro / Shared Timer ----
    socket.on("focus:start_pomodoro", async (raw: unknown) => {
      const parsed = startPomodoroSchema.safeParse(raw);
      if (!parsed.success) return;
      const { roomId, durationSeconds } = parsed.data;
      const room = await loadAndEnsureFocusRoom(roomId);
      if (!room || room.hostId !== authUserId) return;
      const secs = Math.min(Math.max(durationSeconds ?? 1500, 60), 7200);
      // Preserve original totalSeconds when resuming a paused timer
      const existing = store.getFocusRoom(roomId);
      const totalOverride = (existing?.sharedTimer.totalSeconds ?? 0) > secs
        ? existing!.sharedTimer.totalSeconds
        : undefined;
      store.startPomodoro(roomId, secs, io, totalOverride);
      const updated = store.getFocusRoom(roomId);
      io.to(`focus_room_${roomId}`).emit("focus:pomodoro_tick", {
        roomId,
        remainingSeconds: updated?.sharedTimer.remainingSeconds ?? secs,
        totalSeconds: updated?.sharedTimer.totalSeconds ?? secs,
        mode: "pomodoro",
        label: "Focus",
        isRunning: true,
      });
    });

    socket.on("focus:pause_pomodoro", async (raw: unknown) => {
      const parsed = roomOnlySchema.safeParse(raw);
      if (!parsed.success) return;
      const { roomId } = parsed.data;
      const room = await loadAndEnsureFocusRoom(roomId);
      if (!room || room.hostId !== authUserId) return;
      store.pausePomodoro(roomId);
      const r = store.getFocusRoom(roomId);
      io.to(`focus_room_${roomId}`).emit("focus:pomodoro_tick", {
        roomId,
        remainingSeconds: r?.sharedTimer.remainingSeconds ?? 0,
        totalSeconds: r?.sharedTimer.totalSeconds ?? 0,
        mode: r?.sharedTimer.mode ?? "stopwatch",
        label: r?.sharedTimer.label ?? "Paused",
        isRunning: false,
      });
    });

    socket.on("focus:reset_pomodoro", async (raw: unknown) => {
      const parsed = roomOnlySchema.safeParse(raw);
      if (!parsed.success) return;
      const { roomId } = parsed.data;
      const room = await loadAndEnsureFocusRoom(roomId);
      if (!room || room.hostId !== authUserId) return;
      store.resetPomodoro(roomId);
      io.to(`focus_room_${roomId}`).emit("focus:pomodoro_tick", {
        roomId,
        remainingSeconds: 0,
        totalSeconds: 0,
        mode: "stopwatch",
        label: "Session",
        isRunning: false,
      });
    });

    // ---- Host Controls ----
    socket.on("focus:kick_participant", async (raw: unknown) => {
      const parsed = hostTargetSchema.safeParse(raw);
      if (!parsed.success) return;
      const { roomId, targetUserId } = parsed.data;
      const room = await loadAndEnsureFocusRoom(roomId);
      if (!room || room.hostId !== authUserId) return;
      if (targetUserId === authUserId) return;
      const mem = store.getFocusRoom(roomId);
      const secs = mem?.participants.find(p => p.userId === targetUserId)?.totalStudySeconds;
      store.leaveFocusRoom(roomId, targetUserId);
      void persistFocusRoomParticipantState(roomId, targetUserId, secs ?? 0, "idle");
      io.to(`user_${targetUserId}`).emit("focus:kicked", { roomId });
      io.to(`focus_room_${roomId}`).emit("focus:status_change", { roomId, userId: targetUserId, status: "offline" });
    });

    socket.on("focus:mute_participant", async (raw: unknown) => {
      const parsed = hostTargetSchema.safeParse(raw);
      if (!parsed.success) return;
      const { roomId, targetUserId } = parsed.data;
      const room = await loadAndEnsureFocusRoom(roomId);
      if (!room || room.hostId !== authUserId) return;
      const mem = store.getFocusRoom(roomId);
      const p = mem?.participants.find(x => x.userId === targetUserId);
      if (p) p.micOn = false;
      io.to(`user_${targetUserId}`).emit("focus:muted", { roomId });
      io.to(`focus_room_${roomId}`).emit("focus:participant_mic_change", { roomId, userId: targetUserId, micOn: false });
    });

    socket.on("focus:unmute_participant", async (raw: unknown) => {
      const parsed = hostTargetSchema.safeParse(raw);
      if (!parsed.success) return;
      const { roomId, targetUserId } = parsed.data;
      const room = await loadAndEnsureFocusRoom(roomId);
      if (!room || room.hostId !== authUserId) return;
      const mem = store.getFocusRoom(roomId);
      const p = mem?.participants.find(x => x.userId === targetUserId);
      if (p) p.micOn = true;
      io.to(`user_${targetUserId}`).emit("focus:unmuted", { roomId });
      io.to(`focus_room_${roomId}`).emit("focus:participant_mic_change", { roomId, userId: targetUserId, micOn: true });
    });

    socket.on("disconnect", () => {
      const voiceChannelId = socketVoiceMap.get(socket.id);
      if (voiceChannelId) {
        socket.to(`voice_${voiceChannelId}`).emit("voice:user-left", { socketId: socket.id });
        socketVoiceMap.delete(socket.id);
      }

      if (currentFocusRoomId) {
        const roomId = currentFocusRoomId;
        if (!userHasOtherSocketInFocusRoom(roomId, authUserId, socket.id)) {
          const mem = store.getFocusRoom(roomId);
          const secs = mem?.participants?.find((p) => p.userId === authUserId)?.totalStudySeconds;
          store.leaveFocusRoom(roomId, authUserId);
          void persistFocusRoomParticipantState(roomId, authUserId, secs ?? 0, "idle");
          const sessionKey = `${authUserId}:${roomId}`;
          if (!clientSavedSessions.has(sessionKey)) {
            void autoSaveStudySession(authUserId, roomId, secs ?? 0);
          }
          clientSavedSessions.delete(sessionKey);
          socket.to(`focus_room_${roomId}`).emit("focus:status_change", { roomId, userId: authUserId, status: "offline" });
          socket.to(`room_watch_${roomId}`).emit("global:user_status", { userId: authUserId, status: "offline" });
          broadcastActiveRooms();
        }
      }

      // DM presence: if this is the user's last socket, broadcast offline to all their DM convs
      const dmRooms = socket.data.dmRooms as Set<string> | undefined;
      if (dmRooms && dmRooms.size > 0) {
        let hasOtherSocket = false;
        for (const [sid, s] of io.sockets.sockets.entries()) {
          if (sid !== socket.id && (s.data?.userId as string) === authUserId) { hasOtherSocket = true; break; }
        }
        if (!hasOtherSocket) {
          for (const convId of dmRooms) {
            io.to(`dm_${convId}`).emit("dm:presence", { userId: authUserId, online: false });
          }
        }
      }

      const userInfo = socketUserMap.get(socket.id);
      if (userInfo) {
        const { userId, circleId } = userInfo;
        const presenceSet = circlePresence.get(circleId);
        if (presenceSet) {
          let hasOtherSocket = false;
          for (const [sid, info] of socketUserMap.entries()) {
            if (sid !== socket.id && info.userId === userId && info.circleId === circleId) {
              hasOtherSocket = true;
              break;
            }
          }

          if (!hasOtherSocket) {
            presenceSet.delete(userId);
            if (presenceSet.size === 0) {
              circlePresence.delete(circleId);
            }
          }

          io.to(`circle_${circleId}`).emit("presence:update", {
            circleId,
            onlineUserIds: Array.from(circlePresence.get(circleId) || []),
          });
        }
        socketUserMap.delete(socket.id);
      }

      logger.info({ socketId: socket.id }, "Socket disconnected");
    });
  });
}

export function getIO(): Server {
  if (!io) {
    throw new Error("Socket.io not initialized!");
  }
  return io;
}

export function getOnlineUsers(circleId: string): Set<string> {
  return circlePresence.get(circleId) || new Set();
}
