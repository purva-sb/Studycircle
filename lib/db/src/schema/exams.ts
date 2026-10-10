import { pgTable, text, integer, boolean, timestamp, real, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";

export const examsTable = pgTable("exams", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  exam: text("exam").notNull(), // e.g., "GATE", "JEE"
  kind: text("kind").notNull(), // "practice" | "timed" | "full-mock" | "scheduled" | "contest" | "pyq"
  durationMinutes: integer("duration_minutes").notNull(),
  totalQuestions: integer("total_questions").notNull(),
  totalMarks: real("total_marks").notNull(),
  attemptCount: integer("attempt_count").notNull().default(0),
  difficulty: text("difficulty").notNull(), // "easy" | "medium" | "hard"
  isLive: boolean("is_live").notNull().default(false),
  scheduledAt: timestamp("scheduled_at"),
  description: text("description").notNull(),
  instructionsJson: jsonb("instructions_json").notNull().default('[]'),
  topicsJson: jsonb("topics_json").notNull().default('[]'),
  negativeMarking: real("negative_marking").notNull(),
  marksPerQuestion: real("marks_per_question").notNull(),
  hasCalculator: boolean("has_calculator").notNull().default(false),
  shuffleQuestions: boolean("shuffle_questions").notNull().default(false),
  inviteCode: text("invite_code").unique(), // short share code for direct exam links
});

export const examSectionsTable = pgTable("exam_sections", {
  id: text("id").primaryKey(),
  examId: text("exam_id").notNull().references(() => examsTable.id),
  name: text("name").notNull(),
  displayOrder: integer("display_order").notNull().default(0),
  timeLimitMinutes: integer("time_limit_minutes"), // null = no sectional timer
});

export const questionsTable = pgTable("questions", {
  id: text("id").primaryKey(),
  examId: text("exam_id").notNull().references(() => examsTable.id),
  sectionId: text("section_id").references(() => examSectionsTable.id),
  kind: text("kind").notNull(), // "mcq" | "msq" | "nat"
  body: text("body").notNull(),
  imageUrl: text("image_url"),  // optional diagram/figure from Cloudinary
  natAnswer: real("nat_answer"),
  marks: real("marks").notNull(),
  negativeMarks: real("negative_marks").notNull(),
  topic: text("topic").notNull(),
  subject: text("subject"),     // e.g. "Mathematics" — Phase 1 analytics foundation
  subtopic: text("subtopic"),   // e.g. "Integration by parts"
  source: text("source"),       // e.g. "GATE 2024", "NCERT Ch 5"
  explanation: text("explanation"), // shown after submit in solution mode
  optionsJson: jsonb("options_json").notNull().default('[]'), // array of { id, body }
  correctOptionIdsJson: jsonb("correct_option_ids_json").notNull().default('[]'), // array of ids
  solutionVideoUrl: text("solution_video_url"),     // YouTube link (youtube.com / youtu.be)
  solutionArticleUrl: text("solution_article_url"), // any https article URL
  displayOrder: integer("display_order").notNull().default(0),
});

export const examAttemptsTable = pgTable("exam_attempts", {
  id: text("id").primaryKey(),
  examId: text("exam_id").notNull().references(() => examsTable.id),
  userId: text("user_id").notNull().references(() => usersTable.id),
  status: text("status").notNull(), // "in-progress" | "submitted"
  startedAt: timestamp("started_at").notNull().defaultNow(),
  submittedAt: timestamp("submitted_at"),
  durationMinutes: integer("duration_minutes").notNull(),
  score: real("score"),
});

export const userAnswersTable = pgTable("user_answers", {
  id: text("id").primaryKey(),
  attemptId: text("attempt_id").notNull().references(() => examAttemptsTable.id),
  questionId: text("question_id").notNull().references(() => questionsTable.id),
  selectedOptionIdsJson: jsonb("selected_option_ids_json").notNull().default('[]'),
  natValue: real("nat_value"),
  status: text("status").notNull(), // "unanswered" | "answered" | "marked" | "answered-marked"
  timeSpentSeconds: integer("time_spent_seconds"),
});

export const insertExamSchema = createInsertSchema(examsTable);
export type InsertExam = z.infer<typeof insertExamSchema>;
export type Exam = typeof examsTable.$inferSelect;
