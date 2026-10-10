import { pgTable, text, integer, boolean, timestamp, unique, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";

export const doubtsTable = pgTable("doubts", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  body: text("body").notNull(),
  askedById: text("asked_by_id").notNull().references(() => usersTable.id),
  topic: text("topic").notNull(),
  subject: text("subject"),
  exam: text("exam").notNull(),
  imageUrls: jsonb("image_urls").$type<string[]>().notNull().default([]),
  upvotes: integer("upvotes").notNull().default(0),
  bountyXp: integer("bounty_xp").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  resolved: boolean("resolved").notNull().default(false),
  // Optional link to the mock-test question this doubt is about
  // Powers the "discuss this question" loop on results page and the
  // GATEOverflow-style community Q&A discovery.
  questionId: text("question_id"),
  examId: text("exam_id"),
});

export const doubtAnswersTable = pgTable("doubt_answers", {
  id: text("id").primaryKey(),
  doubtId: text("doubt_id").notNull().references(() => doubtsTable.id),
  authorId: text("author_id").notNull().references(() => usersTable.id),
  body: text("body").notNull(),
  imageUrls: jsonb("image_urls").$type<string[]>().notNull().default([]),
  upvotes: integer("upvotes").notNull().default(0),
  accepted: boolean("accepted").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const doubtAnswerUpvotesTable = pgTable("doubt_answer_upvotes", {
  userId: text("user_id").notNull().references(() => usersTable.id),
  answerId: text("answer_id").notNull().references(() => doubtAnswersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [unique().on(t.userId, t.answerId)]);

// Question-level upvote tracking — one vote per user per doubt.
export const doubtUpvotesTable = pgTable("doubt_upvotes", {
  userId: text("user_id").notNull().references(() => usersTable.id),
  doubtId: text("doubt_id").notNull().references(() => doubtsTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [unique().on(t.userId, t.doubtId)]);

// Comments threaded under each answer — StackOverflow-style clarifications.
export const doubtAnswerCommentsTable = pgTable("doubt_answer_comments", {
  id: text("id").primaryKey(),
  answerId: text("answer_id").notNull().references(() => doubtAnswersTable.id),
  authorId: text("author_id").notNull().references(() => usersTable.id),
  body: text("body").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertDoubtSchema = createInsertSchema(doubtsTable);
export type InsertDoubt = z.infer<typeof insertDoubtSchema>;
export type Doubt = typeof doubtsTable.$inferSelect;

export const insertDoubtAnswerSchema = createInsertSchema(doubtAnswersTable);
export type InsertDoubtAnswer = z.infer<typeof insertDoubtAnswerSchema>;
export type DoubtAnswer = typeof doubtAnswersTable.$inferSelect;
