import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";

export const studySessionsTable = pgTable("study_sessions", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id),
  subjectId: text("subject_id").notNull(),
  mode: text("mode").notNull(), // "pomodoro" | "stopwatch"
  durationMinutes: integer("duration_minutes").notNull(),
  note: text("note"),
  startedAt: timestamp("started_at").notNull().defaultNow(),
});

export const insertStudySessionSchema = createInsertSchema(studySessionsTable);
export type InsertStudySession = z.infer<typeof insertStudySessionSchema>;
export type StudySession = typeof studySessionsTable.$inferSelect;
