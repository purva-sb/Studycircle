import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";

export const stickyNotesTable = pgTable("sticky_notes", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  color: text("color").notNull().default("yellow"),
  pinned: text("pinned").notNull().default("false"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertStickyNoteSchema = createInsertSchema(stickyNotesTable);
export type InsertStickyNote = z.infer<typeof insertStickyNoteSchema>;
export type StickyNote = typeof stickyNotesTable.$inferSelect;
