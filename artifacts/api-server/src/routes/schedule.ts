import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { db } from "@workspace/db";
import { scheduleSlotsTable, subjectsTable, insertScheduleSlotSchema } from "@workspace/db/schema";
import { eq, and, asc, sql } from "drizzle-orm";
import { z } from "zod";
import crypto from "crypto";

const router = Router();

const slotFieldsSchema = z.object({
  subjectId: z.string().max(100).nullable().optional(),
  title: z.string().min(1).max(200),
  startTime: z.string().max(10),
  endTime: z.string().max(10),
  date: z.string().max(20).nullable().optional(),
  type: z.enum(["study_session", "mock_test", "event"]).optional(),
  isRecurring: z.boolean().optional(),
  daysOfWeek: z.string().max(100).nullable().optional(),
  isCompleted: z.boolean().optional(),
});
const updateSlotSchema = slotFieldsSchema.partial();

// Get schedule slots for the authenticated user
// Optionally filter by start/end date
router.get(
  "/",
  requireAuth,
  async (req, res) => {
    const { startDate, endDate } = req.query as { startDate?: string; endDate?: string };
    
    // In a real implementation, you'd apply date filters here
    // For now we just return all slots for the user
    const slots = await db
      .select({
        id: scheduleSlotsTable.id,
        userId: scheduleSlotsTable.userId,
        subjectId: scheduleSlotsTable.subjectId,
        title: scheduleSlotsTable.title,
        startTime: scheduleSlotsTable.startTime,
        endTime: scheduleSlotsTable.endTime,
        date: scheduleSlotsTable.date,
        isRecurring: scheduleSlotsTable.isRecurring,
        daysOfWeek: scheduleSlotsTable.daysOfWeek,
        isCompleted: scheduleSlotsTable.isCompleted,
        type: scheduleSlotsTable.type,
        subject: {
          id: subjectsTable.id,
          name: subjectsTable.name,
          color: subjectsTable.color,
        }
      })
      .from(scheduleSlotsTable)
      .leftJoin(subjectsTable, eq(scheduleSlotsTable.subjectId, subjectsTable.id))
      .where(eq(scheduleSlotsTable.userId, req.auth.userId!))
      .orderBy(asc(scheduleSlotsTable.startTime));

    res.json(slots);
  }
);

// Get overdue schedule slots
router.get("/overdue", requireAuth, async (req, res) => {
  const queryDate = req.query.date as string;
  const today = queryDate || new Date().toISOString().split("T")[0]; // YYYY-MM-DD
  
  const overdueSlots = await db
    .select({
      id: scheduleSlotsTable.id,
      userId: scheduleSlotsTable.userId,
      subjectId: scheduleSlotsTable.subjectId,
      title: scheduleSlotsTable.title,
      startTime: scheduleSlotsTable.startTime,
      endTime: scheduleSlotsTable.endTime,
      date: scheduleSlotsTable.date,
      isRecurring: scheduleSlotsTable.isRecurring,
      daysOfWeek: scheduleSlotsTable.daysOfWeek,
      isCompleted: scheduleSlotsTable.isCompleted,
      type: scheduleSlotsTable.type,
      subject: {
        id: subjectsTable.id,
        name: subjectsTable.name,
        color: subjectsTable.color,
      }
    })
    .from(scheduleSlotsTable)
    .leftJoin(subjectsTable, eq(scheduleSlotsTable.subjectId, subjectsTable.id))
    .where(
      and(
        eq(scheduleSlotsTable.userId, req.auth.userId!),
        eq(scheduleSlotsTable.isCompleted, false),
        sql`${scheduleSlotsTable.date} < ${today}`
      )
    )
    .orderBy(asc(scheduleSlotsTable.date), asc(scheduleSlotsTable.startTime));

  res.json(overdueSlots);
});

// Create a new schedule slot
router.post(
  "/",
  requireAuth,
  async (req, res) => {
    const parsed = slotFieldsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }
    const data = parsed.data;

    const [newSlot] = await db
      .insert(scheduleSlotsTable)
      .values({
        id: `sch_${crypto.randomUUID().replace(/-/g, "")}`,
        userId: req.auth.userId!,
        subjectId: data.subjectId || null,
        title: data.title,
        startTime: data.startTime,
        endTime: data.endTime,
        date: data.date,
        type: data.type || "study_session",
      })
      .returning();

    res.status(201).json(newSlot);
  }
);

// Update a schedule slot
router.put(
  "/:id",
  requireAuth,
  async (req, res) => {
    const { id } = req.params;
    const parsed = updateSlotSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }

    const [updatedSlot] = await db
      .update(scheduleSlotsTable)
      .set({ ...parsed.data, updatedAt: new Date() })
      .where(
        and(
          eq(scheduleSlotsTable.id, id),
          eq(scheduleSlotsTable.userId, req.auth.userId!)
        )
      )
      .returning();

    if (!updatedSlot) {
      return res.status(404).json({ error: "Slot not found" });
    }

    res.json(updatedSlot);
  }
);

// Toggle completion status
router.patch("/:id/toggle", requireAuth, async (req, res) => {
  const { id } = req.params;
  const parsed = z.object({ isCompleted: z.boolean() }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }
  const { isCompleted } = parsed.data;

  const [updatedSlot] = await db
    .update(scheduleSlotsTable)
    .set({ isCompleted, updatedAt: new Date() })
    .where(
      and(
        eq(scheduleSlotsTable.id, id),
        eq(scheduleSlotsTable.userId, req.auth.userId!)
      )
    )
    .returning();

  if (!updatedSlot) {
    return res.status(404).json({ error: "Slot not found" });
  }

  res.json(updatedSlot);
});

// Delete a schedule slot
router.delete("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  const [deletedSlot] = await db
    .delete(scheduleSlotsTable)
    .where(
      and(
        eq(scheduleSlotsTable.id, id),
        eq(scheduleSlotsTable.userId, req.auth.userId!)
      )
    )
    .returning();

  if (!deletedSlot) {
    return res.status(404).json({ error: "Slot not found" });
  }

  res.json({ success: true });
});

export const scheduleRouter = router;
