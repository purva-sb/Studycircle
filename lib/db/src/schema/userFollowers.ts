import { pgTable, text, primaryKey } from "drizzle-orm/pg-core";

export const userFollowersTable = pgTable(
  "user_followers",
  {
    followerId: text("follower_id").notNull(),
    followingId: text("following_id").notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.followerId, t.followingId] }),
  }),
);
