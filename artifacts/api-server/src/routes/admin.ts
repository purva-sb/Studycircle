import { Router } from "express";
import { randomUUID } from "node:crypto";
import { eq, count, desc, gte, sql, and, inArray, ilike } from "drizzle-orm";
import { db } from "@workspace/db";
import { examsTable, questionsTable, examAttemptsTable, usersTable, examSectionsTable, userAnswersTable, questionBookmarksTable } from "@workspace/db/schema";
import { createNotification } from "./studycircle";
import { requireAdmin, getAuthUserId } from "../middleware/auth";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import multer from "multer";

// Lazy Anthropic client — initialized on first use, gracefully degrades if no key
let anthropicClient: Anthropic | null = null;
function getAnthropic(): Anthropic | null {
  if (anthropicClient) return anthropicClient;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return null;
  anthropicClient = new Anthropic({ apiKey: key });
  return anthropicClient;
}

// ─── AI Cost Safety: rate limiting ────────────────────────────────────────────
//
// Defaults are intentionally low so a single deploy can't blow the budget.
// Override via env when you upgrade tiers.
// Single-server in-memory counters — swap to Redis for multi-instance.
const AI_PER_USER_DAILY  = Number(process.env.AI_PER_USER_DAILY  ?? 20);   // calls/admin/day
const AI_GLOBAL_DAILY    = Number(process.env.AI_GLOBAL_DAILY    ?? 200);  // total calls/day
const AI_PER_USER_MINUTE = Number(process.env.AI_PER_USER_MINUTE ?? 5);    // burst cap

// ─── AI Result Cache ─────────────────────────────────────────────────────────
//
// Same question body → cached suggestion → zero API cost on repeat.
// Massive saver: clicking Suggest again on the same question is free.
// Bounded LRU by simple Map iteration order (insertion = oldest first).
const AI_CACHE_MAX = 500;
const AI_CACHE_TTL_MS = 60 * 60_000; // 1 hour
const aiCache = new Map<string, { value: any; expiresAt: number }>();

function cacheKey(kind: string, body: string): string {
  // Cheap deterministic key; body is already length-capped upstream
  return `${kind}:${body.length}:${body.slice(0, 200)}`;
}
function cacheGet(key: string): any | null {
  const e = aiCache.get(key);
  if (!e) return null;
  if (Date.now() > e.expiresAt) { aiCache.delete(key); return null; }
  // refresh LRU position
  aiCache.delete(key); aiCache.set(key, e);
  return e.value;
}
function cacheSet(key: string, value: any) {
  if (aiCache.size >= AI_CACHE_MAX) {
    const oldest = aiCache.keys().next().value;
    if (oldest) aiCache.delete(oldest);
  }
  aiCache.set(key, { value, expiresAt: Date.now() + AI_CACHE_TTL_MS });
}

type Bucket = { count: number; resetAt: number };
const userDay    = new Map<string, Bucket>();
const userMinute = new Map<string, Bucket>();
let globalDay: Bucket = { count: 0, resetAt: Date.now() + 24 * 3600_000 };

function tick(bucket: Bucket, windowMs: number): boolean {
  if (Date.now() > bucket.resetAt) {
    bucket.count = 0;
    bucket.resetAt = Date.now() + windowMs;
  }
  bucket.count += 1;
  return true;
}
function get(map: Map<string, Bucket>, key: string, windowMs: number): Bucket {
  let b = map.get(key);
  if (!b) { b = { count: 0, resetAt: Date.now() + windowMs }; map.set(key, b); }
  if (Date.now() > b.resetAt) { b.count = 0; b.resetAt = Date.now() + windowMs; }
  return b;
}

type RateResult = { ok: true } | { ok: false; status: number; error: string; detail?: string };

function checkAiLimits(userId: string): RateResult {
  // 1) per-user per-minute burst
  const um = get(userMinute, userId, 60_000);
  if (um.count >= AI_PER_USER_MINUTE) {
    return { ok: false, status: 429, error: "AI rate limit (minute)",
      detail: `Max ${AI_PER_USER_MINUTE} AI calls per minute. Try again in a moment.` };
  }
  // 2) per-user per-day
  const ud = get(userDay, userId, 24 * 3600_000);
  if (ud.count >= AI_PER_USER_DAILY) {
    const hoursLeft = Math.ceil((ud.resetAt - Date.now()) / 3600_000);
    return { ok: false, status: 429, error: "AI daily limit reached",
      detail: `Limit ${AI_PER_USER_DAILY} per day per user. Resets in ${hoursLeft}h.` };
  }
  // 3) global per-day failsafe — protects against runaway cost
  if (Date.now() > globalDay.resetAt) {
    globalDay = { count: 0, resetAt: Date.now() + 24 * 3600_000 };
  }
  if (globalDay.count >= AI_GLOBAL_DAILY) {
    return { ok: false, status: 503, error: "AI service paused",
      detail: "Platform-wide daily AI quota reached. Service auto-resumes in 24h." };
  }
  // commit
  tick(um, 60_000);
  tick(ud, 24 * 3600_000);
  globalDay.count += 1;
  return { ok: true };
}

function getAiUsage(userId: string) {
  const um = get(userMinute, userId, 60_000);
  const ud = get(userDay, userId, 24 * 3600_000);
  return {
    perMinute:   { used: um.count, limit: AI_PER_USER_MINUTE },
    perDay:      { used: ud.count, limit: AI_PER_USER_DAILY },
    globalDay:   { used: globalDay.count, limit: AI_GLOBAL_DAILY },
  };
}

const router = Router();

router.use(requireAdmin);

// ─── Stats ────────────────────────────────────────────────────────────────────

router.get("/stats", async (_req, res) => {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [[{ totalStudents }], [{ attemptsToday }], [{ totalAttempts }], recentStudents, upcomingLive] =
    await Promise.all([
      db.select({ totalStudents: count() }).from(usersTable),
      db.select({ attemptsToday: count() }).from(examAttemptsTable)
        .where(gte(examAttemptsTable.startedAt, todayStart)),
      db.select({ totalAttempts: count() }).from(examAttemptsTable)
        .where(eq(examAttemptsTable.status, "submitted")),
      db.select({ id: usersTable.id, displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl, createdAt: usersTable.createdAt })
        .from(usersTable).orderBy(desc(usersTable.createdAt)).limit(5),
      db.select({ id: examsTable.id, title: examsTable.title, scheduledAt: examsTable.scheduledAt, exam: examsTable.exam })
        .from(examsTable).where(eq(examsTable.isLive, true)).limit(5),
    ]);

  res.json({ totalStudents, attemptsToday, totalAttempts, recentStudents, upcomingLive });
});

// ─── Students ─────────────────────────────────────────────────────────────────

router.get("/students", async (_req, res) => {
  const students = await db
    .select({
      id: usersTable.id,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
      xp: usersTable.xp,
      createdAt: usersTable.createdAt,
    })
    .from(usersTable)
    .orderBy(desc(usersTable.createdAt))
    .limit(100);
  res.json(students);
});

router.get("/students/:id/attempts", async (req, res) => {
  const attempts = await db
    .select({
      id: examAttemptsTable.id,
      examId: examAttemptsTable.examId,
      status: examAttemptsTable.status,
      score: examAttemptsTable.score,
      startedAt: examAttemptsTable.startedAt,
      title: examsTable.title,
      totalMarks: examsTable.totalMarks,
    })
    .from(examAttemptsTable)
    .innerJoin(examsTable, eq(examAttemptsTable.examId, examsTable.id))
    .where(eq(examAttemptsTable.userId, req.params.id))
    .orderBy(desc(examAttemptsTable.startedAt));
  res.json(attempts);
});

// ─── Results (per exam leaderboard) ──────────────────────────────────────────

router.get("/exams/:id/results", async (req, res) => {
  const results = await db
    .select({
      attemptId: examAttemptsTable.id,
      userId: examAttemptsTable.userId,
      score: examAttemptsTable.score,
      startedAt: examAttemptsTable.startedAt,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(examAttemptsTable)
    .innerJoin(usersTable, eq(examAttemptsTable.userId, usersTable.id))
    .where(eq(examAttemptsTable.examId, req.params.id))
    .orderBy(desc(examAttemptsTable.score));
  res.json(results);
});

// ─── Exam CRUD ────────────────────────────────────────────────────────────────

router.get("/exams", async (_req, res) => {
  const exams = await db
    .select({
      id: examsTable.id,
      title: examsTable.title,
      exam: examsTable.exam,
      kind: examsTable.kind,
      durationMinutes: examsTable.durationMinutes,
      totalQuestions: examsTable.totalQuestions,
      totalMarks: examsTable.totalMarks,
      difficulty: examsTable.difficulty,
      isLive: examsTable.isLive,
      scheduledAt: examsTable.scheduledAt,
      attemptCount: examsTable.attemptCount,
      negativeMarking: examsTable.negativeMarking,
      marksPerQuestion: examsTable.marksPerQuestion,
    })
    .from(examsTable)
    .orderBy(examsTable.title);
  res.json(exams);
});

const CreateExamBody = z.object({
  title: z.string().min(1).max(200),
  exam: z.string().min(1).max(100),
  kind: z.enum(["practice", "timed", "full-mock", "scheduled", "contest", "pyq"]),
  durationMinutes: z.number().int().positive().max(720), // ≤ 12 hours
  difficulty: z.enum(["easy", "medium", "hard"]),
  description: z.string().max(5000).default(""),
  negativeMarking: z.number().min(0).max(100).default(0.33),
  marksPerQuestion: z.number().positive().max(100).default(1),
  instructions: z.array(z.string().max(500)).max(30).default([]),
  topics: z.array(z.string().max(100)).max(50).default([]),
  isLive: z.boolean().default(false),
  scheduledAt: z.string().datetime().nullable().optional(),
  hasCalculator: z.boolean().default(false),
});

router.post("/exams", async (req, res) => {
  const body = CreateExamBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.message });
  const d = body.data;
  const [exam] = await db.insert(examsTable).values({
    id: randomUUID(),
    title: d.title,
    exam: d.exam,
    kind: d.kind,
    durationMinutes: d.durationMinutes,
    totalQuestions: 0,
    totalMarks: 0,
    difficulty: d.difficulty,
    description: d.description,
    negativeMarking: d.negativeMarking,
    marksPerQuestion: d.marksPerQuestion,
    instructionsJson: d.instructions,
    topicsJson: d.topics,
    isLive: d.isLive,
    scheduledAt: d.scheduledAt ? new Date(d.scheduledAt) : null,
    hasCalculator: d.hasCalculator,
  }).returning();
  res.status(201).json(exam);
});

const UpdateExamBody = z.object({
  title: z.string().min(1).max(200).optional(),
  exam: z.string().min(1).max(100).optional(),
  kind: z.enum(["practice", "timed", "full-mock", "scheduled", "contest", "pyq"]).optional(),
  durationMinutes: z.number().int().positive().max(720).optional(),
  difficulty: z.enum(["easy", "medium", "hard"]).optional(),
  description: z.string().max(5000).optional(),
  negativeMarking: z.number().min(0).max(100).optional(),
  marksPerQuestion: z.number().positive().max(100).optional(),
  instructions: z.array(z.string().max(500)).max(30).optional(),
  topics: z.array(z.string().max(100)).max(50).optional(),
  isLive: z.boolean().optional(),
  scheduledAt: z.string().datetime().nullable().optional(),
  hasCalculator: z.boolean().optional(),
  shuffleQuestions: z.boolean().optional(),
});

router.patch("/exams/:id", async (req, res) => {
  const body = UpdateExamBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.message });

  const [before] = await db.select({ isLive: examsTable.isLive }).from(examsTable).where(eq(examsTable.id, req.params.id));

  const { instructions, topics, scheduledAt, ...rest } = body.data;
  const updateData: any = { ...rest };
  if (instructions !== undefined) updateData.instructionsJson = instructions;
  if (topics !== undefined) updateData.topicsJson = topics;
  if (scheduledAt !== undefined) updateData.scheduledAt = scheduledAt ? new Date(scheduledAt) : null;

  const [updated] = await db.update(examsTable)
    .set(updateData)
    .where(eq(examsTable.id, req.params.id))
    .returning();
  if (!updated) return res.status(404).json({ error: "Exam not found" });

  // Notify all users when an exam goes live for the first time
  if (body.data.isLive === true && before && !before.isLive) {
    const examType = updated.exam; // e.g. "GATE", "JEE"
    const users = await db
      .select({ id: usersTable.id })
      .from(usersTable)
      .where(ilike(usersTable.examFocus, `%${examType}%`));
    users.forEach(u => createNotification(
      u.id,
      "exam_live",
      "New mock test available",
      `"${updated.title}" is now live — attempt it before the deadline!`,
      `/exams/${updated.id}`,
    ));
  }

  res.json(updated);
});

router.delete("/exams/:id", async (req, res) => {
  const examId = req.params.id;
  try {
    const summary = await db.transaction(async (tx) => {
      // 1. Find the exam first so we can 404 cleanly without partial work.
      const [exam] = await tx.select({ id: examsTable.id }).from(examsTable).where(eq(examsTable.id, examId));
      if (!exam) return null;

      // 2. Collect child IDs we'll need for further deletes.
      const questionIds  = (await tx.select({ id: questionsTable.id }).from(questionsTable).where(eq(questionsTable.examId, examId))).map(r => r.id);
      const attemptIds   = (await tx.select({ id: examAttemptsTable.id }).from(examAttemptsTable).where(eq(examAttemptsTable.examId, examId))).map(r => r.id);

      // 3. Delete in child-first order so FK constraints (if present on prod) don't
      //    block the parent delete. inArray with an empty array is a no-op in Drizzle.
      const bookmarksDeleted = questionIds.length
        ? (await tx.delete(questionBookmarksTable).where(inArray(questionBookmarksTable.questionId, questionIds)).returning({ id: questionBookmarksTable.questionId })).length
        : 0;

      const answersDeleted = attemptIds.length
        ? (await tx.delete(userAnswersTable).where(inArray(userAnswersTable.attemptId, attemptIds)).returning({ id: userAnswersTable.id })).length
        : 0;

      const attemptsDeleted   = (await tx.delete(examAttemptsTable).where(eq(examAttemptsTable.examId, examId)).returning({ id: examAttemptsTable.id })).length;
      const questionsDeleted  = (await tx.delete(questionsTable).where(eq(questionsTable.examId, examId)).returning({ id: questionsTable.id })).length;
      const sectionsDeleted   = (await tx.delete(examSectionsTable).where(eq(examSectionsTable.examId, examId)).returning({ id: examSectionsTable.id })).length;
      await tx.delete(examsTable).where(eq(examsTable.id, examId));

      return { questionsDeleted, sectionsDeleted, attemptsDeleted, answersDeleted, bookmarksDeleted };
    });

    if (!summary) return res.status(404).json({ error: "Exam not found" });
    res.json({ ok: true, ...summary });
  } catch (err: any) {
    req.log?.error({ err, examId }, "DELETE /admin/exams/:id failed");
    res.status(500).json({
      error: "Failed to delete exam",
      detail: err?.message ?? "unknown",
      code: err?.code,
    });
  }
});

// ─── Section CRUD ─────────────────────────────────────────────────────────────

router.get("/exams/:id/sections", async (req, res) => {
  const sections = await db
    .select()
    .from(examSectionsTable)
    .where(eq(examSectionsTable.examId, req.params.id))
    .orderBy(examSectionsTable.displayOrder);
  res.json(sections);
});

const CreateSectionBody = z.object({
  name: z.string().min(1).max(100),
  displayOrder: z.number().int().min(0).max(100).default(0),
  timeLimitMinutes: z.number().int().positive().max(720).nullable().optional(),
});

router.post("/exams/:id/sections", async (req, res) => {
  const body = CreateSectionBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.message });
  const [section] = await db.insert(examSectionsTable).values({
    id: randomUUID(),
    examId: req.params.id,
    name: body.data.name,
    displayOrder: body.data.displayOrder ?? 0,
    timeLimitMinutes: body.data.timeLimitMinutes ?? null,
  }).returning();
  res.status(201).json(section);
});

const UpdateSectionBody = z.object({
  name: z.string().min(1).max(100).optional(),
  displayOrder: z.number().int().min(0).max(100).optional(),
  timeLimitMinutes: z.number().int().positive().max(720).nullable().optional(),
});

router.patch("/sections/:id", async (req, res) => {
  const body = UpdateSectionBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.message });
  const [updated] = await db.update(examSectionsTable)
    .set(body.data)
    .where(eq(examSectionsTable.id, req.params.id))
    .returning();
  if (!updated) return res.status(404).json({ error: "Section not found" });
  res.json(updated);
});

router.delete("/sections/:id", async (req, res) => {
  // Unlink questions before deleting section
  await db.update(questionsTable)
    .set({ sectionId: null })
    .where(eq(questionsTable.sectionId, req.params.id));
  const [deleted] = await db.delete(examSectionsTable)
    .where(eq(examSectionsTable.id, req.params.id))
    .returning();
  if (!deleted) return res.status(404).json({ error: "Section not found" });
  res.json({ ok: true });
});

// ─── AI: Suggest Tags ─────────────────────────────────────────────────────────
//
// Given a question body (and optional context), Claude Haiku returns:
//   { subject, topic, subtopic, difficulty }
// Admin can accept or edit. Designed for the "Suggest tags" button in the
// admin question form, and for CSV auto-fill on rows with missing metadata.

const SuggestTagsBody = z.object({
  body: z.string().min(5).max(5000),
  examContext: z.string().max(200).optional(), // e.g. "GATE CSE", "JEE Main"
  existingSubjects: z.array(z.string().max(100)).max(50).optional(),
  existingTopics: z.array(z.string().max(100)).max(100).optional(),
});

router.get("/ai/usage", async (req, res) => {
  const userId = getAuthUserId(req);
  res.json(getAiUsage(userId));
});

router.post("/ai/suggest-tags", async (req, res) => {
  const parsed = SuggestTagsBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const d = parsed.data;

  // CACHE: return immediately if same body was tagged within the last hour
  const ck = cacheKey("tags", d.body);
  const cached = cacheGet(ck);
  if (cached) {
    res.setHeader("X-AI-Cache", "hit");
    return res.json(cached);
  }

  const client = getAnthropic();
  if (!client) {
    return res.status(503).json({
      error: "AI features not configured",
      detail: "Set ANTHROPIC_API_KEY in environment to enable.",
    });
  }

  // COST: per-user + global rate limits before paid call
  const userId = getAuthUserId(req);
  const limit = checkAiLimits(userId);
  if (!limit.ok) return res.status(limit.status).json({ error: limit.error, detail: limit.detail });

  // COST: cap context lists at 15 each — bigger lists rarely help and add tokens
  const subjects = (d.existingSubjects ?? []).slice(0, 15);
  const topics   = (d.existingTopics   ?? []).slice(0, 15);
  const ctx = [
    d.examContext && `Exam: ${d.examContext}`,
    subjects.length && `Prefer subjects: ${subjects.join(", ")}`,
    topics.length   && `Prefer topics: ${topics.join(", ")}`,
  ].filter(Boolean).join(". ");

  // COST: trimmed prompt — ~60% fewer input tokens vs original wording.
  // max_tokens 150 is enough for the JSON shape.
  try {
    const msg = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 150,
      messages: [{
        role: "user",
        content: `Tag this exam question. ${ctx}

Q: ${d.body}

Reply ONLY this JSON (no prose, no fences):
{"subject":"","topic":"","subtopic":"","difficulty":"easy|medium|hard"}`,
      }],
    });

    const text = msg.content
      .filter((b: any) => b.type === "text").map((b: any) => b.text).join("").trim();
    const cleaned = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```\s*$/, "").trim();

    let suggestion: any;
    try { suggestion = JSON.parse(cleaned); }
    catch { return res.status(502).json({ error: "AI returned malformed JSON", raw: cleaned.slice(0, 200) }); }

    const Result = z.object({
      subject: z.string().max(200).optional(),
      topic: z.string().max(200).optional(),
      subtopic: z.string().max(200).optional(),
      difficulty: z.enum(["easy", "medium", "hard"]).optional(),
    });
    const r = Result.safeParse(suggestion);
    if (!r.success) return res.status(502).json({ error: "AI response failed validation" });

    cacheSet(ck, r.data);
    res.setHeader("X-AI-Cache", "miss");
    res.json(r.data);
  } catch (err: any) {
    console.error("AI suggest-tags error:", err);
    return res.status(502).json({ error: "AI request failed", detail: err?.message ?? "unknown" });
  }
});

// ─── Question CRUD ────────────────────────────────────────────────────────────

router.get("/exams/:id/questions", async (req, res) => {
  const questions = await db.select().from(questionsTable).where(eq(questionsTable.examId, req.params.id));
  res.json(questions);
});

// SECURITY: length caps prevent DB bloat and oversized payloads.
// imageUrl + solutionArticleUrl restricted to https:// (blocks javascript:/data:).
// solutionVideoUrl restricted to YouTube domains to prevent untrusted redirects.
const safeUrl = z.string().regex(/^https:\/\//i, "must be https://").nullable().optional();
const youTubeUrl = z.string().regex(
  /^https:\/\/(www\.)?(youtube\.com|youtu\.be)\//i,
  "video URL must be a YouTube link",
).nullable().optional();

const CreateQuestionBody = z.object({
  kind: z.enum(["mcq", "msq", "nat"]),
  body: z.string().min(1).max(5000),
  topic: z.string().min(1).max(200),
  subject: z.string().max(200).nullable().optional(),
  subtopic: z.string().max(200).nullable().optional(),
  source: z.string().max(200).nullable().optional(),
  marks: z.number().positive().max(1000),
  negativeMarks: z.number().min(0).max(1000),
  imageUrl: safeUrl,
  explanation: z.string().max(5000).nullable().optional(),
  solutionVideoUrl: youTubeUrl,
  solutionArticleUrl: safeUrl,
  options: z.array(z.object({ id: z.string().max(100), body: z.string().min(1).max(2000) })).max(6).optional(),
  correctOptionIds: z.array(z.string().max(100)).max(6).optional(),
  natAnswer: z.number().nullable().optional(),
  sectionId: z.string().max(100).nullable().optional(),
});

router.post("/exams/:id/questions", async (req, res) => {
  const body = CreateQuestionBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.message });
  const examId = req.params.id;

  try {
    const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, examId));
    if (!exam) return res.status(404).json({ error: "Exam not found" });

    const d = body.data;
    const [q] = await db.insert(questionsTable).values({
      id: randomUUID(),
      examId,
      sectionId: d.sectionId ?? null,
      kind: d.kind,
      body: d.body,
      topic: d.topic,
      subject: d.subject ?? null,
      subtopic: d.subtopic ?? null,
      source: d.source ?? null,
      marks: d.marks,
      negativeMarks: d.negativeMarks,
      imageUrl: d.imageUrl ?? null,
      explanation: d.explanation ?? null,
      solutionVideoUrl: d.solutionVideoUrl ?? null,
      solutionArticleUrl: d.solutionArticleUrl ?? null,
      optionsJson: d.options ?? [],
      correctOptionIdsJson: d.correctOptionIds ?? [],
      natAnswer: d.natAnswer ?? null,
    }).returning();

    await db.update(examsTable).set({
      totalQuestions: sql`${examsTable.totalQuestions} + 1`,
      totalMarks:     sql`${examsTable.totalMarks} + ${d.marks}`,
    }).where(eq(examsTable.id, examId));

    res.status(201).json(q);
  } catch (err: any) {
    req.log?.error({ err, examId }, "POST /admin/exams/:id/questions failed");
    res.status(500).json({
      error: "Failed to add question",
      detail: err?.message ?? "unknown",
      code: err?.code,
    });
  }
});

// Bulk import (used by CSV) — same caps as single-question create, plus a row limit
const BulkQuestionItem = z.object({
  kind: z.enum(["mcq", "msq", "nat"]),
  body: z.string().min(1).max(5000),
  topic: z.string().min(1).max(200),
  subject: z.string().max(200).nullable().optional(),
  subtopic: z.string().max(200).nullable().optional(),
  source: z.string().max(200).nullable().optional(),
  marks: z.number().positive().max(1000),
  negativeMarks: z.number().min(0).max(1000),
  options: z.array(z.object({ id: z.string().max(100), body: z.string().min(1).max(2000) })).max(6).optional(),
  correctOptionIds: z.array(z.string().max(100)).max(6).optional(),
  natAnswer: z.number().nullable().optional(),
  explanation: z.string().max(5000).nullable().optional(),
  solutionVideoUrl: youTubeUrl,
  solutionArticleUrl: safeUrl,
  sectionId: z.string().max(100).nullable().optional(),
});

router.post("/exams/:id/questions/bulk", async (req, res) => {
  const examId = req.params.id;
  // SECURITY: max 1000 rows per import to prevent DoS via huge CSV
  const body = z.object({ questions: z.array(BulkQuestionItem).min(1).max(1000) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.message });

  const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, examId));
  if (!exam) return res.status(404).json({ error: "Exam not found" });

  const rows = body.data.questions.map((d) => ({
    id: randomUUID(),
    examId,
    sectionId: d.sectionId ?? null,
    kind: d.kind,
    body: d.body,
    topic: d.topic,
    subject: d.subject ?? null,
    subtopic: d.subtopic ?? null,
    source: d.source ?? null,
    marks: d.marks,
    negativeMarks: d.negativeMarks,
    imageUrl: null,
    explanation: d.explanation ?? null,
    solutionVideoUrl: d.solutionVideoUrl ?? null,
    solutionArticleUrl: d.solutionArticleUrl ?? null,
    optionsJson: d.options ?? [],
    correctOptionIdsJson: d.correctOptionIds ?? [],
    natAnswer: d.natAnswer ?? null,
  }));

  await db.insert(questionsTable).values(rows);

  const addedMarks = rows.reduce((s, r) => s + r.marks, 0);
  await db.update(examsTable).set({
    totalQuestions: sql`${examsTable.totalQuestions} + ${rows.length}`,
    totalMarks:     sql`${examsTable.totalMarks} + ${addedMarks}`,
  }).where(eq(examsTable.id, examId));

  res.status(201).json({ added: rows.length });
});

router.delete("/questions/:id", async (req, res) => {
  const [q] = await db.select().from(questionsTable).where(eq(questionsTable.id, req.params.id));
  if (!q) return res.status(404).json({ error: "Question not found" });

  await db.delete(questionsTable).where(eq(questionsTable.id, req.params.id));

  // greatest(x, 0) keeps the counter from going negative if it's already drifted low.
  await db.update(examsTable).set({
    totalQuestions: sql`greatest(${examsTable.totalQuestions} - 1, 0)`,
    totalMarks:     sql`greatest(${examsTable.totalMarks} - ${q.marks}, 0)`,
  }).where(eq(examsTable.id, q.examId));

  res.json({ ok: true });
});

// ─── Edit Question ────────────────────────────────────────────────────────────

const UpdateQuestionBody = z.object({
  kind: z.enum(["mcq", "msq", "nat"]).optional(),
  body: z.string().min(1).max(5000).optional(),
  topic: z.string().min(1).max(200).optional(),
  subject: z.string().max(200).nullable().optional(),
  subtopic: z.string().max(200).nullable().optional(),
  source: z.string().max(200).nullable().optional(),
  marks: z.number().positive().max(1000).optional(),
  negativeMarks: z.number().min(0).max(1000).optional(),
  imageUrl: safeUrl,
  explanation: z.string().max(5000).nullable().optional(),
  solutionVideoUrl: youTubeUrl,
  solutionArticleUrl: safeUrl,
  options: z.array(z.object({ id: z.string().max(100), body: z.string().min(1).max(2000) })).max(6).optional(),
  correctOptionIds: z.array(z.string().max(100)).max(6).optional(),
  natAnswer: z.number().nullable().optional(),
  sectionId: z.string().max(100).nullable().optional(),
  displayOrder: z.number().int().min(0).optional(),
});

router.patch("/questions/:id", async (req, res) => {
  const body = UpdateQuestionBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.message });

  const [existing] = await db.select().from(questionsTable).where(eq(questionsTable.id, req.params.id));
  if (!existing) return res.status(404).json({ error: "Question not found" });

  const { options, correctOptionIds, ...rest } = body.data;
  const updateData: any = { ...rest };
  if (options !== undefined) updateData.optionsJson = options;
  if (correctOptionIds !== undefined) updateData.correctOptionIdsJson = correctOptionIds;

  const [updated] = await db.update(questionsTable).set(updateData).where(eq(questionsTable.id, req.params.id)).returning();

  if (body.data.marks !== undefined && body.data.marks !== existing.marks) {
    const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, existing.examId));
    if (exam) {
      await db.update(examsTable).set({
        totalMarks: Math.max(0, exam.totalMarks + (body.data.marks - existing.marks)),
      }).where(eq(examsTable.id, existing.examId));
    }
  }

  res.json(updated);
});

// ─── Bulk Solutions Update ────────────────────────────────────────────────────

const BulkSolutionUpdate = z.object({
  updates: z.array(z.object({
    questionId: z.string().max(100),
    explanation: z.string().max(5000).nullable().optional(),
    solutionVideoUrl: youTubeUrl,
    solutionArticleUrl: safeUrl,
  })).min(1).max(1000),
});

router.patch("/exams/:id/solutions", async (req, res) => {
  const body = BulkSolutionUpdate.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.message });

  await Promise.all(body.data.updates.map(u =>
    db.update(questionsTable)
      .set({
        explanation: u.explanation ?? null,
        solutionVideoUrl: u.solutionVideoUrl ?? null,
        solutionArticleUrl: u.solutionArticleUrl ?? null,
      })
      .where(and(
        eq(questionsTable.id, u.questionId),
        eq(questionsTable.examId, req.params.id)
      ))
  ));

  res.json({ updated: body.data.updates.length });
});

// ─── Duplicate Exam ───────────────────────────────────────────────────────────

router.post("/exams/:id/duplicate", async (req, res) => {
  const [original] = await db.select().from(examsTable).where(eq(examsTable.id, req.params.id));
  if (!original) return res.status(404).json({ error: "Exam not found" });

  const questions = await db.select().from(questionsTable).where(eq(questionsTable.examId, req.params.id));
  const sections  = await db.select().from(examSectionsTable).where(eq(examSectionsTable.examId, req.params.id));

  const newExamId = randomUUID();
  const [newExam] = await db.insert(examsTable).values({
    ...original,
    id: newExamId,
    title: `${original.title} (Copy)`,
    isLive: false,
    scheduledAt: null,
    attemptCount: 0,
  }).returning();

  // Re-map section IDs
  const sectionIdMap = new Map<string, string>();
  if (sections.length > 0) {
    const newSections = await db.insert(examSectionsTable).values(
      sections.map(s => {
        const newId = randomUUID();
        sectionIdMap.set(s.id, newId);
        return { ...s, id: newId, examId: newExamId };
      })
    ).returning();
    newSections; // used for side-effect
  }

  if (questions.length > 0) {
    await db.insert(questionsTable).values(
      questions.map(q => ({
        ...q,
        id: randomUUID(),
        examId: newExamId,
        sectionId: q.sectionId ? (sectionIdMap.get(q.sectionId) ?? null) : null,
      }))
    );
  }

  res.status(201).json(newExam);
});

// ─── Exam Invite Code ─────────────────────────────────────────────────────────

function nanoid8() {
  const chars = "abcdefghijkmnpqrstuvwxyz23456789"; // no confusable chars
  let id = "";
  const buf = new Uint8Array(8);
  crypto.getRandomValues(buf);
  for (const b of buf) id += chars[b % chars.length];
  return id;
}

router.post("/exams/:id/invite", async (req, res) => {
  const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, req.params.id));
  if (!exam) return res.status(404).json({ error: "Exam not found" });

  // Return existing code, or generate a new unique one
  let code = exam.inviteCode;
  if (!code) {
    let attempts = 0;
    while (attempts < 10) {
      const candidate = nanoid8();
      const [existing] = await db.select({ id: examsTable.id }).from(examsTable).where(eq(examsTable.inviteCode, candidate));
      if (!existing) { code = candidate; break; }
      attempts++;
    }
    if (!code) return res.status(500).json({ error: "Could not generate unique code" });
    await db.update(examsTable).set({ inviteCode: code }).where(eq(examsTable.id, req.params.id));
  }

  res.json({ inviteCode: code });
});

router.delete("/exams/:id/invite", async (req, res) => {
  await db.update(examsTable).set({ inviteCode: null }).where(eq(examsTable.id, req.params.id));
  res.json({ ok: true });
});

// ─── Reorder Questions ────────────────────────────────────────────────────────

router.patch("/exams/:id/questions/reorder", async (req, res) => {
  const body = z.object({ order: z.array(z.string().max(100)).min(1).max(1000) }).safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.message });

  await Promise.all(
    body.data.order.map((questionId, index) =>
      db.update(questionsTable).set({ displayOrder: index }).where(eq(questionsTable.id, questionId))
    )
  );
  res.json({ ok: true });
});

// ─── Per-Question Analytics ───────────────────────────────────────────────────

router.get("/exams/:id/question-stats", async (req, res) => {
  const questions = await db.select().from(questionsTable).where(eq(questionsTable.examId, req.params.id));
  if (questions.length === 0) return res.json([]);

  const qIds = questions.map(q => q.id);
  const answers = await db
    .select({
      questionId: userAnswersTable.questionId,
      selectedOptionIdsJson: userAnswersTable.selectedOptionIdsJson,
      natValue: userAnswersTable.natValue,
      status: userAnswersTable.status,
    })
    .from(userAnswersTable)
    .innerJoin(examAttemptsTable, eq(userAnswersTable.attemptId, examAttemptsTable.id))
    .where(and(
      inArray(userAnswersTable.questionId, qIds),
      eq(examAttemptsTable.status, "submitted")
    ));

  const byQuestion = new Map<string, typeof answers>();
  for (const a of answers) {
    const arr = byQuestion.get(a.questionId) ?? [];
    arr.push(a);
    byQuestion.set(a.questionId, arr);
  }

  const stats = questions.map(q => {
    const qAnswers = byQuestion.get(q.id) ?? [];
    const attempted = qAnswers.filter(a => a.status !== "unanswered").length;
    let correct = 0;
    for (const a of qAnswers) {
      if (a.status === "unanswered") continue;
      if (q.kind === "nat") {
        if (a.natValue !== null && a.natValue === q.natAnswer) correct++;
      } else {
        const sel = (a.selectedOptionIdsJson as string[]) ?? [];
        const cor = (q.correctOptionIdsJson as string[]) ?? [];
        if (sel.length > 0 && sel.length === cor.length && sel.every((id: string) => cor.includes(id))) correct++;
      }
    }
    return {
      id: q.id,
      body: q.body.slice(0, 120),
      kind: q.kind,
      topic: q.topic,
      subject: q.subject,
      marks: q.marks,
      displayOrder: q.displayOrder,
      totalAnswers: qAnswers.length,
      attempted,
      correct,
      wrong: attempted - correct,
      skipped: qAnswers.length - attempted,
      correctRate: attempted > 0 ? Math.round((correct / attempted) * 100) : null,
    };
  });

  res.json(stats);
});

// ─── Export Results CSV ───────────────────────────────────────────────────────

router.get("/exams/:id/results/export", async (req, res) => {
  const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, req.params.id));
  if (!exam) return res.status(404).json({ error: "Exam not found" });

  const results = await db
    .select({
      attemptId: examAttemptsTable.id,
      score: examAttemptsTable.score,
      startedAt: examAttemptsTable.startedAt,
      submittedAt: examAttemptsTable.submittedAt,
      durationMinutes: examAttemptsTable.durationMinutes,
      displayName: usersTable.displayName,
      handle: usersTable.handle,
    })
    .from(examAttemptsTable)
    .innerJoin(usersTable, eq(examAttemptsTable.userId, usersTable.id))
    .where(and(eq(examAttemptsTable.examId, req.params.id), eq(examAttemptsTable.status, "submitted")))
    .orderBy(desc(examAttemptsTable.score));

  const header = "Rank,Name,Handle,Score,TotalMarks,Percentage,StartedAt,SubmittedAt,DurationMin\n";
  const rows = results.map((r, i) => {
    const pct = exam.totalMarks > 0 && r.score != null ? ((r.score / exam.totalMarks) * 100).toFixed(1) : "";
    return [
      i + 1,
      `"${(r.displayName ?? "").replace(/"/g, '""')}"`,
      r.handle,
      r.score ?? "",
      exam.totalMarks,
      pct,
      r.startedAt?.toISOString() ?? "",
      r.submittedAt?.toISOString() ?? "",
      r.durationMinutes,
    ].join(",");
  }).join("\n");

  const slug = exam.title.replace(/[^a-z0-9]/gi, "_").slice(0, 40);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${slug}_results.csv"`);
  res.send(header + rows);
});

// ─── Export Questions CSV (round-trip with importer) ─────────────────────────

router.get("/exams/:id/questions/export", async (req, res) => {
  const [exam] = await db.select().from(examsTable).where(eq(examsTable.id, req.params.id));
  if (!exam) return res.status(404).json({ error: "Exam not found" });

  const questions = await db
    .select()
    .from(questionsTable)
    .where(eq(questionsTable.examId, req.params.id))
    .orderBy(questionsTable.displayOrder);

  const esc = (s: string | null | undefined) => {
    if (!s) return "";
    const str = String(s);
    return str.includes(",") || str.includes('"') || str.includes("\n")
      ? `"${str.replace(/"/g, '""')}"`
      : str;
  };

  const header = "kind,body,optA,optB,optC,optD,correct,marks,negMarks,section,topic,explanation,videoUrl,articleUrl,subject,subtopic,source\n";

  const rows = questions.map(q => {
    const opts = (q.optionsJson as { id: string; body: string }[]) ?? [];
    const correctIds = (q.correctOptionIdsJson as string[]) ?? [];
    const [a, b, c, d] = opts.map(o => o.body);
    const correctLetters = correctIds
      .map(id => opts.findIndex(o => o.id === id))
      .filter(i => i >= 0)
      .map(i => "ABCD"[i])
      .join("");
    const correctField = q.kind === "nat" ? String(q.natAnswer ?? "") : correctLetters;

    return [
      esc(q.kind),
      esc(q.body),
      esc(a), esc(b), esc(c), esc(d),
      correctField,
      q.marks,
      q.negativeMarks,
      "", // section — omit (section IDs not portable across imports)
      esc(q.topic),
      esc(q.explanation),
      esc(q.solutionVideoUrl),
      esc(q.solutionArticleUrl),
      esc(q.subject),
      esc(q.subtopic),
      esc(q.source),
    ].join(",");
  }).join("\n");

  const slug = exam.title.replace(/[^a-z0-9]/gi, "_").slice(0, 40);
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${slug}_questions.csv"`);
  res.send(header + rows);
});

// ─── PDF Question Importer (Level 2 — Claude native PDF understanding) ────────
//
// Claude reads the PDF directly as a document — no image conversion needed.
// Handles typed PDFs, scanned PDFs, diagrams, and equations out of the box.

const pdfUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 32 * 1024 * 1024 }, // 32 MB — Claude's PDF limit
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype === "application/pdf");
  },
});

const PDF_EXTRACTION_PROMPT = `You are a question bank builder. Extract ALL exam questions from this PDF.
Return ONLY a valid JSON array. Each element must follow this exact schema:
{
  "kind": "mcq" | "msq" | "nat",
  "body": "question text — preserve full text and equations as LaTeX inside $$...$$",
  "options": ["option A text", "option B text", "option C text", "option D text"],
  "correctOptionIndices": [0],
  "natAnswer": null,
  "explanation": "solution explanation if visible, else null",
  "topic": "topic name if identifiable, else null",
  "subject": "subject name if identifiable, else null",
  "marks": 1,
  "negativeMarks": 0.33
}
Rules:
- MCQ: exactly one correct index in correctOptionIndices
- MSQ: two or more correct indices
- NAT: options array is empty, natAnswer is the numeric answer (number type)
- Preserve all math/LaTeX inside $$...$$
- Skip answer key tables, section headings, and instructions
- If correct answer cannot be determined, set correctOptionIndices to []
Return ONLY the JSON array — no markdown fences, no explanation, no other text.`;

router.post("/pdf-import", pdfUpload.single("pdf"), async (req, res) => {
  const userId = getAuthUserId(req);
  if (!req.file) return res.status(400).json({ error: "No PDF file uploaded." });

  const ai = getAnthropic();
  if (!ai) return res.status(503).json({ error: "AI service not configured (missing ANTHROPIC_API_KEY)." });

  const limitCheck = checkAiLimits(userId);
  if (!limitCheck.ok) return res.status(limitCheck.status).json({ error: limitCheck.error, detail: limitCheck.detail });

  try {
    const pdfBase64 = req.file.buffer.toString("base64");

    const response = await ai.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 8000,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: pdfBase64 },
            } as any, // SDK type includes document blocks
            { type: "text", text: PDF_EXTRACTION_PROMPT },
          ],
        },
      ],
    });

    const rawText = response.content.find(b => b.type === "text")?.text ?? "[]";
    const jsonText = rawText.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/, "").trim();

    let extracted: any[];
    try {
      extracted = JSON.parse(jsonText);
      if (!Array.isArray(extracted)) throw new Error("Not an array");
    } catch {
      return res.status(422).json({ error: "AI returned unparseable response.", raw: rawText.slice(0, 500) });
    }

    // Normalise into the same shape as the CSV importer expects
    const questions = extracted.map((q: any) => {
      const options: { id: string; body: string }[] = (q.options ?? []).map((o: string) => ({
        id: randomUUID(),
        body: String(o),
      }));
      const correctOptionIds: string[] = (q.correctOptionIndices ?? [])
        .filter((i: number) => i >= 0 && i < options.length)
        .map((i: number) => options[i].id);

      return {
        kind: ["mcq", "msq", "nat"].includes(q.kind) ? q.kind : "mcq",
        body: String(q.body ?? "").trim(),
        options,
        correctOptionIds,
        natAnswer: q.kind === "nat" ? (typeof q.natAnswer === "number" ? q.natAnswer : null) : null,
        marks: typeof q.marks === "number" ? q.marks : 1,
        negativeMarks: typeof q.negativeMarks === "number" ? q.negativeMarks : 0,
        topic: q.topic ?? null,
        subject: q.subject ?? null,
        subtopic: null,
        source: null,
        explanation: q.explanation ?? null,
        solutionVideoUrl: null,
        solutionArticleUrl: null,
        sectionId: null,
      };
    }).filter((q: any) => q.body.length > 0);

    res.json({
      questions,
      extracted: extracted.length,
      valid: questions.length,
    });
  } catch (err: any) {
    console.error("pdf-import error:", err);
    res.status(500).json({ error: "PDF processing failed.", detail: err?.message });
  }
});

export default router;
