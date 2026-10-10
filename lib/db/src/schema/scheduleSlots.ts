import { pgTable, text, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { createInsertSchema, createSelectSchema } from "drizzle-zod";
import { z } from "zod";

import { usersTable } from "./users";
import { subjectsTable } from "./subjects";

export const scheduleSlotsTable = pgTable("schedule_slots", {
  id: text("id").primaryKey(),

  userId: text("user_id")
    .notNull()
    .references(() => usersTable.id, { onDelete: "cascade" }),

  subjectId: text("subject_id")
    .references(() => subjectsTable.id, { onDelete: "cascade" }),

  title: text("title").notNull(),
  type: text("type", { enum: ["study_session", "mock_test", "event"] })
    .notNull()
    .default("study_session"),
  
  // Date and Time fields
  startTime: text("start_time").notNull(), // HH:mm
  endTime: text("end_time").notNull(), // HH:mm
  date: text("date"), // YYYY-MM-DD for one-off slots

  // Recurrence
  isRecurring: boolean("is_recurring").notNull().default(false),
  daysOfWeek: text("days_of_week"), // JSON string of array of numbers [0, 1, 2] where 0=Sun, 1=Mon

  // State
  isCompleted: boolean("is_completed").notNull().default(false),

  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertScheduleSlotSchema = createInsertSchema(scheduleSlotsTable).omit({
  createdAt: true,
  updatedAt: true,
});
export type InsertScheduleSlot = z.infer<typeof insertScheduleSlotSchema>;
export type ScheduleSlot = typeof scheduleSlotsTable.$inferSelect;
