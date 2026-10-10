import { pgTable, text, boolean, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";

export const circlesTable = pgTable("circles", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  description: text("description").notNull(),
  exam: text("exam").notNull(),
  isPrivate: boolean("is_private").notNull().default(false),
  coverColor: text("cover_color").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const circleMembersTable = pgTable("circle_members", {
  circleId: text("circle_id").notNull().references(() => circlesTable.id),
  userId: text("user_id").notNull().references(() => usersTable.id),
  role: text("role").notNull().default("member"), // "owner" | "mod" | "member"
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
});

export const circleInvitesTable = pgTable("circle_invites", {
  id: text("id").primaryKey(),
  circleId: text("circle_id").notNull().references(() => circlesTable.id),
  code: text("code").notNull().unique(),
  createdBy: text("created_by").notNull().references(() => usersTable.id),
  expiresAt: timestamp("expires_at"), // null = never expires
  maxUses: integer("max_uses"), // null = unlimited
  uses: integer("uses").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCircleSchema = createInsertSchema(circlesTable);
export type InsertCircle = z.infer<typeof insertCircleSchema>;
export type Circle = typeof circlesTable.$inferSelect;

export const insertCircleMemberSchema = createInsertSchema(circleMembersTable);
export type InsertCircleMember = z.infer<typeof insertCircleMemberSchema>;
export type CircleMember = typeof circleMembersTable.$inferSelect;

export const insertCircleInviteSchema = createInsertSchema(circleInvitesTable);
export type InsertCircleInvite = z.infer<typeof insertCircleInviteSchema>;
export type CircleInvite = typeof circleInvitesTable.$inferSelect;
