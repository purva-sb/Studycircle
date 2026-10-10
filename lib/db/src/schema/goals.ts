import { pgTable, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";

export const goalsTable = pgTable("goals", {
  id: text("id").primaryKey(), // using text to support UUIDs
  userId: text("user_id").notNull().references(() => usersTable.id),
  title: text("title").notNull(),
  completed: boolean("completed").notNull().default(false),
  xp: integer("xp").notNull().default(50),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGoalSchema = createInsertSchema(goalsTable);
export type InsertGoal = z.infer<typeof insertGoalSchema>;
export type Goal = typeof goalsTable.$inferSelect;
