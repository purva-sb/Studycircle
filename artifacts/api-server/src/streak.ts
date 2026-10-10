import { db } from "@workspace/db";
import { studySessionsTable, usersTable } from "@workspace/db/schema";
import { eq, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";

export async function calculateAndUpdateStreak(userId: string): Promise<number> {
  const rows = await db
    .selectDistinct({ date: sql<string>`(${studySessionsTable.startedAt})::date::text` })
    .from(studySessionsTable)
    .where(eq(studySessionsTable.userId, userId))
    .orderBy(desc(sql`(${studySessionsTable.startedAt})::date`));

  if (rows.length === 0) {
    await db.update(usersTable).set({ streakDays: 0 }).where(eq(usersTable.id, userId));
    return 0;
  }

  const todayUTC = new Date().toISOString().slice(0, 10);
  const yesterdayUTC = new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
  const dates = rows.map(r => r.date);

  // Streak is dead if most recent session is not from today or yesterday
  if (dates[0] !== todayUTC && dates[0] !== yesterdayUTC) {
    await db.update(usersTable).set({ streakDays: 0 }).where(eq(usersTable.id, userId));
    return 0;
  }

  let streak = 0;
  let cursor = dates[0];

  for (const dateStr of dates) {
    if (dateStr === cursor) {
      streak++;
      const d = new Date(cursor + "T00:00:00Z");
      d.setUTCDate(d.getUTCDate() - 1);
      cursor = d.toISOString().slice(0, 10);
    } else {
      break;
    }
  }

  await db.update(usersTable).set({ streakDays: streak }).where(eq(usersTable.id, userId));
  return streak;
}
