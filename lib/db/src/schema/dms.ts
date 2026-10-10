import { pgTable, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";

// Represents a DM conversation between two users
export const dmConversationsTable = pgTable("dm_conversations", {
  id: text("id").primaryKey(),
  user1Id: text("user1_id").notNull().references(() => usersTable.id),
  user2Id: text("user2_id").notNull().references(() => usersTable.id),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// Represents individual messages in a DM conversation
export const directMessagesTable = pgTable("direct_messages", {
  id: text("id").primaryKey(),
  conversationId: text("conversation_id").notNull().references(() => dmConversationsTable.id),
  authorId: text("author_id").notNull().references(() => usersTable.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at"),
});

export const insertDmConversationSchema = createInsertSchema(dmConversationsTable);
export type InsertDmConversation = z.infer<typeof insertDmConversationSchema>;
export type DmConversation = typeof dmConversationsTable.$inferSelect;

export const insertDirectMessageSchema = createInsertSchema(directMessagesTable);
export type InsertDirectMessage = z.infer<typeof insertDirectMessageSchema>;
export type DirectMessage = typeof directMessagesTable.$inferSelect;
