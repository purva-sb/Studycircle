import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";

export const userAimTable = pgTable("user_aim", {
  userId: text("user_id").primaryKey().references(() => usersTable.id, { onDelete: "cascade" }),
  examName: text("exam_name").notNull(),
  examDate: text("exam_date").notNull(),
  targetScore: text("target_score"),
  personalNote: text("personal_note"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserAimSchema = createInsertSchema(userAimTable);
export type InsertUserAim = z.infer<typeof insertUserAimSchema>;
export type UserAim = typeof userAimTable.$inferSelect;
