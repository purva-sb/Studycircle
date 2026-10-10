import { pgTable, text, integer, varchar, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(), // using text for UUID or Clerk ID
  displayName: text("display_name").notNull(),
  handle: varchar("handle", { length: 255 }).notNull().unique(),
  avatarUrl: text("avatar_url"),
  level: integer("level").notNull().default(1),
  xp: integer("xp").notNull().default(0),
  xpForNextLevel: integer("xp_for_next_level").notNull().default(100),
  streakDays: integer("streak_days").notNull().default(0),
  examFocus: text("exam_focus").notNull(),
  plan: text("plan").notNull().default("free"), // "free" | "pro"
  dailyTargetMinutes: integer("daily_target_minutes").notNull().default(120),
  activeAuraId: text("active_aura_id"),
  activeAvatarId: text("active_avatar_id"),
  monthlyRankTitle: text("monthly_rank_title"),
  weeklyRankTitle: text("weekly_rank_title"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable);
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
