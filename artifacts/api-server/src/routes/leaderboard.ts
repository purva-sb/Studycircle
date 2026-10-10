import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { usersTable, studySessionsTable, focusRoomParticipantsTable, circleMembersTable } from "@workspace/db/schema";
import { eq, desc, sql, gte, and } from "drizzle-orm";
import { requireAuth, getAuthUserId } from "../middleware/auth";
import { isCircleMember } from "../lib/access";
import { isFocusRoomMember } from "../lib/focus-room";
import { z } from "zod";

const router = Router();

// Zod schemas for validation
const leaderboardQuerySchema = z.object({
  timeframe: z.enum(["daily", "weekly", "monthly", "all-time"]),
  type: z.enum(["global", "circle", "room"]),
  filterId: z.string().optional(),
});

router.get("/leaderboard", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req);
    const parsed = leaderboardQuerySchema.safeParse(req.query);
    
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid query parameters" });
      return;
    }

    const { timeframe, type, filterId } = parsed.data;

    // Get the current user to know their exam focus if global
    const [currentUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId)).limit(1);
    
    if (!currentUser) {
      res.status(404).json({ message: "User not found" });
      return;
    }

    // Determine the time cutoff
    const now = new Date();
    let cutoffDate = new Date();
    let isAllTime = false;
    
    if (timeframe === "daily") {
      cutoffDate.setHours(0, 0, 0, 0);
    } else if (timeframe === "weekly") {
      const day = cutoffDate.getDay() || 7; 
      cutoffDate.setHours(0, 0, 0, 0);
      cutoffDate.setDate(cutoffDate.getDate() - day + 1); // Monday
    } else if (timeframe === "monthly") {
      cutoffDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else if (timeframe === "all-time") {
      isAllTime = true;
      cutoffDate = new Date(0); // Epoch
    }

    // Determine today cutoff for todayMinutes
    const todayCutoff = new Date();
    todayCutoff.setHours(0, 0, 0, 0);

    // Build the query
    let baseQuery = db
      .select({
        userId: usersTable.id,
        displayName: usersTable.displayName,
        avatarUrl: usersTable.avatarUrl,
        activeAuraId: usersTable.activeAuraId,
        activeAvatarId: usersTable.activeAvatarId,
        monthlyRankTitle: usersTable.monthlyRankTitle,
        weeklyRankTitle: usersTable.weeklyRankTitle,
        examFocus: usersTable.examFocus,
        level: usersTable.level,
        totalMinutes: sql<number>`cast(sum(CASE WHEN ${studySessionsTable.startedAt} >= ${cutoffDate.toISOString()} THEN ${studySessionsTable.durationMinutes} ELSE 0 END) as integer)`,
        todayMinutes: sql<number>`cast(sum(CASE WHEN ${studySessionsTable.startedAt} >= ${todayCutoff.toISOString()} THEN ${studySessionsTable.durationMinutes} ELSE 0 END) as integer)`,
      })
      .from(usersTable)
      .innerJoin(studySessionsTable, eq(usersTable.id, studySessionsTable.userId));

    const conditions = [];

    // Global = all users, no exam filter

    // If circle/room type but no filterId provided, return empty array
    if ((type === "room" || type === "circle") && !filterId) {
      return res.json([]);
    }

    if (type === "room" && filterId) {
      if (!(await isFocusRoomMember(filterId, userId))) {
        res.status(403).json({ message: "Not a member of this room" });
        return;
      }
      baseQuery = baseQuery.innerJoin(focusRoomParticipantsTable, eq(usersTable.id, focusRoomParticipantsTable.userId));
      conditions.push(eq(focusRoomParticipantsTable.roomId, filterId));
    }

    if (type === "circle" && filterId) {
      if (!(await isCircleMember(filterId, userId))) {
        res.status(403).json({ message: "Not a member of this circle" });
        return;
      }
      baseQuery = baseQuery.innerJoin(circleMembersTable, eq(usersTable.id, circleMembersTable.userId));
      conditions.push(eq(circleMembersTable.circleId, filterId));
    }

    const results = await baseQuery
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .groupBy(usersTable.id)
      .orderBy(desc(sql`sum(CASE WHEN ${studySessionsTable.startedAt} >= ${cutoffDate.toISOString()} THEN ${studySessionsTable.durationMinutes} ELSE 0 END)`))
      .limit(100);

    // Add rank
    const leaderboard = results.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

    res.json(leaderboard);
  } catch (error) {
    console.error("Error fetching leaderboard:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

// Cron endpoint to reset weekly/monthly — requires CRON_SECRET header, not user auth
router.post("/leaderboard/cron/reset", (req: Request, res: Response) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers["x-cron-secret"] !== secret) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
  res.json({ success: true, message: "Leaderboard titles updated" });
});

// Profile customization endpoint
const customizeProfileSchema = z.object({
  activeAuraId: z.string().nullable().optional(),
  activeAvatarId: z.string().nullable().optional(),
  dailyTargetMinutes: z.number().int().min(15).max(720).optional(),
});

router.post("/users/profile/customize", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req);
    const parsed = customizeProfileSchema.safeParse(req.body);
    
    if (!parsed.success) {
      res.status(400).json({ message: "Invalid payload" });
      return;
    }

    const { activeAuraId, activeAvatarId, dailyTargetMinutes } = parsed.data;

    const [updatedUser] = await db
      .update(usersTable)
      .set({
        ...(activeAuraId !== undefined && { activeAuraId }),
        ...(activeAvatarId !== undefined && { activeAvatarId }),
        ...(dailyTargetMinutes !== undefined && { dailyTargetMinutes }),
      })
      .where(eq(usersTable.id, userId))
      .returning();

    res.json(updatedUser);
  } catch (error) {
    console.error("Error customizing profile:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

router.get("/users/stats/heatmap", requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = getAuthUserId(req);
    
    // Calculate date 365 days ago
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 365);
    cutoffDate.setHours(0, 0, 0, 0);

    const sessions = await db
      .select({
        startedAt: studySessionsTable.startedAt,
        durationMinutes: studySessionsTable.durationMinutes,
      })
      .from(studySessionsTable)
      .where(
        and(
          eq(studySessionsTable.userId, userId),
          gte(studySessionsTable.startedAt, cutoffDate)
        )
      );

    // Aggregate by YYYY-MM-DD
    const heatmapMap = new Map<string, number>();
    for (const session of sessions) {
      if (!session.startedAt) continue;
      const dateStr = new Date(session.startedAt).toISOString().split('T')[0];
      heatmapMap.set(dateStr, (heatmapMap.get(dateStr) || 0) + session.durationMinutes);
    }

    const result = Array.from(heatmapMap.entries()).map(([date, minutes]) => ({
      date,
      minutes
    }));

    res.json(result);
  } catch (error) {
    console.error("Error fetching heatmap:", error);
    res.status(500).json({ message: "Internal server error" });
  }
});

export default router;
