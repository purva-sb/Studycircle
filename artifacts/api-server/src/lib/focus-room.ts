import { db } from "@workspace/db";
import { focusRoomsTable, focusRoomParticipantsTable } from "@workspace/db/schema";
import { and, count, eq } from "drizzle-orm";
import { store } from "./store";

const focusRoomColumns = {
  id: focusRoomsTable.id,
  name: focusRoomsTable.name,
  description: focusRoomsTable.description,
  hostId: focusRoomsTable.hostId,
  hostName: focusRoomsTable.hostName,
  hostAvatar: focusRoomsTable.hostAvatar,
  mode: focusRoomsTable.mode,
  maxParticipants: focusRoomsTable.maxParticipants,
  isPrivate: focusRoomsTable.isPrivate,
  exam: focusRoomsTable.exam,
  accentColor: focusRoomsTable.accentColor,
  isLive: focusRoomsTable.isLive,
  isChatEnabled: focusRoomsTable.isChatEnabled,
  linkedCircleId: focusRoomsTable.linkedCircleId,
  createdAt: focusRoomsTable.createdAt,
  lastActivityAt: focusRoomsTable.lastActivityAt,
};

export type FocusRoomDbRow = typeof focusRoomColumns extends infer _T
  ? {
      id: string;
      name: string;
      description: string;
      hostId: string;
      hostName: string;
      hostAvatar: string;
      mode: string;
      maxParticipants: number;
      isPrivate: boolean;
      exam: string;
      accentColor: string;
      isLive: boolean;
      isChatEnabled: boolean;
      linkedCircleId: string | null;
      createdAt: Date;
      lastActivityAt: Date;
    }
  : never;

export async function getFocusRoomRow(roomId: string): Promise<FocusRoomDbRow | null> {
  const [room] = await db
    .select(focusRoomColumns)
    .from(focusRoomsTable)
    .where(eq(focusRoomsTable.id, roomId));
  return room ?? null;
}

export async function isFocusRoomMember(roomId: string, userId: string): Promise<boolean> {
  const [row] = await db
    .select({ userId: focusRoomParticipantsTable.userId })
    .from(focusRoomParticipantsTable)
    .where(
      and(
        eq(focusRoomParticipantsTable.roomId, roomId),
        eq(focusRoomParticipantsTable.userId, userId),
      ),
    )
    .limit(1);
  return !!row;
}

export async function countFocusRoomParticipants(roomId: string): Promise<number> {
  const rows = await db
    .select({ count: count() })
    .from(focusRoomParticipantsTable)
    .where(eq(focusRoomParticipantsTable.roomId, roomId));
  return Number(rows[0]?.count ?? 0);
}

/** Sync Postgres room metadata into the in-memory store (required for sockets). */
export function ensureInMemoryFocusRoom(room: FocusRoomDbRow): void {
  const mem = store.getFocusRoom(room.id);
  store.ensureFocusRoom({
    id: room.id,
    name: room.name,
    description: room.description,
    hostId: room.hostId,
    hostName: room.hostName,
    hostAvatar: room.hostAvatar,
    mode: room.mode as "silent" | "voice" | "video",
    maxParticipants: room.maxParticipants,
    isPrivate: room.isPrivate,
    exam: room.exam,
    accentColor: room.accentColor,
    // Prefer in-memory (most recent toggle) but fall back to DB value on cold start
    isChatEnabled: mem?.isChatEnabled ?? room.isChatEnabled,
  });
}

export async function loadAndEnsureFocusRoom(roomId: string): Promise<FocusRoomDbRow | null> {
  const room = await getFocusRoomRow(roomId);
  if (!room) return null;
  ensureInMemoryFocusRoom(room);
  return room;
}

export async function setFocusRoomChatEnabled(roomId: string, isEnabled: boolean): Promise<void> {
  store.setFocusChatEnabled(roomId, isEnabled);
  await db
    .update(focusRoomsTable)
    .set({ isChatEnabled: isEnabled })
    .where(eq(focusRoomsTable.id, roomId));
}
