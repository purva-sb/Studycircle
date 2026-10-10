import { pgTable, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { circlesTable } from "./circles";
import { usersTable } from "./users";

export const channelsTable = pgTable("channels", {
  id: text("id").primaryKey(),
  circleId: text("circle_id").notNull().references(() => circlesTable.id),
  name: text("name").notNull(),
  kind: text("kind").notNull(), // "general" | "doubts" | "resources" | "announcements" | "mock-tests" | "off-topic"
  description: text("description").notNull(),
});

export const messagesTable = pgTable("messages", {
  id: text("id").primaryKey(),
  channelId: text("channel_id").notNull().references(() => channelsTable.id),
  authorId: text("author_id").notNull().references(() => usersTable.id),
  replyToId: text("reply_to_id"), // Optional self-reference for replies
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
  pinned: boolean("pinned").notNull().default(false),
});

export const messageReactionsTable = pgTable("message_reactions", {
  id: text("id").primaryKey(),
  messageId: text("message_id").notNull().references(() => messagesTable.id),
  authorId: text("author_id").notNull().references(() => usersTable.id),
  emoji: text("emoji").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertChannelSchema = createInsertSchema(channelsTable);
export type InsertChannel = z.infer<typeof insertChannelSchema>;
export type Channel = typeof channelsTable.$inferSelect;

export const insertMessageSchema = createInsertSchema(messagesTable);
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messagesTable.$inferSelect;
