-- Catch-up migration: brings the production DB in line with the Drizzle TS schema.
-- Several feature commits added columns and tables but never wrote a SQL migration,
-- so a deployed Postgres can be behind. Everything below uses IF NOT EXISTS so this
-- file is idempotent and safe to re-run.
--
-- Triggered by: admin "Add Question" returning 500 because questions.solution_video_url
-- (added in 498582d, no migration) does not exist on the deployed DB.

-- ───── exams ─────────────────────────────────────────────────────────────────
ALTER TABLE exams ADD COLUMN IF NOT EXISTS shuffle_questions boolean NOT NULL DEFAULT false;
ALTER TABLE exams ADD COLUMN IF NOT EXISTS has_calculator    boolean NOT NULL DEFAULT false;

-- ───── exam_sections ────────────────────────────────────────────────────────
-- Added in 20c1562 (feat: sections + sectional timers), no migration written.
CREATE TABLE IF NOT EXISTS exam_sections (
  id                  text    PRIMARY KEY,
  exam_id             text    NOT NULL REFERENCES exams(id),
  name                text    NOT NULL,
  display_order       integer NOT NULL DEFAULT 0,
  time_limit_minutes  integer
);
CREATE INDEX IF NOT EXISTS idx_exam_sections_exam ON exam_sections(exam_id);

-- ───── questions ────────────────────────────────────────────────────────────
-- Spread across a8379fe (image_url), 20c1562 (section_id), 8e0a32d (subject/subtopic/source),
-- 498582d (solution URLs), 871c80e (display_order). None had migrations.
ALTER TABLE questions ADD COLUMN IF NOT EXISTS image_url            text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS section_id           text REFERENCES exam_sections(id);
ALTER TABLE questions ADD COLUMN IF NOT EXISTS subject              text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS subtopic             text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS source               text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS solution_video_url   text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS solution_article_url text;
ALTER TABLE questions ADD COLUMN IF NOT EXISTS display_order        integer NOT NULL DEFAULT 0;

-- ───── doubts ───────────────────────────────────────────────────────────────
-- 8e6f792 added doubt ↔ question linking without a migration.
ALTER TABLE doubts ADD COLUMN IF NOT EXISTS question_id text;
ALTER TABLE doubts ADD COLUMN IF NOT EXISTS exam_id     text;
CREATE INDEX IF NOT EXISTS idx_doubts_question ON doubts(question_id);

-- ───── doubt_answer_upvotes ─────────────────────────────────────────────────
-- Created in code as part of the doubts Q&A flow, never had a SQL migration.
CREATE TABLE IF NOT EXISTS doubt_answer_upvotes (
  user_id    text      NOT NULL REFERENCES users(id),
  answer_id  text      NOT NULL REFERENCES doubt_answers(id),
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (user_id, answer_id)
);

-- ───── question_bookmarks ───────────────────────────────────────────────────
-- 81e545c (feat: real analytics + question bookmarks), no migration.
CREATE TABLE IF NOT EXISTS question_bookmarks (
  user_id     text      NOT NULL REFERENCES users(id),
  question_id text      NOT NULL REFERENCES questions(id),
  created_at  timestamp NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, question_id)
);

-- ───── flashcard_decks + flashcards ─────────────────────────────────────────
-- df40857 (feat: Flashcards SM-2, Saved Questions, Exam Calendar), no migration.
CREATE TABLE IF NOT EXISTS flashcard_decks (
  id         text      PRIMARY KEY,
  user_id    text      NOT NULL REFERENCES users(id),
  name       text      NOT NULL,
  subject    text,
  color      text      NOT NULL DEFAULT '#6366f1',
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_flashcard_decks_user ON flashcard_decks(user_id);

CREATE TABLE IF NOT EXISTS flashcards (
  id                text      PRIMARY KEY,
  deck_id           text      NOT NULL REFERENCES flashcard_decks(id) ON DELETE CASCADE,
  user_id           text      NOT NULL REFERENCES users(id),
  front             text      NOT NULL,
  back              text      NOT NULL,
  ease_factor       real      NOT NULL DEFAULT 2.5,
  interval          integer   NOT NULL DEFAULT 0,
  repetitions       integer   NOT NULL DEFAULT 0,
  due_date          timestamp NOT NULL DEFAULT now(),
  last_reviewed_at  timestamp
);
CREATE INDEX IF NOT EXISTS idx_flashcards_deck ON flashcards(deck_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_user_due ON flashcards(user_id, due_date);

-- ───── notifications ────────────────────────────────────────────────────────
-- 871c80e introduced the schema file alongside dashboard work, no migration.
CREATE TABLE IF NOT EXISTS notifications (
  id         text      PRIMARY KEY,
  user_id    text      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       text      NOT NULL,
  title      text      NOT NULL,
  body       text      NOT NULL,
  link       text,
  read       boolean   NOT NULL DEFAULT false,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user_created ON notifications(user_id, created_at DESC);

-- ───── users (cosmetic / rank columns added piecemeal) ──────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_aura_id      text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS active_avatar_id    text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS monthly_rank_title  text;
ALTER TABLE users ADD COLUMN IF NOT EXISTS weekly_rank_title   text;
