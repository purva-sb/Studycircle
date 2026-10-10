-- Shareable invite code for direct exam links (e.g. /e/abc12345)
ALTER TABLE exams ADD COLUMN IF NOT EXISTS invite_code text UNIQUE;
