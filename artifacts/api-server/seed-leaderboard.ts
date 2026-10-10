import { db } from "../../lib/db/src";
import { usersTable, studySessionsTable } from "../../lib/db/src/schema";
import crypto from "crypto";

async function seed() {
  console.log("Seeding leaderboard data...");

  const fakeUsers = [
    { name: "Alex R.", mins: 705, level: 95 }, // 11h 45m
    { name: "Sam K.", mins: 615, level: 85 },  // 10h 15m
    { name: "Maria G.", mins: 570, level: 75 }, // 9h 30m
    { name: "David L.", mins: 535, level: 93 }, // 8h 55m
    { name: "Emma W.", mins: 490, level: 80 },  // 8h 10m
    { name: "Goro J.", mins: 465, level: 30 },  // 7h 45m
    { name: "Linna P.", mins: 420, level: 30 },  // 7h 00m
    { name: "Sophie M.", mins: 360, level: 20 }, // 6h 00m
  ];

  for (const fake of fakeUsers) {
    const userId = `fake_${crypto.randomUUID()}`;
    
    // Create user
    await db.insert(usersTable).values({
      id: userId,
      handle: fake.name.replace(" ", "").toLowerCase(),
      displayName: fake.name,
      avatarUrl: `https://api.dicebear.com/7.x/avataaars/svg?seed=${fake.name}`,
      level: fake.level,
      examFocus: "jee",
    });

    // Create study session
    await db.insert(studySessionsTable).values({
      id: `sess_${crypto.randomUUID()}`,
      userId,
      subjectId: "dummy_subject",
      mode: "stopwatch",
      durationMinutes: fake.mins,
      startedAt: new Date(),
    });
    
    console.log(`Inserted ${fake.name} with ${fake.mins} mins`);
  }

  console.log("Done!");
}

seed().catch(console.error);
