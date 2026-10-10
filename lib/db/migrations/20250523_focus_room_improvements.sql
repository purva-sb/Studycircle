-- Focus room: persisted chat lock + run after deploy
ALTER TABLE focus_rooms
  ADD COLUMN IF NOT EXISTS is_chat_enabled boolean NOT NULL DEFAULT true;
