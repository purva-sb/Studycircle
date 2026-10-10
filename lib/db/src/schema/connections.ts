import { pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { usersTable } from "./users";

export const connectionsTable = pgTable("connections", {
  id: text("id").primaryKey(), // We'll use a UUID
  requesterId: text("requester_id").notNull().references(() => usersTable.id),
  recipientId: text("recipient_id").notNull().references(() => usersTable.id),
  status: varchar("status", { length: 50 }).notNull().default("pending"), // "pending", "accepted", "rejected"
  context: text("context"), // e.g., "From Focus Room: Gate Cracker"
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertConnectionSchema = createInsertSchema(connectionsTable);
export type InsertConnection = z.infer<typeof insertConnectionSchema>;
export type Connection = typeof connectionsTable.$inferSelect;
