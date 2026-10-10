import { Router } from "express";
import { requireAuth } from "../middleware/auth";
import { db } from "@workspace/db";
import { subjectsTable } from "@workspace/db/schema";
import { z } from "zod";
import crypto from "crypto";

const router = Router();

const createSubjectSchema = z.object({
  name: z.string().min(1).max(100),
  color: z.string().min(1).max(30),
});

// Get all subjects
router.get("/", requireAuth, async (req, res) => {
  try {
    const subjects = await db.select().from(subjectsTable);
    res.json(subjects);
  } catch (err) {
    console.error("Error fetching subjects:", err);
    res.status(500).json({ error: "Failed to fetch subjects" });
  }
});

// Create a new subject
router.post("/", requireAuth, async (req, res) => {
  try {
    const parsed = createSubjectSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }
    const { name, color } = parsed.data;

    const [newSubject] = await db
      .insert(subjectsTable)
      .values({
        id: `subj_${crypto.randomUUID().replace(/-/g, "")}`,
        name,
        color,
      })
      .returning();

    res.status(201).json(newSubject);
  } catch (err) {
    console.error("Error creating subject:", err);
    res.status(500).json({ error: "Failed to create subject" });
  }
});

export const subjectsRouter = router;
