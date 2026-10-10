import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { usersTable } from "./users";
import { questionsTable } from "./exams";

export const questionBookmarksTable = pgTable("question_bookmarks", {
  userId:     text("user_id").notNull().references(() => usersTable.id),
  questionId: text("question_id").notNull().references(() => questionsTable.id),
  createdAt:  timestamp("created_at").notNull().defaultNow(),
}, (t) => ({
  pk: primaryKey({ columns: [t.userId, t.questionId] }),
}));
