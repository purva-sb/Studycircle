import { db } from "@workspace/db";
import {
  channelsTable,
  circleMembersTable,
  circleInvitesTable,
  dmConversationsTable,
  examAttemptsTable,
  goalsTable,
  messagesTable,
} from "@workspace/db/schema";
import { and, eq } from "drizzle-orm";

const MOD_ROLES = new Set(["owner", "co-owner", "co-leader", "moderator"]);

export async function getCircleMembership(circleId: string, userId: string) {
  const [row] = await db
    .select({ role: circleMembersTable.role })
    .from(circleMembersTable)
    .where(
      and(
        eq(circleMembersTable.circleId, circleId),
        eq(circleMembersTable.userId, userId),
      ),
    );
  return row ?? null;
}

export async function isCircleMember(circleId: string, userId: string): Promise<boolean> {
  return !!(await getCircleMembership(circleId, userId));
}

export async function canModerateCircle(circleId: string, userId: string): Promise<boolean> {
  const membership = await getCircleMembership(circleId, userId);
  return membership ? MOD_ROLES.has(membership.role) : false;
}

export async function getChannelCircleId(channelId: string): Promise<string | null> {
  const [channel] = await db
    .select({ circleId: channelsTable.circleId })
    .from(channelsTable)
    .where(eq(channelsTable.id, channelId));
  return channel?.circleId ?? null;
}

export async function isChannelMember(channelId: string, userId: string): Promise<boolean> {
  const circleId = await getChannelCircleId(channelId);
  if (!circleId) return false;
  return isCircleMember(circleId, userId);
}

export async function getMessageChannelId(messageId: string): Promise<string | null> {
  const [msg] = await db
    .select({ channelId: messagesTable.channelId })
    .from(messagesTable)
    .where(eq(messagesTable.id, messageId));
  return msg?.channelId ?? null;
}

export async function ownsGoal(goalId: string, userId: string): Promise<boolean> {
  const [goal] = await db
    .select({ userId: goalsTable.userId })
    .from(goalsTable)
    .where(eq(goalsTable.id, goalId));
  return goal?.userId === userId;
}

export async function ownsExamAttempt(attemptId: string, userId: string): Promise<boolean> {
  const [attempt] = await db
    .select({ userId: examAttemptsTable.userId })
    .from(examAttemptsTable)
    .where(eq(examAttemptsTable.id, attemptId));
  return attempt?.userId === userId;
}

export async function isDmParticipant(conversationId: string, userId: string): Promise<boolean> {
  const [conv] = await db
    .select({
      user1Id: dmConversationsTable.user1Id,
      user2Id: dmConversationsTable.user2Id,
    })
    .from(dmConversationsTable)
    .where(eq(dmConversationsTable.id, conversationId));
  if (!conv) return false;
  return conv.user1Id === userId || conv.user2Id === userId;
}

export async function canViewInvitePreview(code: string): Promise<boolean> {
  const [invite] = await db
    .select({ id: circleInvitesTable.id })
    .from(circleInvitesTable)
    .where(eq(circleInvitesTable.code, code));
  return !!invite;
}
