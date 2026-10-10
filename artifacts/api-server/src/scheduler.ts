import { db } from "@workspace/db";
import { examsTable, usersTable, studySessionsTable } from "@workspace/db/schema";
import { and, eq, isNotNull, lte, ne, inArray, gte, gt, sql } from "drizzle-orm";
import { createNotification } from "./routes/studycircle";
import { logger } from "./lib/logger";

// ─── Exam goes-live ───────────────────────────────────────────────────────────
//
// Runs every 60s. Finds scheduled exams whose scheduledAt has passed but are
// still marked isLive=false, flips them live, and notifies matching users.

async function checkExamsGoLive() {
  const now = new Date();

  const dueExams = await db
    .select({ id: examsTable.id, title: examsTable.title, exam: examsTable.exam })
    .from(examsTable)
    .where(
      and(
        eq(examsTable.isLive, false),
        isNotNull(examsTable.scheduledAt),
        lte(examsTable.scheduledAt, now),
      )
    );

  if (dueExams.length === 0) return;

  for (const exam of dueExams) {
    try {
      await db.update(examsTable).set({ isLive: true }).where(eq(examsTable.id, exam.id));

      // Notify users whose examFocus matches this exam type
      const users = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.examFocus, exam.exam));

      await Promise.all(
        users.map(u =>
          createNotification(
            u.id,
            "exam_live",
            "Exam is now live!",
            `${exam.title} has started — attempt it now before time runs out.`,
            `/exams/${exam.id}`
          )
        )
      );

      logger.info({ examId: exam.id, examTitle: exam.title, notified: users.length }, "Exam went live");
    } catch (err) {
      logger.error({ err, examId: exam.id }, "Failed to process exam go-live");
    }
  }
}

// ─── Streak reminder ──────────────────────────────────────────────────────────
//
// Fires once per day at ~8 PM IST (14:30 UTC).
// Finds users with an active streak who haven't logged a study session today.

let lastStreakReminderDate = "";

async function checkStreakReminder() {
  const now = new Date();
  // 8 PM IST = 14:30 UTC
  if (now.getUTCHours() < 14 || (now.getUTCHours() === 14 && now.getUTCMinutes() < 30)) return;

  const todayStr = now.toISOString().split("T")[0];
  if (lastStreakReminderDate === todayStr) return; // already ran today
  lastStreakReminderDate = todayStr;

  try {
    const todayStart = new Date(`${todayStr}T00:00:00.000Z`);

    // Users with streak > 0
    const streakUsers = await db
      .select({ id: usersTable.id, streakDays: usersTable.streakDays })
      .from(usersTable)
      .where(gt(usersTable.streakDays, 0));

    if (streakUsers.length === 0) return;

    // Users who already studied today
    const studiedTodayRows = await db
      .selectDistinct({ userId: studySessionsTable.userId })
      .from(studySessionsTable)
      .where(gte(studySessionsTable.startedAt, todayStart));

    const studiedToday = new Set(studiedTodayRows.map(r => r.userId));

    const toRemind = streakUsers.filter(u => !studiedToday.has(u.id));

    await Promise.all(
      toRemind.map(u =>
        createNotification(
          u.id,
          "system",
          "Don't break your streak!",
          `You have a ${u.streakDays}-day streak — study something today to keep it alive.`,
          "/dashboard"
        )
      )
    );

    logger.info({ reminded: toRemind.length }, "Streak reminders sent");
  } catch (err) {
    logger.error({ err }, "Failed to send streak reminders");
  }
}

// ─── Start ────────────────────────────────────────────────────────────────────

export function startScheduler() {
  // Run once at startup, then every 60 seconds
  checkExamsGoLive();
  setInterval(checkExamsGoLive, 60_000);

  // Streak reminder: check every 10 minutes (the gate logic prevents double-firing)
  setInterval(checkStreakReminder, 10 * 60_000);
  checkStreakReminder();
}
