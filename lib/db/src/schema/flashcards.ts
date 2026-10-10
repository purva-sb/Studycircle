import { pgTable, text, integer, real, timestamp } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const flashcardDecksTable = pgTable("flashcard_decks", {
  id:        text("id").primaryKey(),
  userId:    text("user_id").notNull().references(() => usersTable.id),
  name:      text("name").notNull(),
  subject:   text("subject"),
  color:     text("color").notNull().default("#6366f1"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const flashcardsTable = pgTable("flashcards", {
  id:             text("id").primaryKey(),
  deckId:         text("deck_id").notNull().references(() => flashcardDecksTable.id, { onDelete: "cascade" }),
  userId:         text("user_id").notNull().references(() => usersTable.id),
  front:          text("front").notNull(),
  back:           text("back").notNull(),
  easeFactor:     real("ease_factor").notNull().default(2.5),
  interval:       integer("interval").notNull().default(0),
  repetitions:    integer("repetitions").notNull().default(0),
  dueDate:        timestamp("due_date").notNull().defaultNow(),
  lastReviewedAt: timestamp("last_reviewed_at"),
});
