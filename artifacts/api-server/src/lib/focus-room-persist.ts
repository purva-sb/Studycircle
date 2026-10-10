import { db } from "@workspace/db";
import { focusRoomParticipantsTable } from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";

/** Persist seconds + status in a single UPDATE (preferred over calling both separately). */
export async function persistFocusRoomParticipantState(
  roomId: string,
  userId: string,
  totalStudySeconds: number,
  status: string,
): Promise<void> {
  try {
    await db
      .update(focusRoomParticipantsTable)
      .set({ totalStudySeconds: Math.max(0, Math.floor(totalStudySeconds)), status })
      .where(
        and(
          eq(focusRoomParticipantsTable.roomId, roomId),
          eq(focusRoomParticipantsTable.userId, userId),
        ),
      );
  } catch (e) {
    console.error("persist focus room state", e);
  }
}

/** Persist focus seconds to Postgres so refresh / server restart can restore baseline. */
export async function persistFocusRoomParticipantSeconds(
  roomId: string,
  userId: string,
  totalStudySeconds: number,
): Promise<void> {
  try {
    await db
      .update(focusRoomParticipantsTable)
      .set({ totalStudySeconds: Math.max(0, Math.floor(totalStudySeconds)) })
      .where(
        and(
          eq(focusRoomParticipantsTable.roomId, roomId),
          eq(focusRoomParticipantsTable.userId, userId),
        ),
      );
  } catch (e) {
    console.error("persist focus room seconds", e);
  }
}

/** Persist participant status to Postgres so server restart restores last known state. */
export async function persistFocusRoomParticipantStatus(
  roomId: string,
  userId: string,
  status: string,
): Promise<void> {
  try {
    await db
      .update(focusRoomParticipantsTable)
      .set({ status })
      .where(
        and(
          eq(focusRoomParticipantsTable.roomId, roomId),
          eq(focusRoomParticipantsTable.userId, userId),
        ),
      );
  } catch (e) {
    console.error("persist focus room status", e);
  }
}

/** Persist participant's current task to Postgres so page refresh restores it. */
export async function persistFocusRoomParticipantTask(
  roomId: string,
  userId: string,
  currentTask: string | null,
  isTaskPrivate: boolean,
): Promise<void> {
  try {
    await db
      .update(focusRoomParticipantsTable)
      .set({ currentTask, isTaskPrivate })
      .where(
        and(
          eq(focusRoomParticipantsTable.roomId, roomId),
          eq(focusRoomParticipantsTable.userId, userId),
        ),
      );
  } catch (e) {
    console.error("persist focus room task", e);
  }
}
