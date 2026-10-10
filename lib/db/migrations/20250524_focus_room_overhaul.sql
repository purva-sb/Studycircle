-- Focus room overhaul: persist chat lock, linked circle, participant status & task
ALTER TABLE focus_rooms
  ADD COLUMN IF NOT EXISTS is_chat_enabled boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS linked_circle_id text;

ALTER TABLE focus_room_participants
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'idle',
  ADD COLUMN IF NOT EXISTS current_task text,
  ADD COLUMN IF NOT EXISTS is_task_private boolean NOT NULL DEFAULT false;
