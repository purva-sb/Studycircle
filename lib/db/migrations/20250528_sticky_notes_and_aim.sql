-- sticky notes per user
CREATE TABLE IF NOT EXISTS sticky_notes (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT 'yellow',
  pinned      TEXT NOT NULL DEFAULT 'false',
  created_at  TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMP NOT NULL DEFAULT NOW()
);

-- one aim per user (upsert on change)
CREATE TABLE IF NOT EXISTS user_aim (
  user_id       TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  exam_name     TEXT NOT NULL,
  exam_date     TEXT NOT NULL,
  target_score  TEXT,
  personal_note TEXT,
  updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
