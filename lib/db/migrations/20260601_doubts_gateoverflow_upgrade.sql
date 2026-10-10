-- GateOverflow-style upgrade for Doubts: images, subject, question voting, answer comments.

-- doubts: subject tag, image attachments, question-level upvote count
ALTER TABLE doubts ADD COLUMN IF NOT EXISTS subject text;
ALTER TABLE doubts ADD COLUMN IF NOT EXISTS image_urls jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE doubts ADD COLUMN IF NOT EXISTS upvotes integer NOT NULL DEFAULT 0;

-- doubt_answers: image attachments
ALTER TABLE doubt_answers ADD COLUMN IF NOT EXISTS image_urls jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Question-level upvote tracking — one vote per (user, doubt)
CREATE TABLE IF NOT EXISTS doubt_upvotes (
  user_id    text      NOT NULL REFERENCES users(id),
  doubt_id   text      NOT NULL REFERENCES doubts(id),
  created_at timestamp NOT NULL DEFAULT now(),
  UNIQUE (user_id, doubt_id)
);

-- StackOverflow-style comments under answers
CREATE TABLE IF NOT EXISTS doubt_answer_comments (
  id         text      PRIMARY KEY,
  answer_id  text      NOT NULL REFERENCES doubt_answers(id),
  author_id  text      NOT NULL REFERENCES users(id),
  body       text      NOT NULL,
  created_at timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_doubt_answer_comments_answer ON doubt_answer_comments(answer_id);
