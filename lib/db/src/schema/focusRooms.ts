import { pgTable, text, boolean, timestamp, integer, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";

/** Stores focus rooms persistently in Postgres so they survive server restarts & deployments. */
export const focusRoomsTable = pgTable("focus_rooms", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  hostId: text("host_id").notNull().references(() => usersTable.id),
  hostName: text("host_name").notNull(),
  hostAvatar: text("host_avatar").notNull().default(""),
  mode: text("mode").notNull().default("silent"), // "silent" | "voice" | "video"
  maxParticipants: integer("max_participants").notNull().default(10),
  isPrivate: boolean("is_private").notNull().default(false),
  exam: text("exam").notNull().default(""),
  accentColor: text("accent_color").notNull().default("#7C3AED"),
  isLive: boolean("is_live").notNull().default(true),
  isChatEnabled: boolean("is_chat_enabled").notNull().default(true),
  linkedCircleId: text("linked_circle_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  lastActivityAt: timestamp("last_activity_at").notNull().defaultNow(),
});

/** Tracks which users have joined a focus room (persisted membership). */
export const focusRoomParticipantsTable = pgTable("focus_room_participants", {
  roomId: text("room_id").notNull().references(() => focusRoomsTable.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => usersTable.id),
  displayName: text("display_name").notNull(),
  avatarUrl: text("avatar_url").notNull().default(""),
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  totalStudySeconds: integer("total_study_seconds").notNull().default(0),
  status: text("status").notNull().default("idle"),
  currentTask: text("current_task"),
  isTaskPrivate: boolean("is_task_private").notNull().default(false),
}, (t) => [uniqueIndex("fr_participant_unique").on(t.roomId, t.userId)]);

export const insertFocusRoomSchema = createInsertSchema(focusRoomsTable);
export type InsertFocusRoom = z.infer<typeof insertFocusRoomSchema>;
export type FocusRoomRow = typeof focusRoomsTable.$inferSelect;

export const insertFocusRoomParticipantSchema = createInsertSchema(focusRoomParticipantsTable);
export type InsertFocusRoomParticipant = z.infer<typeof insertFocusRoomParticipantSchema>;
export type FocusRoomParticipantRow = typeof focusRoomParticipantsTable.$inferSelect;
