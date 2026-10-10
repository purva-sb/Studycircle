import { db } from "@workspace/db";
import { circlesTable, circleMembersTable, usersTable, channelsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";
import { GetCircleResponse } from "@workspace/api-zod";

async function run() {
  const circleId = "36807b9a-6c75-4526-85c6-1264c949338f";
  
  const allCircles = await db.select().from(circlesTable);
  const circle = allCircles.find(c => c.id === circleId);
  if (!circle) throw new Error("No circle");
  
  const memberRows = await db.select({
    circleId: circleMembersTable.circleId,
    role: circleMembersTable.role,
    joinedAt: circleMembersTable.joinedAt,
    userId: usersTable.id,
    displayName: usersTable.displayName,
    handle: usersTable.handle,
    avatarUrl: usersTable.avatarUrl,
    level: usersTable.level,
  })
  .from(circleMembersTable)
  .leftJoin(usersTable, eq(circleMembersTable.userId, usersTable.id))
  .where(eq(circleMembersTable.circleId, circleId));
  
  const members = memberRows.map(m => ({
    userId: m.userId || "",
    displayName: m.displayName || "Unknown User",
    handle: m.handle || m.displayName?.replace(/\s+/g, "").toLowerCase() || "unknown",
    avatarUrl: m.avatarUrl || "",
    level: m.level || 1,
    role: m.role as "owner" | "mod" | "member",
    online: false,
  }));
  
  const chans = await db.select().from(channelsTable).where(eq(channelsTable.circleId, circleId));
  const formattedChannels = chans.map(c => ({ ...c, unread: 0 }));
  
  try {
    GetCircleResponse.parse({
      ...circle,
      memberCount: members.length,
      joined: true,
      onlineCount: 1,
      members,
      channels: formattedChannels,
    });
    console.log("Success");
  } catch (err: any) {
    console.error("ZOD ERROR:", err.errors);
  }
}

run().catch(console.error).then(() => process.exit(0));
