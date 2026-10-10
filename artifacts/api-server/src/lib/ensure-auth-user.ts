import { db } from "@workspace/db";
import { usersTable } from "@workspace/db/schema";

const AVATAR_COUNT = 10;

/** Clerk users must exist in Postgres before FK inserts (focus room participants, etc.). */
export async function ensureAuthUserInDb(
  userId: string,
  displayName: string,
  avatarUrl: string,
): Promise<void> {
  const safeName = displayName?.trim() || "User";
  const safeAvatar = avatarUrl ?? "";
  const handle = `user_${userId.replace(/[^a-zA-Z0-9]/g, "").slice(0, 12)}_${userId.slice(-6)}`;
  // Assign a deterministic default avatar so every user has a cartoon icon from day one
  const defaultAvatarIndex = (userId.charCodeAt(userId.length - 1) % AVATAR_COUNT) + 1;
  const defaultAvatarId = `av_${defaultAvatarIndex}`;

  await db
    .insert(usersTable)
    .values({
      id: userId,
      displayName: safeName,
      handle,
      avatarUrl: safeAvatar,
      examFocus: "GATE",
      activeAvatarId: defaultAvatarId,
    })
    .onConflictDoUpdate({
      target: usersTable.id,
      set: {
        displayName: safeName,
        avatarUrl: safeAvatar,
      },
      // Don't overwrite activeAvatarId on subsequent calls — only set on first insert
    });
}
