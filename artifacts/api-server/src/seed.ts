import { db } from "@workspace/db";
import { usersTable, goalsTable, studySessionsTable } from "@workspace/db";
import { store } from "./lib/store";
import * as dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

// Load env from root
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, "../../../.env") });

async function main() {
  console.log("Seeding database...");

  if (!db) {
    console.error("Database connection not established. Check your .env file.");
    process.exit(1);
  }

  try {
    // 1. Seed User
    const me = store.getMe();
    await db.insert(usersTable).values({
      id: me.id,
      displayName: me.displayName,
      handle: me.handle,
      avatarUrl: me.avatarUrl,
      level: me.level,
      xp: me.xp,
      xpForNextLevel: me.xpForNextLevel,
      streakDays: me.streakDays,
      examFocus: me.examFocus,
      plan: me.plan,
      dailyTargetMinutes: me.dailyTargetMinutes,
    }).onConflictDoNothing();
    console.log("Seeded user.");

    // 2. Seed Goals
    const goals = store.listGoals();
    for (const g of goals) {
      await db.insert(goalsTable).values({
        id: g.id,
        userId: me.id,
        title: g.title,
        completed: g.completed,
        xp: g.xp,
        createdAt: g.createdAt,
      }).onConflictDoNothing();
    }
    console.log(`Seeded ${goals.length} goals.`);

    // 3. Seed Study Sessions
    const sessions = store.listStudySessions();
    for (const s of sessions) {
      await db.insert(studySessionsTable).values({
        id: s.id,
        userId: me.id,
        subjectId: s.subjectId,
        mode: s.mode,
        durationMinutes: s.durationMinutes,
        note: s.note,
        startedAt: s.startedAt,
      }).onConflictDoNothing();
    }
    console.log(`Seeded ${sessions.length} study sessions.`);

    console.log("Seeding complete! You can safely delete this script later.");
    process.exit(0);
  } catch (error) {
    console.error("Error seeding database:", error);
    process.exit(1);
  }
}

main();
