-- Add per-question time tracking to user_answers
ALTER TABLE user_answers ADD COLUMN IF NOT EXISTS time_spent_seconds integer;
