import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { usersTable, goalsTable, studySessionsTable, circlesTable, channelsTable, messagesTable, circleMembersTable, circleInvitesTable, subjectsTable, doubtsTable, doubtAnswersTable, doubtAnswerUpvotesTable, doubtUpvotesTable, doubtAnswerCommentsTable, examsTable, questionsTable, examAttemptsTable, userAnswersTable, messageReactionsTable, dmConversationsTable, directMessagesTable, userFollowersTable, focusRoomsTable, focusRoomParticipantsTable, connectionsTable, stickyNotesTable, userAimTable, examSectionsTable, questionBookmarksTable, flashcardDecksTable, flashcardsTable, notificationsTable } from "@workspace/db/schema";
import { eq, desc, and, inArray, ilike, or, count, sql, ne, gte, isNull, isNotNull } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { getIO, getOnlineUsers } from "../socket";
import { calculateAndUpdateStreak } from "../streak";
const parentMessageTable = alias(messagesTable, "parent_message");
const parentUserTable = alias(usersTable, "parent_user");
import { randomUUID } from "node:crypto";
import { z } from "zod";
import { store } from "../lib/store";
import {
  countFocusRoomParticipants,
  ensureInMemoryFocusRoom,
  getFocusRoomRow,
  isFocusRoomMember,
  loadAndEnsureFocusRoom,
  setFocusRoomChatEnabled,
} from "../lib/focus-room";
import { ensureAuthUserInDb } from "../lib/ensure-auth-user";
import { privateCache } from "../middleware/cache-control";
import { requireAuth, getAuthUserId, getOptionalAuthUserId } from "../middleware/auth";
import {
  canModerateCircle,
  getChannelCircleId,
  getMessageChannelId,
  isChannelMember,
  isCircleMember,
  ownsExamAttempt,
} from "../lib/access";
import {
  GetMeResponse,
  GetDashboardSummaryResponse,
  GetRecentActivityResponse,
  GetTodayGoalsResponse,
  CreateGoalBody,
  CreateGoalResponse,
  ToggleGoalParams,
  ToggleGoalResponse,
  ListStudySessionsResponse,
  CreateStudySessionBody,
  CreateStudySessionResponse,
  ListSubjectsResponse,
  GetWeeklyStudyMinutesResponse,
  ListCirclesResponse,
  CreateCircleBody,
  CreateCircleResponse,
  DiscoverCirclesResponse,
  GetCircleParams,
  GetCircleResponse,
  JoinCircleParams,
  JoinCircleResponse,
  ListCircleChannelsParams,
  ListCircleChannelsResponse,
  ListChannelMessagesParams,
  ListChannelMessagesResponse,
  SendChannelMessageParams,
  SendChannelMessageBody,
  SendChannelMessageResponse,
  ReactToMessageParams,
  ReactToMessageBody,
  ReactToMessageResponse,
  ListFocusRoomsResponse,
  CreateFocusRoomBody,
  CreateFocusRoomResponse,
  GetFocusRoomParams,
  GetFocusRoomResponse,
  JoinFocusRoomParams,
  JoinFocusRoomBody,
  JoinFocusRoomResponse,
  ListExamsResponse,
  GetExamParams,
  GetExamResponse,
  StartExamAttemptParams,
  StartExamAttemptResponse,
  GetExamAttemptParams,
  GetExamAttemptResponse,
  SubmitAnswerParams,
  SubmitAnswerBody,
  SubmitAnswerResponse,
  SubmitExamAttemptParams,
  SubmitExamAttemptResponse,
  GetAnalyticsOverviewResponse,
  GetTopicPerformanceResponse,
  GetScoreTrendResponse,
  GetLeaderboardResponse,
  ListDoubtsResponse,
  CreateDoubtBody,
  CreateDoubtResponse,
  GetDoubtParams,
  GetDoubtResponse,
  AnswerDoubtParams,
  AnswerDoubtBody,
  AnswerDoubtResponse,
  UpvoteAnswerParams,
  UpvoteAnswerResponse,
  ListPodsResponse,
  GetPodParams,
  GetPodResponse,
  ListResourcesResponse,
  CreateResourceBody,
  CreateResourceResponse,
  ListRevisionItemsResponse,
  CreateRevisionItemBody,
  CreateRevisionItemResponse,
  ReviewRevisionItemParams,
  ReviewRevisionItemBody,
  ReviewRevisionItemResponse,
  ListCalendarEventsResponse,
  CreateCalendarEventBody,
  CreateCalendarEventResponse,
  ListAchievementsResponse,
} from "@workspace/api-zod";
import multer from "multer";
import { v2 as cloudinary } from "cloudinary";
import { AccessToken } from "livekit-server-sdk";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME || "",
  api_key: process.env.CLOUDINARY_API_KEY || "",
  api_secret: process.env.CLOUDINARY_API_SECRET || "",
});

const upload = multer({ 
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5 MB max file size
  },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed"));
    }
  }
});

const router: IRouter = Router();

// Pull a single string id out of req.params (handles string | string[])
const idOf = (raw: unknown): string =>
  Array.isArray(raw) ? String(raw[0]) : String(raw);

// ----- LiveKit Token Route -----
router.get("/livekit/token", requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) return res.status(401).json({ error: "Unauthorized" });

    const roomName = String(req.query.roomName || "");
    const participantName = String(req.query.participantName || userId);

    if (!roomName) return res.status(400).json({ error: "roomName is required" });

    const apiKey = process.env.LIVEKIT_API_KEY;
    const apiSecret = process.env.LIVEKIT_API_SECRET;

    if (!apiKey || !apiSecret) {
      return res.status(500).json({ error: "LiveKit is not configured on the server" });
    }

    const token = new AccessToken(apiKey, apiSecret, {
      identity: userId,
      name: participantName,
      ttl: 21600, // 6 hours in seconds (number format for v2 compatibility)
    });

    token.addGrant({
      roomJoin: true,
      room: roomName,
      canPublish: true,
      canSubscribe: true,
    });

    const jwt = await token.toJwt();
    res.json({ token: jwt });
  } catch (err: any) {
    console.error("LiveKit token error:", err?.message || err);
    res.status(500).json({ error: "Failed to generate token", detail: err?.message });
  }
});

// ── Public exam preview (no auth) — used by shareable exam links ─────────────
router.get("/e/:code", async (req, res) => {
  const code = String(req.params.code).slice(0, 20);
  const [exam] = await db
    .select({
      id: examsTable.id, title: examsTable.title, exam: examsTable.exam,
      kind: examsTable.kind, durationMinutes: examsTable.durationMinutes,
      totalQuestions: examsTable.totalQuestions, totalMarks: examsTable.totalMarks,
      difficulty: examsTable.difficulty, description: examsTable.description,
      negativeMarking: examsTable.negativeMarking, attemptCount: examsTable.attemptCount,
    })
    .from(examsTable)
    // Only expose LIVE exams via public invite links — prevents draft content leaks
    .where(and(eq(examsTable.inviteCode, code), eq(examsTable.isLive, true)));
  if (!exam) return res.status(404).json({ error: "Exam not found" });
  res.json(exam);
});

// ----- Public routes (no JWT) -----
router.get("/invite/:code", async (req, res) => {
  const code = String(req.params.code);
  const [invite] = await db.select().from(circleInvitesTable).where(eq(circleInvitesTable.code, code));
  if (!invite) return res.status(404).json({ error: "Invite not found" });
  if (invite.expiresAt && new Date() > invite.expiresAt) return res.status(410).json({ error: "Invite expired" });
  if (invite.maxUses && invite.uses >= invite.maxUses) {
    return res.status(410).json({ error: "Invite link has reached max uses" });
  }

  const [circle] = await db.select().from(circlesTable).where(eq(circlesTable.id, invite.circleId));
  if (!circle) return res.status(404).json({ error: "Circle not found" });

  const [{ memberCount }] = await db
    .select({ memberCount: count() })
    .from(circleMembersTable)
    .where(eq(circleMembersTable.circleId, circle.id));

  const recentMembers = await db.select({
    userId: usersTable.id,
    displayName: usersTable.displayName,
    avatarUrl: usersTable.avatarUrl,
  }).from(circleMembersTable)
    .leftJoin(usersTable, eq(circleMembersTable.userId, usersTable.id))
    .where(eq(circleMembersTable.circleId, circle.id))
    .limit(6);

  res.json({
    code,
    circle: {
      id: circle.id,
      name: circle.name,
      description: circle.description,
      exam: circle.exam,
      coverColor: circle.coverColor,
      memberCount,
      members: recentMembers.map(m => ({ userId: m.userId, displayName: m.displayName, avatarUrl: m.avatarUrl })),
    },
  });
});

router.get("/invite/:code/preview", async (req, res) => {
  const code = String(req.params.code);
  const [invite] = await db.select().from(circleInvitesTable).where(eq(circleInvitesTable.code, code));
  if (!invite) return res.status(404).json({ error: "Invite not found" });
  if (invite.expiresAt && new Date() > invite.expiresAt) return res.status(410).json({ error: "Invite expired" });

  const [circle] = await db.select().from(circlesTable).where(eq(circlesTable.id, invite.circleId));
  if (!circle) return res.status(404).json({ error: "Circle not found" });

  const [channel] = await db.select().from(channelsTable)
    .where(and(eq(channelsTable.circleId, circle.id), eq(channelsTable.kind, "general")))
    .limit(1);

  if (!channel) return res.json({ circle, messages: [], channelName: "general" });

  const rawMessages = await db.select({
    id: messagesTable.id,
    body: messagesTable.body,
    createdAt: messagesTable.createdAt,
    authorId: messagesTable.authorId,
    authorName: usersTable.displayName,
    authorAvatar: usersTable.avatarUrl,
  })
    .from(messagesTable)
    .leftJoin(usersTable, eq(messagesTable.authorId, usersTable.id))
    .where(eq(messagesTable.channelId, channel.id))
    .orderBy(desc(messagesTable.createdAt))
    .limit(30);

  return res.json({
    circle: {
      id: circle.id,
      name: circle.name,
      description: circle.description,
      exam: circle.exam,
      coverColor: circle.coverColor,
    },
    channelName: channel.name,
    messages: rawMessages.reverse(),
  });
});

router.post("/upload", requireAuth, (req, res, next) => {
  upload.single("file")(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return res.status(400).json({ error: "File is too large. Maximum size is 5MB." });
      }
      return res.status(400).json({ error: err.message });
    }
    next();
  });
}, async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    if (!userId) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    if (!req.file) {
      return res.status(400).json({ error: "No file provided" });
    }

    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: "studycircle_chat" },
      (error, result) => {
        if (error || !result) {
          console.error("Cloudinary upload error:", error);
          return res.status(500).json({ error: "Failed to upload image" });
        }
        res.json({ secure_url: result.secure_url });
      }
    );
    
    uploadStream.end(req.file.buffer);
  } catch (error) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ── Sitemap (no auth — crawled by Google) ────────────────────────────────────
router.get("/sitemap.xml", async (_req, res) => {
  const siteUrl = process.env.SITE_URL ||
    (process.env.NODE_ENV === "production" ? "https://studycircle-jn9a.onrender.com" : "http://localhost:5173");

  const doubts = await db
    .select({ id: doubtsTable.id, createdAt: doubtsTable.createdAt })
    .from(doubtsTable)
    .orderBy(desc(doubtsTable.createdAt))
    .limit(5000);

  const entries = doubts.map(d =>
    `  <url><loc>${siteUrl}/doubts/${d.id}</loc><lastmod>${new Date(d.createdAt).toISOString().split("T")[0]}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`
  ).join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${siteUrl}/</loc><priority>1.0</priority></url>\n${entries}\n</urlset>`;

  res.setHeader("Content-Type", "application/xml");
  res.setHeader("Cache-Control", "public, max-age=3600");
  res.send(xml);
});

// ── Public doubt detail (no auth — for SEO / social sharing) ─────────────────
router.get("/doubts-public/:id", async (req, res) => {
  const id = req.params.id;
  const viewerId = getOptionalAuthUserId(req);

  const [d] = await db.select({
    id:            doubtsTable.id,
    title:         doubtsTable.title,
    body:          doubtsTable.body,
    topic:         doubtsTable.topic,
    subject:       doubtsTable.subject,
    exam:          doubtsTable.exam,
    imageUrls:     doubtsTable.imageUrls,
    upvotes:       doubtsTable.upvotes,
    bountyXp:      doubtsTable.bountyXp,
    createdAt:     doubtsTable.createdAt,
    resolved:      doubtsTable.resolved,
    askedBy:       usersTable.displayName,
    askedByAvatar: usersTable.avatarUrl,
    askedById:     doubtsTable.askedById,
  })
  .from(doubtsTable)
  .leftJoin(usersTable, eq(doubtsTable.askedById, usersTable.id))
  .where(eq(doubtsTable.id, id));

  if (!d) return res.status(404).json({ error: "Not found" });

  const answers = await db.select({
    id:          doubtAnswersTable.id,
    body:        doubtAnswersTable.body,
    imageUrls:   doubtAnswersTable.imageUrls,
    upvotes:     doubtAnswersTable.upvotes,
    accepted:    doubtAnswersTable.accepted,
    createdAt:   doubtAnswersTable.createdAt,
    authorId:    doubtAnswersTable.authorId,
    authorName:  usersTable.displayName,
    authorAvatar: usersTable.avatarUrl,
  })
  .from(doubtAnswersTable)
  .leftJoin(usersTable, eq(doubtAnswersTable.authorId, usersTable.id))
  .where(eq(doubtAnswersTable.doubtId, id))
  .orderBy(desc(doubtAnswersTable.upvotes));

  const answerIds = answers.map(a => a.id);

  // Comments on each answer (StackOverflow-style clarifications), + viewer's upvote state
  const [comments, myAnswerVotes, myQuestionVote] = await Promise.all([
    answerIds.length > 0 ? db.select({
      id:           doubtAnswerCommentsTable.id,
      answerId:     doubtAnswerCommentsTable.answerId,
      body:         doubtAnswerCommentsTable.body,
      createdAt:    doubtAnswerCommentsTable.createdAt,
      authorId:     doubtAnswerCommentsTable.authorId,
      authorName:   usersTable.displayName,
      authorAvatar: usersTable.avatarUrl,
    })
    .from(doubtAnswerCommentsTable)
    .leftJoin(usersTable, eq(doubtAnswerCommentsTable.authorId, usersTable.id))
    .where(inArray(doubtAnswerCommentsTable.answerId, answerIds))
    .orderBy(doubtAnswerCommentsTable.createdAt) : Promise.resolve([]),
    viewerId && answerIds.length > 0
      ? db.select({ answerId: doubtAnswerUpvotesTable.answerId })
          .from(doubtAnswerUpvotesTable)
          .where(and(eq(doubtAnswerUpvotesTable.userId, viewerId), inArray(doubtAnswerUpvotesTable.answerId, answerIds)))
      : Promise.resolve([] as { answerId: string }[]),
    viewerId
      ? db.select().from(doubtUpvotesTable)
          .where(and(eq(doubtUpvotesTable.userId, viewerId), eq(doubtUpvotesTable.doubtId, id)))
      : Promise.resolve([] as unknown[]),
  ]);

  const upvotedSet = new Set(myAnswerVotes.map(v => v.answerId));
  const commentsByAnswer = new Map<string, typeof comments>();
  for (const c of comments) {
    const arr = commentsByAnswer.get(c.answerId) ?? [];
    arr.push(c);
    commentsByAnswer.set(c.answerId, arr);
  }

  res.json({
    ...d,
    askedBy:       d.askedBy || "Anonymous",
    askedByAvatar: d.askedByAvatar || "",
    imageUrls:     d.imageUrls ?? [],
    mineUpvoted:   myQuestionVote.length > 0,
    canAccept:     !!viewerId && viewerId === d.askedById,
    answers: answers.map(a => ({
      ...a,
      authorName:   a.authorName || "Anonymous",
      authorAvatar: a.authorAvatar || "",
      imageUrls:    a.imageUrls ?? [],
      mineUpvoted:  upvotedSet.has(a.id),
      isAccepted:   a.accepted,
      comments: (commentsByAnswer.get(a.id) ?? []).map(c => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt,
        authorId: c.authorId,
        authorName: c.authorName || "Anonymous",
        authorAvatar: c.authorAvatar || "",
      })),
    })),
  });
});

// ── Public doubts feed (GATEOverflow-style community Q&A) ────────────────────
router.get("/doubts-feed", async (req, res) => {
  const exam    = typeof req.query.exam    === "string" && req.query.exam    !== "All" ? req.query.exam    : null;
  const topic   = typeof req.query.topic   === "string" && req.query.topic   !== "All" ? req.query.topic   : null;
  const subject = typeof req.query.subject === "string" && req.query.subject !== "All" ? req.query.subject : null;
  const sort    = typeof req.query.sort    === "string" ? req.query.sort  : "new";
  const q       = typeof req.query.q       === "string" && req.query.q.trim() ? req.query.q.trim() : null;
  const page    = Math.max(1, parseInt(String(req.query.page || "1"), 10));
  const perPage = 20;
  const offset  = (page - 1) * perPage;

  const conditions = [];
  if (exam)    conditions.push(ilike(doubtsTable.exam,  `%${exam}%`));
  if (topic)   conditions.push(ilike(doubtsTable.topic, `%${topic}%`));
  if (subject) conditions.push(ilike(doubtsTable.subject, `%${subject}%`));
  if (q)       conditions.push(or(ilike(doubtsTable.title, `%${q}%`), ilike(doubtsTable.body, `%${q}%`)));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const whereClause = conditions.length > 0 ? and(...(conditions as any[])) : undefined;

  const answerCountExpr = sql<number>`(SELECT COUNT(*) FROM doubt_answers WHERE doubt_id = ${doubtsTable.id})`;

  let orderExpr;
  if (sort === "hot") {
    orderExpr = desc(sql`(SELECT COUNT(*) FROM doubt_answers WHERE doubt_id = ${doubtsTable.id}) * 3 + ${doubtsTable.upvotes} * 2 + EXTRACT(EPOCH FROM ${doubtsTable.createdAt}) / 86400`);
  } else if (sort === "top") {
    orderExpr = desc(doubtsTable.upvotes);
  } else {
    orderExpr = desc(doubtsTable.createdAt);
  }

  const [rows, [countRow]] = await Promise.all([
    db.select({
      id:           doubtsTable.id,
      title:        doubtsTable.title,
      body:         doubtsTable.body,
      topic:        doubtsTable.topic,
      subject:      doubtsTable.subject,
      exam:         doubtsTable.exam,
      imageUrls:    doubtsTable.imageUrls,
      upvotes:      doubtsTable.upvotes,
      bountyXp:     doubtsTable.bountyXp,
      createdAt:    doubtsTable.createdAt,
      resolved:     doubtsTable.resolved,
      askedBy:      usersTable.displayName,
      askedByAvatar: usersTable.avatarUrl,
      askedById:    doubtsTable.askedById,
      answerCount:  answerCountExpr,
    })
    .from(doubtsTable)
    .leftJoin(usersTable, eq(doubtsTable.askedById, usersTable.id))
    .where(whereClause)
    .orderBy(orderExpr)
    .limit(perPage)
    .offset(offset),
    db.select({ total: count() }).from(doubtsTable).where(whereClause),
  ]);

  res.json({
    doubts: rows.map(d => ({
      ...d,
      askedBy:      d.askedBy      || "Anonymous",
      askedByAvatar: d.askedByAvatar || "",
      imageUrls:    d.imageUrls ?? [],
      answerCount:  Number(d.answerCount) || 0,
    })),
    total:   Number(countRow?.total) || 0,
    page,
    hasMore: offset + perPage < (Number(countRow?.total) || 0),
  });
});

// ── Public doubts meta (distinct exams + popular topics for filter chips) ────
router.get("/doubts-meta", async (_req, res) => {
  const [examRows, topicRows] = await Promise.all([
    db.select({ exam: doubtsTable.exam, cnt: count() })
      .from(doubtsTable)
      .groupBy(doubtsTable.exam)
      .orderBy(desc(count()))
      .limit(15),
    db.select({ topic: doubtsTable.topic, cnt: count() })
      .from(doubtsTable)
      .groupBy(doubtsTable.topic)
      .orderBy(desc(count()))
      .limit(30),
  ]);
  res.json({
    exams:  examRows.map(r => r.exam),
    topics: topicRows.map(r => r.topic),
  });
});

// ── Public user profiles ─────────────────────────────────────────────────────
router.get("/users/:id/profile", async (req, res) => {
  const targetId = req.params.id;
  const viewerId = getOptionalAuthUserId(req);

  const [user] = await db.select().from(usersTable).where(eq(usersTable.id, targetId));
  if (!user) return res.status(404).json({ error: "User not found" });

  const [[{ followerCount }], [{ followingCount }]] = await Promise.all([
    db.select({ followerCount: count() }).from(userFollowersTable).where(eq(userFollowersTable.followingId, targetId)),
    db.select({ followingCount: count() }).from(userFollowersTable).where(eq(userFollowersTable.followerId, targetId)),
  ]);

  let isFollowing = false;
  if (viewerId && viewerId !== targetId) {
    const [row] = await db.select().from(userFollowersTable)
      .where(and(eq(userFollowersTable.followerId, viewerId), eq(userFollowersTable.followingId, targetId)));
    isFollowing = !!row;
  }

  const attempts = await db.select({ id: examAttemptsTable.id })
    .from(examAttemptsTable)
    .where(and(eq(examAttemptsTable.userId, targetId), eq(examAttemptsTable.status, "submitted")));

  let avgAccuracyPct = 0;
  let strongTopics: string[] = [];
  let weakTopics: string[] = [];

  if (attempts.length > 0) {
    const answers = await db.select({
      topic: questionsTable.topic,
      kind: questionsTable.kind,
      correctOptionIdsJson: questionsTable.correctOptionIdsJson,
      natAnswer: questionsTable.natAnswer,
      selectedOptionIdsJson: userAnswersTable.selectedOptionIdsJson,
      natValue: userAnswersTable.natValue,
      status: userAnswersTable.status,
    })
    .from(userAnswersTable)
    .innerJoin(questionsTable, eq(userAnswersTable.questionId, questionsTable.id))
    .where(inArray(userAnswersTable.attemptId, attempts.map(a => a.id)));

    let correct = 0, attempted = 0;
    const topicMap = new Map<string, { correct: number; total: number }>();
    for (const ans of answers) {
      if (ans.status === "unanswered" || ans.status === "marked") continue;
      attempted++;
      const t = topicMap.get(ans.topic) ?? { correct: 0, total: 0 };
      t.total++;
      const correctIds = ans.correctOptionIdsJson as string[];
      const selectedIds = ans.selectedOptionIdsJson as string[];
      const isCorrect = ans.kind === "nat"
        ? ans.natValue !== null && Math.abs(ans.natValue - (ans.natAnswer || 0)) < 0.01
        : correctIds.length === selectedIds.length && correctIds.every(id => selectedIds.includes(id));
      if (isCorrect) { correct++; t.correct++; }
      topicMap.set(ans.topic, t);
    }
    avgAccuracyPct = attempted > 0 ? parseFloat(((correct / attempted) * 100).toFixed(1)) : 0;
    const ranked = [...topicMap.entries()]
      .filter(([, v]) => v.total >= 3)
      .map(([topic, v]) => ({ topic, acc: v.correct / v.total }))
      .sort((a, b) => b.acc - a.acc);
    strongTopics = ranked.slice(0, 3).map(t => t.topic);
    weakTopics = ranked.slice(-3).reverse().map(t => t.topic).filter(t => !strongTopics.includes(t));
  }

  const recentExams = await db.select({
    examId: examAttemptsTable.examId,
    score: examAttemptsTable.score,
    submittedAt: examAttemptsTable.submittedAt,
    examTitle: examsTable.title,
    totalMarks: examsTable.totalMarks,
  })
  .from(examAttemptsTable)
  .innerJoin(examsTable, eq(examAttemptsTable.examId, examsTable.id))
  .where(and(eq(examAttemptsTable.userId, targetId), eq(examAttemptsTable.status, "submitted")))
  .orderBy(desc(examAttemptsTable.submittedAt))
  .limit(5);

  res.json({
    id: user.id,
    displayName: user.displayName,
    handle: user.handle,
    avatarUrl: user.avatarUrl ?? null,
    plan: user.plan,
    xp: user.xp,
    level: user.level,
    streakDays: user.streakDays,
    examFocus: user.examFocus,
    followerCount,
    followingCount,
    isFollowing,
    examsAttempted: attempts.length,
    avgAccuracyPct,
    strongTopics,
    weakTopics,
    recentExams: recentExams.map(e => ({
      examId: e.examId,
      examTitle: e.examTitle,
      score: e.score ?? 0,
      totalMarks: e.totalMarks,
      submittedAt: e.submittedAt,
    })),
  });
});

router.post("/users/:id/follow", requireAuth, async (req, res) => {
  const viewerId = getAuthUserId(req);
  const targetId = req.params.id;
  if (viewerId === targetId) return res.status(400).json({ error: "Cannot follow yourself" });
  const result = await db.insert(userFollowersTable)
    .values({ followerId: viewerId, followingId: targetId })
    .onConflictDoNothing()
    .returning();
  if (result.length > 0) {
    const [viewer] = await db.select({ displayName: usersTable.displayName }).from(usersTable).where(eq(usersTable.id, viewerId));
    createNotification(targetId, "follow", "New follower", `${viewer?.displayName ?? "Someone"} started following you`, `/users/${viewerId}`);
  }
  res.json({ ok: true, following: true });
});

router.delete("/users/:id/follow", requireAuth, async (req, res) => {
  const viewerId = getAuthUserId(req);
  const targetId = req.params.id;
  await db.delete(userFollowersTable)
    .where(and(eq(userFollowersTable.followerId, viewerId), eq(userFollowersTable.followingId, targetId)));
  res.json({ ok: true, following: false });
});

router.use(requireAuth);

// ME
router.get("/me", async (req, res) => {
  const userId = getAuthUserId(req);
  const [user] = await db.select({
    id: usersTable.id,
    displayName: usersTable.displayName,
    handle: usersTable.handle,
    avatarUrl: usersTable.avatarUrl,
    level: usersTable.level,
    xp: usersTable.xp,
    xpForNextLevel: usersTable.xpForNextLevel,
    streakDays: usersTable.streakDays,
    examFocus: usersTable.examFocus,
    plan: usersTable.plan,
    dailyTargetMinutes: usersTable.dailyTargetMinutes,
    activeAvatarId: usersTable.activeAvatarId,
    activeAuraId: usersTable.activeAuraId,
  }).from(usersTable).where(eq(usersTable.id, userId));
  res.json(GetMeResponse.parse(user));
});

const syncMeSchema = z.object({
  email: z.string().email().max(254).optional(),
  displayName: z.string().max(100).optional(),
  avatarUrl: z.string().url().max(2048).optional().or(z.literal("")),
});

router.post("/me/sync", async (req, res) => {
  const userId = getAuthUserId(req);
  const parsed = syncMeSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }
  const { email, displayName, avatarUrl } = parsed.data;

  const nextDisplayName = displayName || "User";
  const nextAvatarUrl = avatarUrl || "";

  const [existing] = await db
    .select({
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (
    existing &&
    existing.displayName === nextDisplayName &&
    (existing.avatarUrl || "") === nextAvatarUrl
  ) {
    return res.json({ success: true, skipped: true });
  }

  const handle = email ? email.split("@")[0] : userId.replace(/[^a-zA-Z0-9]/g, "").substring(0, 20);
  
  await db.insert(usersTable).values({
    id: userId,
    displayName: displayName || "User",
    handle: `${handle}_${userId.substring(0, 6)}`,
    avatarUrl: avatarUrl || "",
    examFocus: "GATE",
  }).onConflictDoUpdate({
    target: usersTable.id,
    set: {
      displayName: displayName || "User",
      avatarUrl: avatarUrl || "",
    }
  });
  
  res.json({ success: true });
});

// DASHBOARD
router.get("/dashboard/summary", requireAuth, async (req, res) => {
  const userId = getAuthUserId(req);

  const [user] = await db
    .select({
      streakDays:         usersTable.streakDays,
      level:              usersTable.level,
      xp:                 usersTable.xp,
      xpForNextLevel:     usersTable.xpForNextLevel,
      dailyTargetMinutes: usersTable.dailyTargetMinutes,
    })
    .from(usersTable)
    .where(eq(usersTable.id, userId));

  if (!user) { res.status(404).json({ message: "User not found" }); return; }

  // Sessions in the last 7 days
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);
  const sessions = await db
    .select({ startedAt: studySessionsTable.startedAt, durationMinutes: studySessionsTable.durationMinutes })
    .from(studySessionsTable)
    .where(and(eq(studySessionsTable.userId, userId), gte(studySessionsTable.startedAt, weekAgo)));

  // Use client's local date if provided (avoids UTC midnight mismatch for IST users)
  const todayLocal = typeof req.query.localDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.localDate)
    ? req.query.localDate
    : new Date().toISOString().split("T")[0];

  let todayMinutes = 0;
  let weeklyMinutes = 0;
  const activeDaySet = new Set<string>();

  for (const s of sessions) {
    const dateStr = new Date(s.startedAt).toISOString().split("T")[0];
    weeklyMinutes += s.durationMinutes;
    activeDaySet.add(dateStr);
    if (dateStr === todayLocal) todayMinutes += s.durationMinutes;
  }

  // Circle membership count
  const [circleRow] = await db
    .select({ n: count() })
    .from(circleMembersTable)
    .where(eq(circleMembersTable.userId, userId));

  res.json(GetDashboardSummaryResponse.parse({
    todayMinutes,
    weeklyMinutes,
    streakDays:         user.streakDays ?? 0,
    level:              user.level,
    xp:                 user.xp,
    xpForNextLevel:     user.xpForNextLevel,
    accuracy:           0,
    rankPercentile:     0,
    activeCircles:      Number(circleRow?.n ?? 0),
    dailyTargetMinutes: user.dailyTargetMinutes,
    activeDaysThisWeek: Array.from(activeDaySet),
    upcomingExam:       null,
  }));
});

// ─── Focus Stats: today's total focus seconds (across all rooms) ─────────────
//
// Source of truth for the "Today's focus" timer display. Sums all focus-mode
// sessions written today. The focus-room-detail page calls this on mount so
// the timer continues from the right base when hopping between rooms.
router.get("/me/focus-stats/today", async (req, res) => {
  const userId = getAuthUserId(req);

  // Respect the client's local date so IST/UTC mismatch doesn't cause "yesterday" leakage
  const localDate = typeof req.query.localDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.localDate)
    ? req.query.localDate
    : new Date().toISOString().split("T")[0];

  const sessions = await db
    .select({ startedAt: studySessionsTable.startedAt, durationMinutes: studySessionsTable.durationMinutes, mode: studySessionsTable.mode })
    .from(studySessionsTable)
    .where(and(
      eq(studySessionsTable.userId, userId),
      eq(studySessionsTable.mode, "focus"),
      gte(studySessionsTable.startedAt, new Date(Date.now() - 36 * 3600_000)),
    ));

  let todayFocusSeconds = 0;
  for (const s of sessions) {
    const dateStr = new Date(s.startedAt).toISOString().split("T")[0];
    if (dateStr === localDate) todayFocusSeconds += s.durationMinutes * 60;
  }

  res.json({ todayFocusSeconds });
});

// ─── Focus Room Member Stats: today's focus seconds for every room member ────
//
// Called once on room mount so participant cards show real DB-backed today totals
// instead of relying solely on socket broadcasts (which are 0 for members who
// haven't changed status since the viewer joined).
router.get("/focus/room-member-stats/:roomId", async (req, res) => {
  const { roomId } = req.params;
  const localDate = typeof req.query.localDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(req.query.localDate)
    ? req.query.localDate
    : new Date().toISOString().split("T")[0];

  const members = await db
    .select({ userId: focusRoomParticipantsTable.userId })
    .from(focusRoomParticipantsTable)
    .where(eq(focusRoomParticipantsTable.roomId, roomId));

  if (!members.length) { res.json([]); return; }

  const memberIds = members.map((m) => m.userId);
  const sessions = await db
    .select({ userId: studySessionsTable.userId, durationMinutes: studySessionsTable.durationMinutes, startedAt: studySessionsTable.startedAt })
    .from(studySessionsTable)
    .where(and(
      inArray(studySessionsTable.userId, memberIds),
      eq(studySessionsTable.mode, "focus"),
      gte(studySessionsTable.startedAt, new Date(Date.now() - 36 * 3600_000)),
    ));

  const byUser: Record<string, number> = {};
  for (const s of sessions) {
    const dateStr = new Date(s.startedAt).toISOString().split("T")[0];
    if (dateStr === localDate) {
      byUser[s.userId] = (byUser[s.userId] ?? 0) + s.durationMinutes * 60;
    }
  }

  res.json(memberIds.map((id) => ({ userId: id, todayFocusSeconds: byUser[id] ?? 0 })));
});

// ─── Focus Checkpoint: persist incremental session row ───────────────────────
//
// Called by focus-room-detail every 60 s while studying + once on unmount.
// Replaces the disconnect-time auto-save with incremental persistence so
// switching rooms quickly never loses data.
//
// Client posts `deltaSeconds` = seconds since the last checkpoint. Each
// checkpoint becomes one small studySessionsTable row, which is exactly the
// shape the dashboard/streak/analytics already aggregate from.
const FocusCheckpointBody = z.object({
  roomId:       z.string().max(100),
  deltaSeconds: z.number().int().positive().max(600), // max 10 min per checkpoint — caps tab-left-open abuse
});

router.post("/focus/checkpoint", async (req, res) => {
  const parsed = FocusCheckpointBody.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: parsed.error.message }); return; }
  const userId = getAuthUserId(req);

  // Round to nearest minute. Client now enforces a 30 s minimum delta before
  // calling this endpoint, so Math.round always returns ≥ 1 here. Removing
  // the old Math.max(1,...) prevents tiny deltas from inflating today totals.
  const mins = Math.round(parsed.data.deltaSeconds / 60);
  if (mins < 1) { res.json({ saved: false, durationMinutes: 0 }); return; }

  await db.insert(studySessionsTable).values({
    id: randomUUID(),
    userId,
    subjectId: "focus-room",
    mode: "focus",
    durationMinutes: mins,
    note: `Focus Room ${parsed.data.roomId.slice(0, 20)}`,
    startedAt: new Date(),
  });

  const [me] = await db
    .select({ xp: usersTable.xp, xpForNextLevel: usersTable.xpForNextLevel })
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (me) {
    const earnedXp = Math.round(mins / 5);
    await db.update(usersTable)
      .set({ xp: Math.min(me.xpForNextLevel, me.xp + earnedXp) })
      .where(eq(usersTable.id, userId));
  }

  const newStreakDays = await calculateAndUpdateStreak(userId);

  res.json({ saved: true, durationMinutes: mins, newStreakDays });
});

router.get("/dashboard/activity", privateCache(900), (_req, res): void => {
  res.json(GetRecentActivityResponse.parse(store.getActivity()));
});

router.get("/dashboard/today-goals", async (req, res) => {
  const userId = getAuthUserId(req);
  const goals = await db.select({
    id: goalsTable.id,
    userId: goalsTable.userId,
    title: goalsTable.title,
    completed: goalsTable.completed,
    xp: goalsTable.xp,
    createdAt: goalsTable.createdAt,
  }).from(goalsTable)
    .where(eq(goalsTable.userId, userId))
    .orderBy(desc(goalsTable.createdAt))
    .limit(20);
  res.json(GetTodayGoalsResponse.parse(goals));
});

router.post("/dashboard/today-goals", async (req, res) => {
  const parsed = CreateGoalBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const id = randomUUID();
  const userId = getAuthUserId(req);
  const [g] = await db.insert(goalsTable).values({
    id,
    userId,
    title: parsed.data.title,
    xp: parsed.data.xp ?? 25,
  }).returning();
  res.json(CreateGoalResponse.parse(g));
});

router.post("/dashboard/today-goals/:id/toggle", async (req, res) => {
  const params = ToggleGoalParams.safeParse({ id: idOf(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  
  const userId = getAuthUserId(req);
  const [existing] = await db.select().from(goalsTable).where(eq(goalsTable.id, params.data.id));
  if (!existing) {
    res.status(404).json({ error: "Goal not found" });
    return;
  }
  if (existing.userId !== userId) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  
  const [g] = await db.update(goalsTable)
    .set({ completed: !existing.completed })
    .where(eq(goalsTable.id, params.data.id))
    .returning();
    
  res.json(ToggleGoalResponse.parse(g));
});

// TIMER
router.get("/timer/sessions", async (req, res) => {
  const userId = getAuthUserId(req);
  const sessions = await db.select({
    id: studySessionsTable.id,
    subjectId: studySessionsTable.subjectId,
    mode: studySessionsTable.mode,
    durationMinutes: studySessionsTable.durationMinutes,
    note: studySessionsTable.note,
    startedAt: studySessionsTable.startedAt,
    subjectName: subjectsTable.name,
    subjectColor: subjectsTable.color,
  })
  .from(studySessionsTable)
  .leftJoin(subjectsTable, eq(studySessionsTable.subjectId, subjectsTable.id))
  .where(eq(studySessionsTable.userId, userId))
  .orderBy(desc(studySessionsTable.startedAt))
  .limit(50);

  const formatted = sessions.map(s => ({
    ...s,
    subjectName: s.subjectName || s.subjectId || "Unknown",
    subjectColor: s.subjectColor || "#818cf8"
  }));

  res.json(ListStudySessionsResponse.parse(formatted));
});

router.post("/timer/sessions", async (req, res) => {
  const parsed = CreateStudySessionBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = getAuthUserId(req);
  const id = randomUUID();
  const [s] = await db.insert(studySessionsTable).values({
    id,
    userId,
    subjectId: parsed.data.subjectId,
    mode: parsed.data.mode,
    durationMinutes: parsed.data.durationMinutes,
    note: parsed.data.note ?? "",
  }).returning();

  const [subj] = await db.select({
    name: subjectsTable.name,
    color: subjectsTable.color,
  }).from(subjectsTable).where(eq(subjectsTable.id, parsed.data.subjectId)).limit(1);

  const [me] = await db.select({
    xp: usersTable.xp,
    xpForNextLevel: usersTable.xpForNextLevel,
  }).from(usersTable).where(eq(usersTable.id, userId)).limit(1);
  if (me) {
    const earnedXp = Math.round(parsed.data.durationMinutes / 5);
    await db.update(usersTable)
      .set({ xp: Math.min(me.xpForNextLevel, me.xp + earnedXp) })
      .where(eq(usersTable.id, userId));
  }

  const newStreakDays = await calculateAndUpdateStreak(userId);

  res.json(CreateStudySessionResponse.parse({
    ...s,
    subjectName: subj?.name || parsed.data.subjectId || "Unknown",
    subjectColor: subj?.color || "#818cf8",
    newStreakDays,
  }));
});

router.get("/timer/subjects", async (_req, res) => {
  let subjects = await db.select({
    id: subjectsTable.id,
    name: subjectsTable.name,
    color: subjectsTable.color,
  }).from(subjectsTable);

  if (subjects.length === 0) {
    const defaultSubjects = store.listSubjects();
    for (const sub of defaultSubjects) {
      await db.insert(subjectsTable).values({
        id: sub.id,
        name: sub.name,
        color: sub.color,
      }).onConflictDoNothing();
    }
    subjects = await db.select({
      id: subjectsTable.id,
      name: subjectsTable.name,
      color: subjectsTable.color,
    }).from(subjectsTable);
  }

  const totals = await db
    .select({
      subjectId: studySessionsTable.subjectId,
      totalMinutes: sql<number>`coalesce(sum(${studySessionsTable.durationMinutes}), 0)`.mapWith(Number),
    })
    .from(studySessionsTable)
    .groupBy(studySessionsTable.subjectId);

  const minutesBySubject = new Map(totals.map((t) => [t.subjectId, t.totalMinutes]));
  const formatted = subjects.map((sub) => ({
    ...sub,
    totalMinutes: minutesBySubject.get(sub.id) ?? 0,
  }));

  res.json(ListSubjectsResponse.parse(formatted));
});

router.get("/timer/weekly", async (_req, res) => {
  const out: { day: string; minutes: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const start = new Date(Date.now() - i * 86_400_000);
    start.setHours(0, 0, 0, 0);
    out.push({ day: start.toISOString().slice(0, 10), minutes: 0 }); // Fallback to 0 for MVP
  }
  res.json(GetWeeklyStudyMinutesResponse.parse(out));
});

// CIRCLES - only show circles the user has joined
router.get("/circles", async (req, res) => {
  const userId = getAuthUserId(req);
  
  // Get circles where user is a member
  const membershipRows = await db.select()
    .from(circleMembersTable)
    .where(eq(circleMembersTable.userId, userId));
  
  if (membershipRows.length === 0) {
    res.json(ListCirclesResponse.parse([]));
    return;
  }
  
  const circleIds = membershipRows.map(m => m.circleId);
  const allCircles = await db.select().from(circlesTable).where(inArray(circlesTable.id, circleIds));

  const countRows = await db
    .select({
      circleId: circleMembersTable.circleId,
      memberCount: count(),
    })
    .from(circleMembersTable)
    .where(inArray(circleMembersTable.circleId, circleIds))
    .groupBy(circleMembersTable.circleId);

  const memberCountByCircle = new Map(countRows.map((r) => [r.circleId, Number(r.memberCount)]));

  const formatted = allCircles.map((c) => ({
    ...c,
    memberCount: memberCountByCircle.get(c.id) ?? 0,
    joined: true,
    onlineCount: 1,
  }));

  res.json(ListCirclesResponse.parse(formatted));
});

router.post("/circles", async (req, res) => {
  const parsed = CreateCircleBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  
  const id = randomUUID();
  const userId = getAuthUserId(req);
  const slug = parsed.data.name.toLowerCase().replace(/\s+/g, "-").slice(0, 40) + "-" + Date.now();
  const colors = ["#7C3AED", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#EC4899", "#3B82F6", "#8B5CF6"];
  const coverColor = colors[Math.floor(Math.random() * colors.length)]!;
  
  const [c] = await db.insert(circlesTable).values({
    id,
    name: parsed.data.name,
    slug,
    description: parsed.data.description,
    exam: parsed.data.exam,
    isPrivate: parsed.data.isPrivate,
    coverColor,
  }).returning();
  
  // Auto-create default channels for the new circle
  const defaultChannels = [
    { id: randomUUID(), circleId: id, name: "general", kind: "general", description: "General discussion for the circle" },
    { id: randomUUID(), circleId: id, name: "doubts", kind: "doubts", description: "Ask and answer doubts" },
    { id: randomUUID(), circleId: id, name: "announcements", kind: "announcements", description: "Important announcements" },
  ];
  await db.insert(channelsTable).values(defaultChannels);
  
  await db.insert(circleMembersTable).values({
    circleId: id,
    userId,
    role: "owner",
  }).onConflictDoNothing();
  
  res.json(CreateCircleResponse.parse({ ...c, memberCount: 1, joined: true, onlineCount: 1 }));
});

router.get("/circles/discover", async (req, res) => {
  const userId = getAuthUserId(req);
  // ?exam= override lets the onboarding modal preview circles before saving to DB
  const examOverride = typeof req.query.exam === "string" ? req.query.exam.toUpperCase() : null;
  const [user] = await db
    .select({ examFocus: usersTable.examFocus })
    .from(usersTable)
    .where(eq(usersTable.id, userId));
  const userExamFocus = examOverride || user?.examFocus || "GATE";

  const relevantCircles = await db
    .select()
    .from(circlesTable)
    .where(and(eq(circlesTable.exam, userExamFocus), eq(circlesTable.isPrivate, false)))
    .limit(30);

  if (relevantCircles.length === 0) {
    res.json(DiscoverCirclesResponse.parse([]));
    return;
  }

  const circleIds = relevantCircles.map((c) => c.id);

  const countRows = await db
    .select({
      circleId: circleMembersTable.circleId,
      memberCount: count(),
    })
    .from(circleMembersTable)
    .where(inArray(circleMembersTable.circleId, circleIds))
    .groupBy(circleMembersTable.circleId);

  const myMemberships = await db
    .select({ circleId: circleMembersTable.circleId })
    .from(circleMembersTable)
    .where(
      and(
        eq(circleMembersTable.userId, userId),
        inArray(circleMembersTable.circleId, circleIds),
      ),
    );

  const memberCountByCircle = new Map(countRows.map((r) => [r.circleId, Number(r.memberCount)]));
  const joinedSet = new Set(myMemberships.map((m) => m.circleId));

  const formatted = relevantCircles.map((c) => ({
    ...c,
    memberCount: memberCountByCircle.get(c.id) || 0,
    joined: joinedSet.has(c.id),
    onlineCount: 1,
  }));

  res.json(DiscoverCirclesResponse.parse(formatted));
});

router.get("/circles/:id", async (req, res) => {
  const circleId = String(req.params.id);

  const [circle] = await db.select().from(circlesTable).where(eq(circlesTable.id, circleId));
  if (!circle) {
    res.status(404).json({ error: "Circle not found" });
    return;
  }
  
  const userId = getAuthUserId(req);
  
  // Check if user is a member
  const [membership] = await db.select().from(circleMembersTable)
    .where(and(eq(circleMembersTable.circleId, circleId), eq(circleMembersTable.userId, userId)));
  const isMember = !!membership;
  if (!isMember) {
    res.status(403).json({ error: "You must join this circle first" });
    return;
  }
  
  // Get ALL members of this circle with user details
  const memberRows = await db.select({
    circleId: circleMembersTable.circleId,
    role: circleMembersTable.role,
    joinedAt: circleMembersTable.joinedAt,
    userId: usersTable.id,
    displayName: usersTable.displayName,
    handle: usersTable.handle,
    avatarUrl: usersTable.avatarUrl,
    level: usersTable.level,
  })
  .from(circleMembersTable)
  .leftJoin(usersTable, eq(circleMembersTable.userId, usersTable.id))
  .where(eq(circleMembersTable.circleId, circleId));
  
  // Get online users from the socket presence
  const onlineUserIds = getOnlineUsers(circleId);
  
  const members = memberRows.map(m => {
    let mappedRole: "owner" | "mod" | "member" = "member";
    if (m.role === "owner") mappedRole = "owner";
    else if (m.role && ["co-owner", "co-leader", "moderator"].includes(m.role)) mappedRole = "mod";

    return {
      userId: m.userId || "",
      displayName: m.displayName || "Unknown User",
      handle: m.handle || m.displayName?.replace(/\s+/g, "").toLowerCase() || "unknown",
      avatarUrl: m.avatarUrl || "",
      level: m.level || 1,
      role: mappedRole,
      online: onlineUserIds.has(m.userId || ""),
    };
  });
  
  // Get channels for this circle
  const chans = await db.select().from(channelsTable).where(eq(channelsTable.circleId, circleId));
  const formattedChannels = chans.map(c => ({ ...c, unread: 0 }));
  
  res.json(GetCircleResponse.parse({
    ...circle,
    memberCount: members.length,
    joined: isMember,
    onlineCount: members.filter(m => m.online).length,
    members,
    channels: formattedChannels,
  }));
});

router.post("/circles/:id/join", async (req, res) => {
  const params = JoinCircleParams.safeParse({ id: idOf(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  
  const [circle] = await db.select().from(circlesTable).where(eq(circlesTable.id, params.data.id));
  if (!circle) {
    res.status(404).json({ error: "Circle not found" });
    return;
  }
  
  const userId = getAuthUserId(req);
  await db.insert(circleMembersTable).values({
    circleId: params.data.id,
    userId,
    role: "member",
  }).onConflictDoNothing();
  
  const [{ memberCount: memberCountNum }] = await db
    .select({ memberCount: count() })
    .from(circleMembersTable)
    .where(eq(circleMembersTable.circleId, params.data.id));
  
  res.json(JoinCircleResponse.parse({
    ...circle,
    memberCount: Number(memberCountNum) || 1,
    joined: true,
    onlineCount: 1,
  }));
});

// UPDATE CIRCLE SETTINGS (owner only)
const updateCircleSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  coverColor: z.string().max(30).optional(),
});

router.patch("/circles/:circleId", async (req, res) => {
  const circleId = String(req.params.circleId);
  const parsed = updateCircleSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.message });
  }
  const { name, description, coverColor } = parsed.data;
  const requesterId = getAuthUserId(req);

  // Verify requester is the owner
  const [requesterMembership] = await db.select().from(circleMembersTable)
    .where(and(eq(circleMembersTable.circleId, circleId), eq(circleMembersTable.userId, requesterId)));
  
  if (!requesterMembership || requesterMembership.role !== "owner") {
    return res.status(403).json({ error: "Only the circle owner can update settings" });
  }

  const updateData: any = {};
  if (name !== undefined) updateData.name = name;
  if (description !== undefined) updateData.description = description;
  if (coverColor !== undefined) updateData.coverColor = coverColor;

  if (Object.keys(updateData).length > 0) {
    await db.update(circlesTable)
      .set(updateData)
      .where(eq(circlesTable.id, circleId));
  }

  res.json({ success: true });
});

// UPDATE MEMBER ROLE (owner only)
router.patch("/circles/:circleId/members/:userId", async (req, res) => {
  const circleId = String(req.params.circleId);
  const targetUserId = String(req.params.userId);
  const { role } = req.body;
  const requesterId = getAuthUserId(req);
  
  const validRoles = ["co-owner", "co-leader", "moderator", "legend", "elder", "member"];
  if (!role || !validRoles.includes(role)) {
    return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(", ")}` });
  }
  
  // Verify requester is the owner
  const [requesterMembership] = await db.select().from(circleMembersTable)
    .where(and(eq(circleMembersTable.circleId, circleId), eq(circleMembersTable.userId, requesterId)));
  
  if (!requesterMembership || requesterMembership.role !== "owner") {
    return res.status(403).json({ error: "Only the circle owner can change roles" });
  }
  
  // Can't change owner's own role
  if (targetUserId === requesterId) {
    return res.status(400).json({ error: "Cannot change your own role" });
  }
  
  // Update the member's role
  await db.update(circleMembersTable)
    .set({ role })
    .where(and(eq(circleMembersTable.circleId, circleId), eq(circleMembersTable.userId, targetUserId)));
  
  res.json({ success: true, role });
});

// KICK MEMBER (owner/co-owner only)
router.delete("/circles/:circleId/members/:userId", async (req, res) => {
  const circleId = String(req.params.circleId);
  const targetUserId = String(req.params.userId);
  const requesterId = getAuthUserId(req);
  
  // Verify requester is the owner or co-owner
  const [requesterMembership] = await db.select().from(circleMembersTable)
    .where(and(eq(circleMembersTable.circleId, circleId), eq(circleMembersTable.userId, requesterId)));
  
  if (!requesterMembership || !["owner", "co-owner"].includes(requesterMembership.role)) {
    return res.status(403).json({ error: "Only the owner or co-owner can kick members" });
  }
  
  // Can't kick yourself or the owner
  if (targetUserId === requesterId) {
    return res.status(400).json({ error: "Cannot kick yourself" });
  }
  
  const [targetMembership] = await db.select().from(circleMembersTable)
    .where(and(eq(circleMembersTable.circleId, circleId), eq(circleMembersTable.userId, targetUserId)));
  
  if (targetMembership?.role === "owner") {
    return res.status(400).json({ error: "Cannot kick the owner" });
  }
  
  await db.delete(circleMembersTable)
    .where(and(eq(circleMembersTable.circleId, circleId), eq(circleMembersTable.userId, targetUserId)));
  
  res.json({ success: true });
});

// ── INVITE LINKS ─────────────────────────────────────────────────────────────

// Create an invite link (owner/mod only)
router.post("/circles/:circleId/invites", async (req, res) => {
  const circleId = String(req.params.circleId);
  const requesterId = getAuthUserId(req);

  const [membership] = await db.select().from(circleMembersTable)
    .where(and(eq(circleMembersTable.circleId, circleId), eq(circleMembersTable.userId, requesterId)));
  
  if (!membership) {
    return res.status(403).json({ error: "Only members can create invites" });
  }

  const code = randomUUID().replace(/-/g, "").substring(0, 10); // short code e.g. a3f8c2d1b0
  const [invite] = await db.insert(circleInvitesTable).values({
    id: randomUUID(),
    circleId,
    code,
    createdBy: requesterId,
  }).returning();

  res.json({ code: invite.code, url: `/invite/${invite.code}` });
});

// Use/redeem an invite (authenticated)
router.post("/invite/:code/join", async (req, res) => {
  const code = String(req.params.code);
  const userId = getAuthUserId(req);

  const [invite] = await db.select().from(circleInvitesTable).where(eq(circleInvitesTable.code, code));
  if (!invite) return res.status(404).json({ error: "Invite not found" });
  if (invite.expiresAt && new Date() > invite.expiresAt) return res.status(410).json({ error: "Invite expired" });
  if (invite.maxUses && invite.uses >= invite.maxUses) return res.status(410).json({ error: "Invite has reached max uses" });

  const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!existingUser) {
    const shortId = userId.replace(/[^a-zA-Z0-9]/g, "").substring(0, 20);
    await db.insert(usersTable).values({
      id: userId,
      displayName: "New User",
      handle: `user_${shortId}`,
      avatarUrl: "",
      examFocus: "GATE",
    }).onConflictDoNothing();
  }

  const [existingMember] = await db.select().from(circleMembersTable).where(
    and(eq(circleMembersTable.circleId, invite.circleId), eq(circleMembersTable.userId, userId))
  );

  if (!existingMember) {
    await db.insert(circleMembersTable).values({
      circleId: invite.circleId,
      userId,
      role: "member",
    });

    // Increment uses
    await db.update(circleInvitesTable)
      .set({ uses: invite.uses + 1 })
      .where(eq(circleInvitesTable.id, invite.id));
  }

  res.json({ circleId: invite.circleId, success: true, alreadyJoined: !!existingMember });
});

// CHANNELS
router.get("/circles/:id/channels", async (req, res) => {
  const params = ListCircleChannelsParams.safeParse({ id: idOf(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = getAuthUserId(req);
  if (!(await isCircleMember(params.data.id, userId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const chans = await db.select().from(channelsTable).where(eq(channelsTable.circleId, params.data.id));
  const formatted = chans.map(c => ({ ...c, unread: 0 }));
  res.json(ListCircleChannelsResponse.parse(formatted));
});

router.post("/circles/:id/channels", async (req, res) => {
  const circleId = idOf(req.params.id);
  const userId = getAuthUserId(req);
  
  const [membership] = await db.select().from(circleMembersTable)
    .where(and(eq(circleMembersTable.circleId, circleId), eq(circleMembersTable.userId, userId)));
    
  if (!membership || !["owner", "co-owner", "co-leader", "moderator"].includes(membership.role)) {
    res.status(403).json({ error: "Only circle moderators can create channels" });
    return;
  }
  
  const parsed = z.object({
    name: z.string().min(1).max(100),
    kind: z.string().min(1).max(30),
    description: z.string().max(500).optional(),
  }).safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const { name, kind, description } = parsed.data;
  const [newChannel] = await db.insert(channelsTable).values({
    id: randomUUID(),
    circleId,
    name: name.toLowerCase().replace(/\s+/g, '-'),
    kind,
    description: description || ""
  }).returning();
  res.json({ ...newChannel, unread: 0 });
});

router.get("/channels/:id/messages", async (req, res) => {
  const params = ListChannelMessagesParams.safeParse({ id: idOf(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const userId = getAuthUserId(req);
  if (!(await isChannelMember(params.data.id, userId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }
  const msgs = await db.select({
    id: messagesTable.id,
    channelId: messagesTable.channelId,
    authorId: messagesTable.authorId,
    body: messagesTable.body,
    createdAt: messagesTable.createdAt,
    updatedAt: messagesTable.updatedAt,
    pinned: messagesTable.pinned,
    authorName: usersTable.displayName,
    authorAvatar: usersTable.avatarUrl,
    replyToId: messagesTable.replyToId,
    replyToAuthorName: parentUserTable.displayName,
    replyToBody: parentMessageTable.body,
  })
  .from(messagesTable)
  .leftJoin(usersTable, eq(messagesTable.authorId, usersTable.id))
  .leftJoin(parentMessageTable, eq(messagesTable.replyToId, parentMessageTable.id))
  .leftJoin(parentUserTable, eq(parentMessageTable.authorId, parentUserTable.id))
  .where(eq(messagesTable.channelId, params.data.id))
  .orderBy(desc(messagesTable.createdAt))
  .limit(100);

  const formatted = [...msgs].reverse().map(m => ({
    ...m,
    authorName: m.authorName || "Unknown User",
    authorAvatar: m.authorAvatar || "",
    reactions: [] as any[]
  }));

  if (formatted.length > 0) {
    const allReactions = await db.select()
      .from(messageReactionsTable)
      .where(inArray(messageReactionsTable.messageId, formatted.map(f => f.id)));
      
    formatted.forEach(m => {
      const msgReactions = allReactions.filter(r => r.messageId === m.id);
      const groups = msgReactions.reduce((acc, curr) => {
        if (!acc[curr.emoji]) acc[curr.emoji] = { count: 0, mine: false };
        acc[curr.emoji].count++;
        if (curr.authorId === userId) acc[curr.emoji].mine = true;
        return acc;
      }, {} as Record<string, {count: number, mine: boolean}>);
      
      m.reactions = Object.entries(groups).map(([emoji, data]) => ({
        emoji,
        count: data.count,
        mine: data.mine
      }));
    });
  }

  res.json(ListChannelMessagesResponse.parse(formatted));
});

router.post("/messages/:id/reactions", async (req, res) => {
  const { id } = req.params;
  const parsed = z.object({ emoji: z.string().min(1).max(16) }).safeParse(req.body);
  if (!id || !parsed.success) {
    return res.status(400).json({ error: "Missing or invalid fields" });
  }
  const { emoji } = parsed.data;

  const userIdentifier = getAuthUserId(req);
  const channelId = await getMessageChannelId(id);
  if (!channelId || !(await isChannelMember(channelId, userIdentifier))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const existing = await db.select().from(messageReactionsTable).where(
    and(
      eq(messageReactionsTable.messageId, id),
      eq(messageReactionsTable.authorId, userIdentifier),
      eq(messageReactionsTable.emoji, emoji)
    )
  );

  if (existing.length > 0) {
    await db.delete(messageReactionsTable).where(eq(messageReactionsTable.id, existing[0].id));
  } else {
    await db.insert(messageReactionsTable).values({
      id: randomUUID(),
      messageId: id,
      authorId: userIdentifier,
      emoji,
    });
  }

  const [msg] = await db
    .select({ channelId: messagesTable.channelId })
    .from(messagesTable)
    .where(eq(messagesTable.id, id));

  if (msg) {
    const allReactions = await db
      .select({
        emoji: messageReactionsTable.emoji,
        authorId: messageReactionsTable.authorId,
      })
      .from(messageReactionsTable)
      .where(eq(messageReactionsTable.messageId, id));

    const groups = allReactions.reduce(
      (acc, curr) => {
        if (!acc[curr.emoji]) acc[curr.emoji] = { count: 0, mine: false };
        acc[curr.emoji].count++;
        if (curr.authorId === userIdentifier) acc[curr.emoji].mine = true;
        return acc;
      },
      {} as Record<string, { count: number; mine: boolean }>,
    );

    const reactions = Object.entries(groups).map(([reactionEmoji, data]) => ({
      emoji: reactionEmoji,
      count: data.count,
      mine: data.mine,
    }));

    try {
      getIO().to(`channel_${msg.channelId}`).emit("message:reactions", { messageId: id, reactions });
    } catch (_e) {
      /* socket optional */
    }
  }

  res.status(200).json({ success: true });
});

// Pin/Unpin a message
router.patch("/messages/:id/pin", async (req, res) => {
  const { id } = req.params;
  const userId = getAuthUserId(req);
  const [msg] = await db.select().from(messagesTable).where(eq(messagesTable.id, id));
  if (!msg) return res.status(404).json({ error: "Message not found" });

  const circleId = await getChannelCircleId(msg.channelId);
  if (!circleId || !(await canModerateCircle(circleId, userId))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  
  const newPinnedState = !msg.pinned;
  await db.update(messagesTable).set({ pinned: newPinnedState }).where(eq(messagesTable.id, id));
  
  try {
    getIO().to(`channel_${msg.channelId}`).emit("message:edit", { id, pinned: newPinnedState });
  } catch (e) {}

  res.json({ success: true, pinned: newPinnedState });
});

// Search messages in a channel
router.get("/channels/:id/messages/search", async (req, res) => {
  const channelId = String(req.params.id);
  const q = String(req.query.q || "");
  const userId = getAuthUserId(req);
  if (!(await isChannelMember(channelId, userId))) {
    return res.status(403).json({ error: "Forbidden" });
  }
  
  if (!q) return res.json({ messages: [] });

  const results = await db.select({
    id: messagesTable.id,
    channelId: messagesTable.channelId,
    body: messagesTable.body,
    createdAt: messagesTable.createdAt,
    updatedAt: messagesTable.updatedAt,
    pinned: messagesTable.pinned,
    author: {
      id: usersTable.id,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
    }
  })
  .from(messagesTable)
  .leftJoin(usersTable, eq(messagesTable.authorId, usersTable.id))
  .where(
    and(
      eq(messagesTable.channelId, channelId),
      ilike(messagesTable.body, `%${q}%`)
    )
  )
  .orderBy(desc(messagesTable.createdAt))
  .limit(20);

  res.json({ messages: results });
});

router.post("/channels/:id/messages", async (req, res) => {
  const params = SendChannelMessageParams.safeParse({ id: idOf(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = SendChannelMessageBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  
  const id = randomUUID();
  const userId = getAuthUserId(req);

  if (!(await isChannelMember(params.data.id, userId))) {
    res.status(403).json({ error: "Forbidden" });
    return;
  }

  const [existingUser] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  if (!existingUser) {
    const shortId = userId.replace(/[^a-zA-Z0-9]/g, "").substring(0, 20);
    await db.insert(usersTable).values({
      id: userId,
      displayName: "New User",
      handle: `user_${shortId}`,
      avatarUrl: "",
      examFocus: "GATE",
    }).onConflictDoNothing();
  }
  
  const [m] = await db.insert(messagesTable).values({
    id,
    channelId: params.data.id,
    authorId: userId,
    body: body.data.body,
  }).returning();
  
  const [me] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  
  const formattedMsg = SendChannelMessageResponse.parse({
    ...m,
    authorName: me?.displayName || "Unknown",
    authorAvatar: me?.avatarUrl || "",
    reactions: []
  });
  
  getIO().to(`channel_${params.data.id}`).emit("message:new", formattedMsg);
  
  res.json(formattedMsg);
});

router.post("/messages/:id/react", (req, res): void => {
  const userId = getAuthUserId(req);
  // Mocked for MVP to prevent crashing, real reaction system requires a reaction mapping table
  const params = ReactToMessageParams.safeParse({ id: idOf(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  res.json(ReactToMessageResponse.parse({
    id: params.data.id,
    channelId: "c_gen",
    authorId: userId,
    authorName: "User",
    authorAvatar: "",
    body: "",
    createdAt: new Date(),
    pinned: false,
    reactions: [{ emoji: "🔥", count: 1, mine: true }]
  }));
});

router.put("/messages/:id", async (req, res) => {
  const { id } = req.params;
  const parsed = z.object({ body: z.string().min(1).max(4000) }).safeParse(req.body);
  const userId = getAuthUserId(req);

  if (!id || !parsed.success) return res.status(400).json({ error: "Missing or invalid fields" });
  const { body } = parsed.data;
  
  const [updated] = await db.update(messagesTable)
    .set({ body, updatedAt: new Date() })
    .where(and(eq(messagesTable.id, id), eq(messagesTable.authorId, userId))) // Security: only update own
    .returning();
    
  if (!updated) return res.status(404).json({ error: "Message not found or not authorized" });
  
  getIO().to(`channel_${updated.channelId}`).emit("message:edit", updated);
  
  res.json(updated);
});

router.delete("/messages/:id", async (req, res) => {
  const { id } = req.params;
  const userId = getAuthUserId(req);
  
  if (!id) return res.status(400).json({ error: "Missing required fields" });
  
  // Need to delete reactions first due to foreign key constraint
  await db.delete(messageReactionsTable).where(eq(messageReactionsTable.messageId, id));
  
  const [deleted] = await db.delete(messagesTable)
    .where(and(eq(messagesTable.id, id), eq(messagesTable.authorId, userId))) // Security: only delete own
    .returning();
    
  if (!deleted) return res.status(404).json({ error: "Message not found or not authorized" });
  
  getIO().to(`channel_${deleted.channelId}`).emit("message:delete", { id, channelId: deleted.channelId });
  
  res.json({ success: true });
});

// FOCUS ROOMS — backed by Postgres for permanent persistence
// Optional-auth middleware: reads token if present but never blocks
const optionalAuth: import("express").RequestHandler = async (req, _res, next) => {
  const auth = req.headers.authorization;
  if (auth?.startsWith("Bearer ")) {
    try {
      const { verifyClerkToken } = await import("../middleware/auth");
      req.auth = { userId: await verifyClerkToken(auth.slice(7)) };
    } catch { /* ignore invalid tokens */ }
  }
  next();
};

router.get("/focus-rooms/my-rooms", requireAuth, async (req, res): Promise<void> => {
  try {
    const userId = getAuthUserId(req);
    const myRoomRows = await db
      .select({ roomId: focusRoomParticipantsTable.roomId })
      .from(focusRoomParticipantsTable)
      .where(eq(focusRoomParticipantsTable.userId, userId));

    if (myRoomRows.length === 0) { res.json([]); return; }

    const rooms = await db
      .select({
        id: focusRoomsTable.id,
        name: focusRoomsTable.name,
        accentColor: focusRoomsTable.accentColor,
        exam: focusRoomsTable.exam,
      })
      .from(focusRoomsTable)
      .where(inArray(focusRoomsTable.id, myRoomRows.map((r) => r.roomId)));

    res.json(rooms);
  } catch (e) {
    res.status(500).json({ error: "Failed to fetch rooms" });
  }
});

router.get("/focus-rooms", optionalAuth, async (req, res): Promise<void> => {
  try {
    const userId = getOptionalAuthUserId(req);
    // List public rooms + private rooms where the user is a participant
    const rooms = await db
      .select({
        id: focusRoomsTable.id,
        name: focusRoomsTable.name,
        description: focusRoomsTable.description,
        hostName: focusRoomsTable.hostName,
        hostAvatar: focusRoomsTable.hostAvatar,
        mode: focusRoomsTable.mode,
        maxParticipants: focusRoomsTable.maxParticipants,
        isPrivate: focusRoomsTable.isPrivate,
        isLive: focusRoomsTable.isLive,
        exam: focusRoomsTable.exam,
        accentColor: focusRoomsTable.accentColor,
        createdAt: focusRoomsTable.createdAt,
      })
      .from(focusRoomsTable)
      .where(eq(focusRoomsTable.isLive, true))
      .orderBy(desc(focusRoomsTable.lastActivityAt));

    // Get participant counts
    const participantCounts = await db
      .select({
        roomId: focusRoomParticipantsTable.roomId,
        count: count(focusRoomParticipantsTable.userId),
      })
      .from(focusRoomParticipantsTable)
      .groupBy(focusRoomParticipantsTable.roomId);

    const countMap = new Map(participantCounts.map(r => [r.roomId, Number(r.count)]));

    // Filter: public rooms always visible; private only visible if you're in them or are host
    const participantRoomIds = userId
      ? (await db.select({ roomId: focusRoomParticipantsTable.roomId })
          .from(focusRoomParticipantsTable)
          .where(eq(focusRoomParticipantsTable.userId, userId)))
          .map(r => r.roomId)
      : [];

    const filtered = rooms.filter(r =>
      !r.isPrivate || participantRoomIds.includes(r.id)
    );

    // Get active users for these filtered rooms
    const activeParticipants = await db
      .select({
        roomId: focusRoomParticipantsTable.roomId,
        displayName: focusRoomParticipantsTable.displayName,
        avatarUrl: focusRoomParticipantsTable.avatarUrl,
        joinedAt: focusRoomParticipantsTable.joinedAt,
      })
      .from(focusRoomParticipantsTable);
    
    // Group active participants by room ID
    const activeUsersMap = new Map<string, { displayName: string, avatarUrl: string }[]>();
    for (const p of activeParticipants) {
      if (!activeUsersMap.has(p.roomId)) {
        activeUsersMap.set(p.roomId, []);
      }
      const list = activeUsersMap.get(p.roomId)!;
      if (list.length < 5) {
        list.push({ displayName: p.displayName, avatarUrl: p.avatarUrl });
      }
    }


    const result = filtered.map(r => ({
      id: r.id,
      name: r.name,
      description: r.description,
      hostName: r.hostName,
      hostAvatar: r.hostAvatar,
      mode: r.mode as "silent" | "voice" | "video",
      participantCount: countMap.get(r.id) ?? 0,
      maxParticipants: r.maxParticipants,
      isLive: r.isLive,
      isPrivate: r.isPrivate,
      silentMode: r.mode === "silent",
      exam: r.exam,
      focusMinutesElapsed: 0,
      totalParticipantMinutes: 0,
      accentColor: r.accentColor,
      activeUsers: activeUsersMap.get(r.id) || [],
    }));

    res.json(ListFocusRoomsResponse.parse(result));
  } catch (e) {
    console.error("list focus rooms error", e);
    res.status(500).json({ error: "Failed to list rooms" });
  }
});

router.post("/focus-rooms", requireAuth, async (req, res): Promise<void> => {
  const parsed = CreateFocusRoomBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  try {
    const authUserId = getAuthUserId(req);
    const colors = ["#7C3AED", "#06B6D4", "#10B981", "#F59E0B", "#EF4444", "#EC4899"];
    const id = randomUUID();
    const hostId = authUserId;
    const accentColor = colors[Math.floor(Math.random() * colors.length)];

    await db.insert(focusRoomsTable).values({
      id,
      name: parsed.data.name,
      description: parsed.data.description || "",
      hostId,
      hostName: parsed.data.hostName,
      hostAvatar: parsed.data.hostAvatar,
      mode: parsed.data.mode,
      maxParticipants: parsed.data.maxParticipants,
      isPrivate: parsed.data.isPrivate ?? false,
      exam: parsed.data.exam,
      accentColor,
      isLive: true,
      linkedCircleId: parsed.data.linkedCircleId ?? null,
    });

    await ensureAuthUserInDb(hostId, parsed.data.hostName, parsed.data.hostAvatar);

    // Auto-add host as first participant
    await db.insert(focusRoomParticipantsTable).values({
      roomId: id,
      userId: hostId,
      displayName: parsed.data.hostName,
      avatarUrl: parsed.data.hostAvatar,
      totalStudySeconds: 0,
    }).onConflictDoNothing();

    const createdRow = {
      id,
      name: parsed.data.name,
      description: parsed.data.description || "",
      hostId,
      hostName: parsed.data.hostName,
      hostAvatar: parsed.data.hostAvatar,
      mode: parsed.data.mode,
      maxParticipants: parsed.data.maxParticipants,
      isPrivate: parsed.data.isPrivate ?? false,
      exam: parsed.data.exam,
      accentColor,
      isLive: true,
      isChatEnabled: true,
      linkedCircleId: parsed.data.linkedCircleId ?? null,
      createdAt: new Date(),
      lastActivityAt: new Date(),
    };
    ensureInMemoryFocusRoom(createdRow);
    store.joinFocusRoom(id, {
      userId: hostId,
      displayName: parsed.data.hostName,
      avatarUrl: parsed.data.hostAvatar,
      status: "idle",
      totalStudySeconds: 0,
    });

    const room = {
      id,
      name: parsed.data.name,
      description: parsed.data.description || "",
      hostName: parsed.data.hostName,
      hostAvatar: parsed.data.hostAvatar,
      mode: parsed.data.mode as "silent" | "voice" | "video",
      participantCount: 1,
      maxParticipants: parsed.data.maxParticipants,
      isLive: true,
      isPrivate: parsed.data.isPrivate ?? false,
      silentMode: parsed.data.mode === "silent",
      exam: parsed.data.exam,
      focusMinutesElapsed: 0,
      totalParticipantMinutes: 0,
      accentColor,
    };

    res.json(CreateFocusRoomResponse.parse(room));
  } catch (e) {
    console.error("create focus room error", e);
    res.status(500).json({ error: "Failed to create room" });
  }
});

router.get("/focus-rooms/:id", requireAuth, async (req, res): Promise<void> => {
  try {
    const roomId = req.params.id;
    const authUserId = getOptionalAuthUserId(req);
    const room = await getFocusRoomRow(roomId);
    if (!room) {
      res.status(404).json({ error: "Focus room not found" });
      return;
    }

    ensureInMemoryFocusRoom(room);
    const inMem = store.getFocusRoom(roomId);

    const participants = await db
      .select({
        userId: focusRoomParticipantsTable.userId,
        displayName: focusRoomParticipantsTable.displayName,
        avatarUrl: focusRoomParticipantsTable.avatarUrl,
        totalStudySeconds: focusRoomParticipantsTable.totalStudySeconds,
        status: focusRoomParticipantsTable.status,
        currentTask: focusRoomParticipantsTable.currentTask,
        isTaskPrivate: focusRoomParticipantsTable.isTaskPrivate,
        activeAvatarId: usersTable.activeAvatarId,
      })
      .from(focusRoomParticipantsTable)
      .leftJoin(usersTable, eq(focusRoomParticipantsTable.userId, usersTable.id))
      .where(eq(focusRoomParticipantsTable.roomId, roomId));

    // In-memory status takes priority (live); DB status is the fallback on cold load
    const inMemoryRoom = store.getFocusRoom(roomId);
    const fullParticipants = participants.map(p => {
      const memP = inMemoryRoom?.participants.find(mp => mp.userId === p.userId);
      const rawStatus = memP?.status ?? p.status ?? "idle";
      const status = (rawStatus === "offline" ? "idle" : rawStatus) as "focusing" | "break" | "idle" | "studying";
      const totalStudySeconds = Math.max(memP?.totalStudySeconds ?? 0, p.totalStudySeconds ?? 0);
      const resolvedAvatar = p.activeAvatarId
        ? `/avatars/${p.activeAvatarId}.png`
        : (p.avatarUrl ?? "");
      return {
        userId: p.userId,
        displayName: p.displayName,
        avatarUrl: resolvedAvatar,
        micOn: memP?.micOn ?? false,
        cameraOn: memP?.cameraOn ?? false,
        status,
        focusMinutes: Math.floor(totalStudySeconds / 60),
        totalStudySeconds,
        lastStatusChangeAt: memP?.lastStatusChangeAt,
        role: (p.userId === room.hostId ? "owner" : "member") as "owner" | "member",
        // In-memory task takes priority (just typed); DB task is fallback on page refresh
        currentTask: memP?.currentTask ?? p.currentTask ?? undefined,
        isTaskPrivate: memP?.isTaskPrivate ?? p.isTaskPrivate ?? false,
      };
    });

    // Today's study time aggregation (midnight UTC)
    const todayMidnight = new Date();
    todayMidnight.setUTCHours(0, 0, 0, 0);
    const allUserIds = [...new Set([...participants.map(p => p.userId), ...(authUserId ? [authUserId] : [])])];
    const todayTotals = allUserIds.length > 0
      ? await db
          .select({
            userId: studySessionsTable.userId,
            todayMinutes: sql<number>`coalesce(sum(${studySessionsTable.durationMinutes}), 0)`,
          })
          .from(studySessionsTable)
          .where(and(inArray(studySessionsTable.userId, allUserIds), gte(studySessionsTable.startedAt, todayMidnight)))
          .groupBy(studySessionsTable.userId)
      : [];
    const todayMap = new Map(todayTotals.map(r => [r.userId, Math.round(Number(r.todayMinutes) * 60)]));
    const myTodayStudySeconds = authUserId ? (todayMap.get(authUserId) ?? 0) : 0;

    const fullParticipantsWithToday = fullParticipants.map(p => ({
      ...p,
      todayStudySeconds: todayMap.get(p.userId) ?? 0,
    }));

    const liveTimer = inMem?.sharedTimer;
    const result = {
      id: room.id,
      name: room.name,
      description: room.description,
      hostId: room.hostId,
      hostName: room.hostName,
      hostAvatar: room.hostAvatar,
      mode: room.mode as "silent" | "voice" | "video",
      participantCount: participants.length,
      maxParticipants: room.maxParticipants,
      isLive: room.isLive,
      isPrivate: room.isPrivate,
      silentMode: room.mode === "silent",
      exam: room.exam,
      isChatEnabled: inMem?.isChatEnabled ?? room.isChatEnabled,
      linkedCircleId: room.linkedCircleId ?? undefined,
      focusMinutesElapsed: 0,
      totalParticipantMinutes: Math.floor(participants.reduce((s, p) => s + (p.totalStudySeconds ?? 0), 0) / 60),
      accentColor: room.accentColor,
      myTodayStudySeconds,
      participants: fullParticipantsWithToday,
      sharedTimer: liveTimer ?? {
        mode: "stopwatch" as const,
        totalSeconds: 0,
        remainingSeconds: 0,
        label: "Session",
      },
    };

    res.json(GetFocusRoomResponse.parse(result));
  } catch (e) {
    console.error("get focus room error", e);
    res.status(500).json({ error: "Failed to load room" });
  }
});

router.post("/focus-rooms/:id/join", async (req, res): Promise<void> => {
  try {
    const roomId = req.params.id;
    const userId = getAuthUserId(req);
    const body = JoinFocusRoomBody.safeParse(req.body);
    if (!body.success) {
      res.status(400).json({ error: body.error.message });
      return;
    }

    const room = await getFocusRoomRow(roomId);
    if (!room) {
      res.status(404).json({ error: "Focus room not found" });
      return;
    }

    ensureInMemoryFocusRoom(room);

    const alreadyMember = await isFocusRoomMember(roomId, userId);
    const participantCount = await countFocusRoomParticipants(roomId);

    if (!alreadyMember && participantCount >= room.maxParticipants) {
      res.status(400).json({ error: "Room is full" });
      return;
    }

    const displayName = body.data.displayName?.trim() || "Anonymous";
    const avatarUrl = body.data.avatarUrl ?? "";

    await ensureAuthUserInDb(userId, displayName, avatarUrl);

    if (alreadyMember) {
      await db
        .update(focusRoomParticipantsTable)
        .set({ displayName, avatarUrl })
        .where(
          and(
            eq(focusRoomParticipantsTable.roomId, roomId),
            eq(focusRoomParticipantsTable.userId, userId),
          ),
        );
    } else {
      await db.insert(focusRoomParticipantsTable).values({
        roomId,
        userId,
        displayName,
        avatarUrl,
        totalStudySeconds: 0,
      });
    }

    await db.update(focusRoomsTable)
      .set({ lastActivityAt: new Date() })
      .where(eq(focusRoomsTable.id, roomId));

    store.joinFocusRoom(roomId, {
      userId,
      displayName,
      avatarUrl,
      status: "idle",
      totalStudySeconds: 0,
    });

    const updatedCount = alreadyMember ? participantCount : participantCount + 1;
    const result = {
      id: room.id,
      name: room.name,
      description: room.description,
      hostName: room.hostName,
      hostAvatar: room.hostAvatar,
      mode: room.mode as "silent" | "voice" | "video",
      participantCount: updatedCount,
      maxParticipants: room.maxParticipants,
      isLive: room.isLive,
      isPrivate: room.isPrivate,
      silentMode: room.mode === "silent",
      exam: room.exam,
      focusMinutesElapsed: 0,
      totalParticipantMinutes: 0,
      accentColor: room.accentColor,
    };

    res.json(JoinFocusRoomResponse.parse(result));
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("join focus room error", e);
    res.status(500).json({ error: "Failed to join room", detail: message });
  }
});

router.post("/focus-rooms/:id/leave", async (req, res): Promise<void> => {
  try {
    const roomId = req.params.id;
    const userId = getAuthUserId(req);
    const room = await loadAndEnsureFocusRoom(roomId);
    if (!room) {
      res.status(404).json({ error: "Focus room not found" });
      return;
    }
    const mem = store.getFocusRoom(roomId);
    const secs = mem?.participants.find((p) => p.userId === userId)?.totalStudySeconds;
    if (secs !== undefined) {
      const { persistFocusRoomParticipantSeconds } = await import("../lib/focus-room-persist");
      await persistFocusRoomParticipantSeconds(roomId, userId, secs);
    }
    await db
      .delete(focusRoomParticipantsTable)
      .where(
        and(
          eq(focusRoomParticipantsTable.roomId, roomId),
          eq(focusRoomParticipantsTable.userId, userId),
        ),
      );
    store.leaveFocusRoom(roomId, userId);
    res.json({ success: true });
  } catch (e) {
    console.error("leave focus room error", e);
    res.status(500).json({ error: "Failed to leave room" });
  }
});

// Post a study milestone activity card to the linked circle's #general channel
router.post("/focus-rooms/:id/post-activity", requireAuth, async (req, res): Promise<void> => {
  try {
    const roomId = req.params.id;
    const userId = getAuthUserId(req);
    const milestone = req.body?.milestone as number | undefined;
    if (milestone !== 5 && milestone !== 9) {
      res.status(400).json({ error: "milestone must be 5 or 9" });
      return;
    }

    const room = await getFocusRoomRow(roomId);
    if (!room?.linkedCircleId) {
      res.json({ skipped: true });
      return;
    }

    const [generalChannel] = await db
      .select()
      .from(channelsTable)
      .where(and(eq(channelsTable.circleId, room.linkedCircleId), eq(channelsTable.kind, "general")));
    if (!generalChannel) {
      res.json({ skipped: true });
      return;
    }

    const [me] = await db
      .select({ displayName: usersTable.displayName, avatarUrl: usersTable.avatarUrl })
      .from(usersTable)
      .where(eq(usersTable.id, userId));

    const displayName = me?.displayName ?? "Someone";
    const exam = room.exam || "their exam";
    const body = milestone === 9
      ? `🏅 ${displayName} just crushed 9h today in ${exam} 👑 Absolute beast.`
      : `🔥 ${displayName} just crossed 5h today in ${exam} · Keep going!`;

    const [m] = await db.insert(messagesTable).values({
      id: randomUUID(),
      channelId: generalChannel.id,
      authorId: userId,
      body,
    }).returning();

    const formatted = {
      ...m,
      authorName: displayName,
      authorAvatar: me?.avatarUrl ?? "",
      reactions: [],
    };
    getIO().to(`channel_${generalChannel.id}`).emit("message:new", formatted);

    res.json({ success: true });
  } catch (e) {
    console.error("post activity error", e);
    res.status(500).json({ error: "Failed to post activity" });
  }
});

// EXAMS
router.get("/exams", privateCache(30), async (_req, res) => {
  const exams = await db
    .select({
      id: examsTable.id,
      title: examsTable.title,
      exam: examsTable.exam,
      kind: examsTable.kind,
      durationMinutes: examsTable.durationMinutes,
      totalQuestions: examsTable.totalQuestions,
      totalMarks: examsTable.totalMarks,
      attemptCount: examsTable.attemptCount,
      difficulty: examsTable.difficulty,
      isLive: examsTable.isLive,
      scheduledAt: examsTable.scheduledAt,
    })
    .from(examsTable);
  res.json(ListExamsResponse.parse(exams));
});

router.get("/exams/:id", async (req, res) => {
  const params = GetExamParams.safeParse({ id: idOf(req.params.id) });
  if (!params.success) return res.status(400).json({ error: params.error.message });
  const [e] = await db.select().from(examsTable).where(eq(examsTable.id, params.data.id));
  if (!e) return res.status(404).json({ error: "Exam not found" });

  const sections = await db.select().from(examSectionsTable)
    .where(eq(examSectionsTable.examId, e.id))
    .orderBy(examSectionsTable.displayOrder);

  res.json(GetExamResponse.parse({
    ...e,
    instructions: e.instructionsJson as string[],
    topics: e.topicsJson as string[],
    hasCalculator: e.hasCalculator ?? false,
    sections,
  }));
});

router.get("/exams/:id/my-attempt", async (req, res) => {
  const userId = getAuthUserId(req);
  const [attempt] = await db
    .select()
    .from(examAttemptsTable)
    .where(and(
      eq(examAttemptsTable.examId, req.params.id),
      eq(examAttemptsTable.userId, userId),
      eq(examAttemptsTable.status, "in-progress"),
    ))
    .orderBy(desc(examAttemptsTable.startedAt))
    .limit(1);

  if (!attempt) return res.json({ found: false });

  const [{ answeredCount }] = await db
    .select({ answeredCount: count() })
    .from(userAnswersTable)
    .where(and(
      eq(userAnswersTable.attemptId, attempt.id),
      ne(userAnswersTable.status, "unanswered"),
    ));

  const secondsElapsed = Math.floor((Date.now() - attempt.startedAt.getTime()) / 1000);
  res.json({
    found: true,
    attemptId: attempt.id,
    questionsAnswered: Number(answeredCount),
    secondsRemaining: Math.max(0, attempt.durationMinutes * 60 - secondsElapsed),
    startedAt: attempt.startedAt,
  });
});

router.get("/exams/:id/leaderboard", async (req, res) => {
  const examId = req.params.id;
  const userId = getAuthUserId(req);

  const [e] = await db.select().from(examsTable).where(eq(examsTable.id, examId));
  if (!e) return res.status(404).json({ error: "Exam not found" });

  const rows = await db
    .select({
      userId: examAttemptsTable.userId,
      score: examAttemptsTable.score,
      submittedAt: examAttemptsTable.submittedAt,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
    })
    .from(examAttemptsTable)
    .innerJoin(usersTable, eq(examAttemptsTable.userId, usersTable.id))
    .where(and(eq(examAttemptsTable.examId, examId), eq(examAttemptsTable.status, "submitted")))
    .orderBy(desc(examAttemptsTable.score), examAttemptsTable.submittedAt)
    .limit(100);

  const entries = rows.map((r, idx) => ({
    rank: idx + 1,
    userId: r.userId,
    displayName: r.displayName || "Anonymous",
    avatarUrl: r.avatarUrl ?? null,
    score: r.score ?? 0,
    submittedAt: r.submittedAt ?? null,
    isCurrentUser: r.userId === userId,
  }));

  const myEntry = entries.find((e) => e.isCurrentUser) ?? null;

  res.json({
    examId: e.id,
    examTitle: e.title,
    totalMarks: e.totalMarks,
    kind: e.kind,
    scheduledAt: e.scheduledAt ?? null,
    durationMinutes: e.durationMinutes,
    totalParticipants: entries.length,
    myEntry: myEntry ? { rank: myEntry.rank, score: myEntry.score, submittedAt: myEntry.submittedAt } : null,
    entries,
  });
});

router.post("/exams/:id/attempt", async (req, res) => {
  const params = StartExamAttemptParams.safeParse({ id: idOf(req.params.id) });
  if (!params.success) return res.status(400).json({ error: params.error.message });
  const userId = getAuthUserId(req);

  const [e] = await db.select().from(examsTable).where(eq(examsTable.id, params.data.id));
  if (!e) return res.status(404).json({ error: "Exam not found" });

  // Contest window enforcement
  if (e.kind === "contest" && e.scheduledAt) {
    const now = Date.now();
    const start = new Date(e.scheduledAt).getTime();
    const end = start + e.durationMinutes * 60 * 1000;
    if (now < start) return res.status(403).json({ error: "Contest hasn't started yet." });
    if (now > end)   return res.status(403).json({ error: "Contest has ended." });
  }

  // Idempotency: if this user already has an in-progress attempt on this exam,
  // resume it instead of creating a duplicate. Without this, a refresh or
  // double-click would fork the timer + spawn a fresh set of unanswered rows
  // and incorrectly bump attemptCount on every retry.
  const [existing] = await db.select().from(examAttemptsTable).where(and(
    eq(examAttemptsTable.examId, e.id),
    eq(examAttemptsTable.userId, userId),
    eq(examAttemptsTable.status, "in-progress"),
  ));

  let attemptId: string;
  let a: typeof examAttemptsTable.$inferSelect;
  if (existing) {
    attemptId = existing.id;
    a = existing;
  } else {
    attemptId = randomUUID();
    const [created] = await db.insert(examAttemptsTable).values({
      id: attemptId,
      examId: e.id,
      userId,
      status: "in-progress",
      durationMinutes: e.durationMinutes,
    }).returning();
    a = created;
    await db.update(examsTable)
      .set({ attemptCount: sql`${examsTable.attemptCount} + 1` })
      .where(eq(examsTable.id, e.id));
  }

  const qs = await db.select().from(questionsTable).where(eq(questionsTable.examId, e.id));
  let answers: { questionId: string; selectedOptionIds: string[]; natValue: number | null; status: string }[];
  if (existing) {
    const uas = await db.select().from(userAnswersTable).where(eq(userAnswersTable.attemptId, attemptId));
    answers = uas.map(u => ({
      questionId: u.questionId,
      selectedOptionIds: (u.selectedOptionIdsJson as string[]) ?? [],
      natValue: u.natValue,
      status: u.status,
    }));
  } else {
    const answerInserts = qs.map(q => ({
      id: randomUUID(),
      attemptId,
      questionId: q.id,
      status: "unanswered" as const,
    }));
    if (answerInserts.length > 0) {
      await db.insert(userAnswersTable).values(answerInserts);
    }
    answers = answerInserts.map(ins => ({
      questionId: ins.questionId,
      selectedOptionIds: [],
      natValue: null,
      status: ins.status,
    }));
  }

  // Resume picks up where the timer left off — don't restart it on every click.
  const secondsElapsed = Math.floor((Date.now() - a.startedAt.getTime()) / 1000);
  const secondsRemaining = Math.max(0, a.durationMinutes * 60 - secondsElapsed);

  res.json(StartExamAttemptResponse.parse({
    id: a.id,
    examId: e.id,
    examTitle: e.title,
    examName: e.exam,
    status: a.status,
    durationMinutes: a.durationMinutes,
    startedAt: a.startedAt,
    secondsRemaining,
    totalMarks: e.totalMarks,
    marksPerQuestion: e.marksPerQuestion,
    negativeMarking: e.negativeMarking,
    hasCalculator: e.hasCalculator ?? false,
    questions: qs.map(q => ({
      ...q,
      options: q.optionsJson as any,
    })),
    answers,
  }));
});

router.get("/attempts/:id", async (req, res) => {
  const params = GetExamAttemptParams.safeParse({ id: idOf(req.params.id) });
  if (!params.success) return res.status(400).json({ error: params.error.message });
  const userId = getAuthUserId(req);
  
  const [a] = await db.select().from(examAttemptsTable).where(eq(examAttemptsTable.id, params.data.id));
  if (!a) return res.status(404).json({ error: "Attempt not found" });
  if (a.userId !== userId) return res.status(403).json({ error: "Forbidden" });
  const [e] = await db.select().from(examsTable).where(eq(examsTable.id, a.examId));
  if (!e) return res.status(410).json({ error: "Exam has been removed by the author" });

  const qs = await db.select().from(questionsTable).where(eq(questionsTable.examId, e.id));
  const uas = await db.select().from(userAnswersTable).where(eq(userAnswersTable.attemptId, a.id));
  const sections = await db.select().from(examSectionsTable)
    .where(eq(examSectionsTable.examId, e.id))
    .orderBy(examSectionsTable.displayOrder);
  const secondsElapsed = Math.floor((Date.now() - a.startedAt.getTime()) / 1000);

  res.json(GetExamAttemptResponse.parse({
    id: a.id,
    examId: e.id,
    examTitle: e.title,
    examName: e.exam,
    status: a.status,
    durationMinutes: a.durationMinutes,
    startedAt: a.startedAt,
    secondsRemaining: Math.max(0, a.durationMinutes * 60 - secondsElapsed),
    totalMarks: e.totalMarks,
    marksPerQuestion: e.marksPerQuestion,
    negativeMarking: e.negativeMarking,
    hasCalculator: e.hasCalculator ?? false,
    sections,
    // SECURITY: correctOptionIdsJson and natAnswer are stripped in-progress so
    // correct answers are never sent before submission. Zod also strips unknowns.
    questions: qs.map(q => ({
      id: q.id,
      kind: q.kind,
      body: q.body,
      imageUrl: q.imageUrl ?? null,
      options: q.optionsJson as any,
      marks: q.marks,
      negativeMarks: q.negativeMarks,
      topic: q.topic,
      sectionId: q.sectionId ?? null,
      explanation: a.status === "in-progress" ? null : q.explanation,
    })),
    answers: uas.map(u => ({
      questionId: u.questionId,
      selectedOptionIds: u.selectedOptionIdsJson as string[],
      natValue: u.natValue,
      status: u.status as any,
      timeSpentSeconds: u.timeSpentSeconds ?? undefined,
    })),
  }));
});

router.post("/attempts/:id/answer", async (req, res) => {
  const params = SubmitAnswerParams.safeParse({ id: idOf(req.params.id) });
  if (!params.success) return res.status(400).json({ error: params.error.message });
  const body = SubmitAnswerBody.safeParse(req.body);
  if (!body.success) return res.status(400).json({ error: body.error.message });
  const userId = getAuthUserId(req);
  if (!(await ownsExamAttempt(params.data.id, userId))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  // SECURITY: enforce time + contest window server-side. Client timer is
  // advisory; disabling JS or replaying requests must not extend time.
  const [a] = await db.select().from(examAttemptsTable).where(eq(examAttemptsTable.id, params.data.id));
  if (!a) return res.status(404).json({ error: "Attempt not found" });
  if (a.status !== "in-progress") return res.status(409).json({ error: "Attempt is not in progress" });
  const examEnd = a.startedAt.getTime() + a.durationMinutes * 60_000;
  if (Date.now() > examEnd) return res.status(403).json({ error: "Exam time has ended" });

  const [e] = await db.select().from(examsTable).where(eq(examsTable.id, a.examId));
  if (e && e.kind === "contest" && e.scheduledAt) {
    const contestEnd = new Date(e.scheduledAt).getTime() + e.durationMinutes * 60_000;
    if (Date.now() > contestEnd) return res.status(403).json({ error: "Contest has ended" });
  }

  const updateData: Record<string, unknown> = {
    selectedOptionIdsJson: body.data.selectedOptionIds || [],
    natValue: body.data.natValue ?? null,
    status: body.data.status,
  };
  if (body.data.timeSpentSeconds !== undefined) {
    updateData.timeSpentSeconds = body.data.timeSpentSeconds;
  }

  const [ua] = await db.update(userAnswersTable)
    .set(updateData)
    .where(and(eq(userAnswersTable.attemptId, params.data.id), eq(userAnswersTable.questionId, body.data.questionId)))
    .returning();

  if (!ua) return res.status(404).json({ error: "Answer record not found" });

  res.json(SubmitAnswerResponse.parse({
    questionId: ua.questionId,
    selectedOptionIds: ua.selectedOptionIdsJson as string[],
    natValue: ua.natValue,
    status: ua.status as any,
  }));
});

router.post("/attempts/:id/submit", async (req, res) => {
  const params = SubmitExamAttemptParams.safeParse({ id: idOf(req.params.id) });
  if (!params.success) return res.status(400).json({ error: params.error.message });
  const userId = getAuthUserId(req);
  if (!(await ownsExamAttempt(params.data.id, userId))) {
    return res.status(403).json({ error: "Forbidden" });
  }

  const [a] = await db.select().from(examAttemptsTable).where(eq(examAttemptsTable.id, params.data.id));
  if (!a) return res.status(404).json({ error: "Attempt not found" });
  if (a.status === "submitted") return res.status(409).json({ error: "Attempt already submitted" });

  const [e] = await db.select().from(examsTable).where(eq(examsTable.id, a.examId));
  if (!e) return res.status(410).json({ error: "Exam has been removed by the author" });
  const uas = await db.select().from(userAnswersTable).where(eq(userAnswersTable.attemptId, a.id));
  const qs = await db.select().from(questionsTable).where(eq(questionsTable.examId, e.id));

  let score = 0, correct = 0, incorrect = 0, skipped = 0;
  const topicAgg = new Map<string, { correct: number; total: number }>();
  for (const q of qs) {
    const t = topicAgg.get(q.topic) ?? { correct: 0, total: 0 };
    t.total++;
    const ua = uas.find(u => u.questionId === q.id);
    if (!ua || ua.status === "unanswered" || ua.status === "marked") { skipped++; topicAgg.set(q.topic, t); continue; }
    const correctIds = q.correctOptionIdsJson as string[];
    const selectedIds = ua.selectedOptionIdsJson as string[];
    const isCorrect = q.kind === "nat"
      ? ua.natValue !== null && Math.abs(ua.natValue - (q.natAnswer || 0)) < 0.01
      : correctIds.length === selectedIds.length && correctIds.every(id => selectedIds.includes(id));
    if (isCorrect) { score += q.marks; correct++; t.correct++; }
    else { score -= q.negativeMarks; incorrect++; }
    topicAgg.set(q.topic, t);
  }
  score = Math.max(0, parseFloat(score.toFixed(2)));

  await db.update(examAttemptsTable)
    .set({ status: "submitted", score, submittedAt: new Date() })
    .where(eq(examAttemptsTable.id, a.id));

  const [{ belowCount }] = await db
    .select({ belowCount: count() })
    .from(examAttemptsTable)
    .where(and(
      eq(examAttemptsTable.examId, a.examId),
      eq(examAttemptsTable.status, "submitted"),
      sql`${examAttemptsTable.score} < ${score}`
    ));
  const [{ totalCount }] = await db
    .select({ totalCount: count() })
    .from(examAttemptsTable)
    .where(and(eq(examAttemptsTable.examId, a.examId), eq(examAttemptsTable.status, "submitted")));

  const totalParticipants = Math.max(1, totalCount);
  const percentile = totalParticipants > 1
    ? Math.min(99.9, (belowCount / totalParticipants) * 100)
    : 50;
  const rank = Math.max(1, totalParticipants - belowCount);
  const accuracy = correct + incorrect > 0 ? (correct / (correct + incorrect)) * 100 : 0;
  const timeSpentMinutes = Math.round((Date.now() - new Date(a.startedAt).getTime()) / 60000);

  res.json(SubmitExamAttemptResponse.parse({
    attemptId: a.id,
    examTitle: e.title,
    score,
    totalMarks: e.totalMarks,
    accuracy,
    percentile: parseFloat(percentile.toFixed(1)),
    rank,
    totalParticipants,
    correctCount: correct,
    wrongCount: incorrect,
    skippedCount: skipped,
    timeSpentMinutes,
    topicBreakdown: [...topicAgg.entries()].map(([topic, v]) => ({ topic, correct: v.correct, total: v.total })),
  }));
});

// ── Exam Result (graded, with correct answers) ────────────────────────────────
router.get("/attempts/:id/result", async (req, res) => {
  const params = GetExamAttemptParams.safeParse({ id: idOf(req.params.id) });
  if (!params.success) return res.status(400).json({ error: params.error.message });
  const userId = getAuthUserId(req);

  const [a] = await db.select().from(examAttemptsTable).where(eq(examAttemptsTable.id, params.data.id));
  if (!a) return res.status(404).json({ error: "Attempt not found" });
  if (a.userId !== userId) return res.status(403).json({ error: "Forbidden" });
  if (a.status !== "submitted") return res.status(400).json({ error: "Exam not yet submitted" });

  const [e] = await db.select().from(examsTable).where(eq(examsTable.id, a.examId));
  if (!e) return res.status(410).json({ error: "Exam has been removed by the author" });
  const qs = await db.select().from(questionsTable).where(eq(questionsTable.examId, e.id));
  const uas = await db.select().from(userAnswersTable).where(eq(userAnswersTable.attemptId, a.id));

  let score = 0, correct = 0, incorrect = 0, skipped = 0;
  const topicAgg    = new Map<string, { correct: number; total: number }>();
  const subjectAgg  = new Map<string, { correct: number; total: number }>();
  const subtopicAgg = new Map<string, { correct: number; total: number; parentTopic: string }>();

  const bump = (m: Map<string, { correct: number; total: number }>, k: string, isCorrect: boolean) => {
    const cur = m.get(k) ?? { correct: 0, total: 0 };
    cur.total++; if (isCorrect) cur.correct++;
    m.set(k, cur);
  };

  const questionResults = qs.map((q, idx) => {
    const ua = uas.find(u => u.questionId === q.id);
    const yourSelectedIds = (ua?.selectedOptionIdsJson as string[]) ?? [];
    const yourNatValue = ua?.natValue ?? null;
    const isAnswered = ua && ua.status !== "unanswered" && ua.status !== "marked";
    let verdict: "correct" | "wrong" | "skipped" = "skipped";
    let isCorrectQ = false;
    if (!isAnswered) {
      skipped++;
    } else {
      const correctIds = q.correctOptionIdsJson as string[];
      isCorrectQ = q.kind === "nat"
        ? yourNatValue !== null && Math.abs(yourNatValue - (q.natAnswer || 0)) < 0.01
        : correctIds.length === yourSelectedIds.length && correctIds.every(id => yourSelectedIds.includes(id));
      if (isCorrectQ) { score += q.marks; correct++; verdict = "correct"; }
      else { score -= q.negativeMarks; incorrect++; verdict = "wrong"; }
    }
    bump(topicAgg, q.topic, isCorrectQ);
    if (q.subject)  bump(subjectAgg, q.subject, isCorrectQ);
    if (q.subtopic) {
      const cur = subtopicAgg.get(q.subtopic) ?? { correct: 0, total: 0, parentTopic: q.topic };
      cur.total++; if (isCorrectQ) cur.correct++;
      subtopicAgg.set(q.subtopic, cur);
    }
    return {
      id: q.id, no: idx + 1,
      kind: q.kind as "mcq" | "msq" | "nat",
      body: q.body,
      imageUrl: q.imageUrl ?? null,
      explanation: q.explanation ?? null,
      solutionVideoUrl: q.solutionVideoUrl ?? null,
      solutionArticleUrl: q.solutionArticleUrl ?? null,
      options: (q.optionsJson as any[]) ?? [],
      marks: q.marks, negativeMarks: q.negativeMarks, topic: q.topic,
      subject: q.subject ?? null, subtopic: q.subtopic ?? null, source: q.source ?? null,
      correctOptionIds: (q.correctOptionIdsJson as string[]) ?? [],
      natAnswer: q.natAnswer ?? null,
      yourSelectedIds, yourNatValue, verdict,
      timeSpentSeconds: ua?.timeSpentSeconds ?? null,
    };
  });
  score = Math.max(0, parseFloat(score.toFixed(2)));

  const [[{ belowCount }], [scoreStats]] = await Promise.all([
    db.select({ belowCount: count() }).from(examAttemptsTable)
      .where(and(eq(examAttemptsTable.examId, a.examId), eq(examAttemptsTable.status, "submitted"), sql`${examAttemptsTable.score} < ${score}`)),
    db.select({
      totalCount: count(),
      avgScore: sql<number>`coalesce(avg(${examAttemptsTable.score}), 0)`,
      topScore: sql<number>`coalesce(max(${examAttemptsTable.score}), 0)`,
    }).from(examAttemptsTable)
      .where(and(eq(examAttemptsTable.examId, a.examId), eq(examAttemptsTable.status, "submitted"))),
  ]);
  const totalParticipants = Math.max(1, scoreStats.totalCount);
  const percentile = totalParticipants > 1 ? Math.min(99.9, (belowCount / totalParticipants) * 100) : 50;
  const rank = Math.max(1, totalParticipants - belowCount);
  const accuracy = correct + incorrect > 0 ? (correct / (correct + incorrect)) * 100 : 0;
  // Use submittedAt so the displayed duration is fixed; previously this re-computed
  // against Date.now() every time the result was viewed, so old results showed
  // ever-growing "time spent" values.
  const endedAt = a.submittedAt ?? new Date();
  const timeSpentMinutes = Math.round((endedAt.getTime() - new Date(a.startedAt).getTime()) / 60000);

  res.json({
    attemptId: a.id,
    examId: e.id,
    examTitle: e.title,
    examName: e.exam,
    score, totalMarks: e.totalMarks,
    accuracy: parseFloat(accuracy.toFixed(1)),
    percentile: parseFloat(percentile.toFixed(1)),
    rank, totalParticipants,
    correctCount: correct, wrongCount: incorrect, skippedCount: skipped,
    timeSpentMinutes,
    classAverageScore: parseFloat(Number(scoreStats.avgScore).toFixed(1)),
    topScore: parseFloat(Number(scoreStats.topScore).toFixed(1)),
    topicBreakdown: [...topicAgg.entries()].map(([topic, v]) => ({ topic, correct: v.correct, total: v.total })),
    subjectBreakdown: [...subjectAgg.entries()].map(([subject, v]) => ({ subject, correct: v.correct, total: v.total })),
    subtopicBreakdown: [...subtopicAgg.entries()].map(([subtopic, v]) => ({ subtopic, parentTopic: v.parentTopic, correct: v.correct, total: v.total })),
    questions: questionResults,
  });
});

// ANALYTICS
router.get("/analytics/overview", privateCache(900), async (req, res) => {
  const userId = getAuthUserId(req);

  const [user] = await db.select({ xp: usersTable.xp }).from(usersTable).where(eq(usersTable.id, userId));
  const userXp = user?.xp ?? 0;

  const [{ usersAbove }] = await db
    .select({ usersAbove: count() })
    .from(usersTable)
    .where(sql`${usersTable.xp} > ${userXp}`);
  const [{ totalUsers }] = await db.select({ totalUsers: count() }).from(usersTable);
  const rank = usersAbove + 1;
  const percentile = totalUsers > 1
    ? Math.min(99.9, ((totalUsers - rank) / totalUsers) * 100)
    : 50;

  const [studyData] = await db
    .select({ total: sql<number>`coalesce(sum(${studySessionsTable.durationMinutes}), 0)` })
    .from(studySessionsTable)
    .where(eq(studySessionsTable.userId, userId));

  const submitted = await db
    .select({ id: examAttemptsTable.id, score: examAttemptsTable.score })
    .from(examAttemptsTable)
    .where(and(eq(examAttemptsTable.userId, userId), eq(examAttemptsTable.status, "submitted")));

  const totalAttempts = submitted.length;
  const scored = submitted.filter(a => a.score !== null);
  const averageScore = scored.length > 0
    ? parseFloat((scored.reduce((sum, a) => sum + (a.score ?? 0), 0) / scored.length).toFixed(1))
    : 0;

  let accuracy = 0;
  const strongTopics: string[] = [];
  const weakTopics: string[] = [];
  if (totalAttempts > 0) {
    const answers = await db
      .select({
        topic: questionsTable.topic,
        kind: questionsTable.kind,
        correctOptionIdsJson: questionsTable.correctOptionIdsJson,
        natAnswer: questionsTable.natAnswer,
        selectedOptionIdsJson: userAnswersTable.selectedOptionIdsJson,
        natValue: userAnswersTable.natValue,
        status: userAnswersTable.status,
      })
      .from(userAnswersTable)
      .innerJoin(questionsTable, eq(userAnswersTable.questionId, questionsTable.id))
      .where(inArray(userAnswersTable.attemptId, submitted.map(a => a.id)));

    let correct = 0, attempted = 0;
    const topicMap = new Map<string, { correct: number; total: number }>();
    for (const ans of answers) {
      if (ans.status === "unanswered" || ans.status === "marked") continue;
      attempted++;
      const t = topicMap.get(ans.topic) ?? { correct: 0, total: 0 };
      t.total++;
      const correctIds = ans.correctOptionIdsJson as string[];
      const selectedIds = ans.selectedOptionIdsJson as string[];
      const isCorrect = ans.kind === "nat"
        ? ans.natValue !== null && Math.abs(ans.natValue - (ans.natAnswer || 0)) < 0.01
        : correctIds.length === selectedIds.length && correctIds.every(id => selectedIds.includes(id));
      if (isCorrect) { correct++; t.correct++; }
      topicMap.set(ans.topic, t);
    }
    accuracy = attempted > 0 ? parseFloat(((correct / attempted) * 100).toFixed(1)) : 0;

    const ranked = [...topicMap.entries()]
      .filter(([, v]) => v.total >= 3)
      .map(([topic, v]) => ({ topic, acc: v.correct / v.total }))
      .sort((a, b) => b.acc - a.acc);
    strongTopics.push(...ranked.slice(0, 3).map(t => t.topic));
    weakTopics.push(...ranked.slice(-3).reverse().map(t => t.topic).filter(t => !strongTopics.includes(t)));
  }

  res.json(GetAnalyticsOverviewResponse.parse({
    accuracy,
    percentile: parseFloat(percentile.toFixed(1)),
    rank,
    totalAttempts,
    averageScore,
    totalStudyMinutes: studyData?.total ?? 0,
    strongTopics,
    weakTopics,
  }));
});

router.get("/analytics/topic-performance", privateCache(900), async (req, res) => {
  const userId = getAuthUserId(req);
  const attempts = await db
    .select({ id: examAttemptsTable.id })
    .from(examAttemptsTable)
    .where(and(eq(examAttemptsTable.userId, userId), eq(examAttemptsTable.status, "submitted")));

  if (attempts.length === 0) {
    res.json([]);
    return;
  }

  const attemptIds = attempts.map(a => a.id);
  const answers = await db
    .select({
      topic: questionsTable.topic,
      kind: questionsTable.kind,
      correctOptionIdsJson: questionsTable.correctOptionIdsJson,
      natAnswer: questionsTable.natAnswer,
      selectedOptionIdsJson: userAnswersTable.selectedOptionIdsJson,
      natValue: userAnswersTable.natValue,
      status: userAnswersTable.status,
    })
    .from(userAnswersTable)
    .innerJoin(questionsTable, eq(userAnswersTable.questionId, questionsTable.id))
    .where(inArray(userAnswersTable.attemptId, attemptIds));

  const topicMap = new Map<string, { correct: number; total: number }>();
  for (const ans of answers) {
    if (ans.status === "unanswered" || ans.status === "marked") continue;
    const t = topicMap.get(ans.topic) ?? { correct: 0, total: 0 };
    t.total++;
    const correctIds = ans.correctOptionIdsJson as string[];
    const selectedIds = ans.selectedOptionIdsJson as string[];
    const isCorrect = ans.kind === "nat"
      ? ans.natValue !== null && Math.abs(ans.natValue - (ans.natAnswer || 0)) < 0.01
      : correctIds.length === selectedIds.length && correctIds.every(id => selectedIds.includes(id));
    if (isCorrect) t.correct++;
    topicMap.set(ans.topic, t);
  }

  const result = [...topicMap.entries()]
    .map(([topic, v]) => ({
      topic,
      accuracy: v.total > 0 ? Math.round((v.correct / v.total) * 100) : 0,
      attempts: v.total,
      avgTimeSeconds: 0,
    }))
    .sort((a, b) => b.attempts - a.attempts);

  res.json(GetTopicPerformanceResponse.parse(result));
});

router.get("/analytics/score-trend", privateCache(900), async (req, res) => {
  const userId = getAuthUserId(req);

  const attempts = await db
    .select({
      id: examAttemptsTable.id,
      examId: examAttemptsTable.examId,
      score: examAttemptsTable.score,
      startedAt: examAttemptsTable.startedAt,
    })
    .from(examAttemptsTable)
    .where(and(eq(examAttemptsTable.userId, userId), eq(examAttemptsTable.status, "submitted")))
    .orderBy(examAttemptsTable.startedAt)
    .limit(20);

  if (attempts.length === 0) {
    res.json([]);
    return;
  }

  const examIds = [...new Set(attempts.map((a) => a.examId))];
  const [examsRows, allScoreRows] = await Promise.all([
    db.select({ id: examsTable.id, title: examsTable.title, totalMarks: examsTable.totalMarks })
      .from(examsTable).where(inArray(examsTable.id, examIds)),
    db.select({ examId: examAttemptsTable.examId, score: examAttemptsTable.score })
      .from(examAttemptsTable)
      .where(and(inArray(examAttemptsTable.examId, examIds), eq(examAttemptsTable.status, "submitted"))),
  ]);

  const examMap = new Map(examsRows.map((e) => [e.id, e]));
  const scoresByExam = new Map<string, number[]>();
  for (const row of allScoreRows) {
    const arr = scoresByExam.get(row.examId) ?? [];
    arr.push(row.score ?? 0);
    scoresByExam.set(row.examId, arr);
  }

  const result = attempts.slice(-10).map((a) => {
    const exam = examMap.get(a.examId);
    const raw = a.score ?? 0;
    const totalMarks = exam?.totalMarks ?? 100;
    const normalizedScore = Math.round((raw / totalMarks) * 100);

    const allScores = scoresByExam.get(a.examId) ?? [];
    const below = allScores.filter((s) => s < raw).length;
    const percentile = allScores.length > 1 ? Math.round((below / allScores.length) * 100) : 50;

    const rawTitle = exam?.title ?? "";
    const label = rawTitle.length > 20
      ? rawTitle.substring(0, 18) + "…"
      : rawTitle || new Date(a.startedAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" });

    return { label, score: normalizedScore, percentile };
  });

  res.json(GetScoreTrendResponse.parse(result));
});

router.get("/me/exam-history", async (req, res) => {
  const userId = getAuthUserId(req);
  const page   = Math.max(1, parseInt(String(req.query.page ?? "1")));
  const limit  = 20;
  const offset = (page - 1) * limit;

  const [rows, [countRow]] = await Promise.all([
    db.select({
      attemptId:  examAttemptsTable.id,
      examId:     examAttemptsTable.examId,
      score:      examAttemptsTable.score,
      submittedAt: examAttemptsTable.submittedAt,
      examTitle:  examsTable.title,
      totalMarks: examsTable.totalMarks,
      exam:       examsTable.exam,
    })
    .from(examAttemptsTable)
    .innerJoin(examsTable, eq(examAttemptsTable.examId, examsTable.id))
    .where(and(eq(examAttemptsTable.userId, userId), eq(examAttemptsTable.status, "submitted")))
    .orderBy(desc(examAttemptsTable.submittedAt))
    .limit(limit)
    .offset(offset),
    db.select({ total: count() }).from(examAttemptsTable)
      .where(and(eq(examAttemptsTable.userId, userId), eq(examAttemptsTable.status, "submitted"))),
  ]);

  res.json({
    attempts: rows.map(r => ({
      attemptId:  r.attemptId,
      examId:     r.examId,
      examTitle:  r.examTitle,
      exam:       r.exam ?? null,
      score:      r.score ?? 0,
      totalMarks: r.totalMarks,
      submittedAt: r.submittedAt,
    })),
    total:   Number(countRow?.total) || 0,
    page,
    hasMore: offset + limit < (Number(countRow?.total) || 0),
  });
});

router.get("/analytics/study-stats", requireAuth, async (req, res) => {
  const userId = getAuthUserId(req);
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);

  const sessions = await db
    .select({
      startedAt: studySessionsTable.startedAt,
      durationMinutes: studySessionsTable.durationMinutes,
      subjectId: studySessionsTable.subjectId,
    })
    .from(studySessionsTable)
    .where(and(eq(studySessionsTable.userId, userId), gte(studySessionsTable.startedAt, sevenDaysAgo)));

  // Build daily map keyed by "Day-YYYY-MM-DD" to keep order and avoid day-name collisions
  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const orderedKeys: string[] = [];
  const dailyMap = new Map<string, number>();
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86_400_000);
    const key = `${dayNames[d.getDay()]}-${d.toISOString().split("T")[0]}`;
    orderedKeys.push(key);
    dailyMap.set(key, 0);
  }

  const subjectMap = new Map<string, number>();
  for (const s of sessions) {
    const d = new Date(s.startedAt);
    const key = `${dayNames[d.getDay()]}-${d.toISOString().split("T")[0]}`;
    if (dailyMap.has(key)) dailyMap.set(key, (dailyMap.get(key) ?? 0) + s.durationMinutes);
    if (s.subjectId) subjectMap.set(s.subjectId, (subjectMap.get(s.subjectId) ?? 0) + s.durationMinutes);
  }

  const weeklyTrend = orderedKeys.map((key) => ({
    day: key.split("-")[0],
    hours: parseFloat(((dailyMap.get(key) ?? 0) / 60).toFixed(1)),
  }));

  const subjectIds = [...subjectMap.keys()];
  let subjectDistribution: { name: string; minutes: number; color: string }[] = [];
  if (subjectIds.length > 0) {
    const subs = await db
      .select({ id: subjectsTable.id, name: subjectsTable.name, color: subjectsTable.color })
      .from(subjectsTable)
      .where(inArray(subjectsTable.id, subjectIds));
    subjectDistribution = subs
      .map((s) => ({ name: s.name, minutes: subjectMap.get(s.id) ?? 0, color: s.color }))
      .filter((s) => s.minutes > 0)
      .sort((a, b) => b.minutes - a.minutes);
  }

  res.json({ weeklyTrend, subjectDistribution });
});

router.get("/analytics/peer-stats", privateCache(3600), async (req, res) => {
  const sevenDaysAgo = new Date(Date.now() - 7 * 86_400_000);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);

  const [studyRows, mockRows] = await Promise.all([
    db.select({
      userId: studySessionsTable.userId,
      total: sql<number>`sum(${studySessionsTable.durationMinutes})`,
    })
      .from(studySessionsTable)
      .where(gte(studySessionsTable.startedAt, sevenDaysAgo))
      .groupBy(studySessionsTable.userId),

    db.select({
      userId: examAttemptsTable.userId,
      cnt: count(),
    })
      .from(examAttemptsTable)
      .where(and(eq(examAttemptsTable.status, "submitted"), gte(examAttemptsTable.startedAt, thirtyDaysAgo)))
      .groupBy(examAttemptsTable.userId),
  ]);

  const studyHours = studyRows.map(r => (r.total ?? 0) / 60).sort((a, b) => a - b);
  const mockCounts = mockRows.map(r => r.cnt).sort((a, b) => a - b);

  const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
  const p90 = (arr: number[]) => arr[Math.floor(arr.length * 0.9)] ?? 0;

  res.json({
    platformAvgWeeklyHours: parseFloat(avg(studyHours).toFixed(1)),
    topDecileWeeklyHours:   parseFloat(p90(studyHours).toFixed(1)),
    platformAvgMonthlyMocks: parseFloat(avg(mockCounts).toFixed(1)),
    topDecileMonthlyMocks:   parseFloat(p90(mockCounts).toFixed(1)),
    totalUsersStudied: studyRows.length,
  });
});

// ── Topic Time Analytics ──────────────────────────────────────────────────────
// Returns avg seconds spent + accuracy per topic (only for questions that have
// timeSpentSeconds recorded). Used by the analytics "Time per Topic" chart.
router.get("/analytics/topic-time", privateCache(900), async (req, res) => {
  const userId = getAuthUserId(req);

  const rows = await db
    .select({
      topic: questionsTable.topic,
      timeSpentSeconds: userAnswersTable.timeSpentSeconds,
      correctOptionIdsJson: questionsTable.correctOptionIdsJson,
      selectedOptionIdsJson: userAnswersTable.selectedOptionIdsJson,
      natAnswer: questionsTable.natAnswer,
      natValue: userAnswersTable.natValue,
      kind: questionsTable.kind,
    })
    .from(userAnswersTable)
    .innerJoin(examAttemptsTable, eq(userAnswersTable.attemptId, examAttemptsTable.id))
    .innerJoin(questionsTable, eq(userAnswersTable.questionId, questionsTable.id))
    .where(
      and(
        eq(examAttemptsTable.userId, userId),
        eq(examAttemptsTable.status, "submitted"),
        sql`${userAnswersTable.timeSpentSeconds} IS NOT NULL`,
      )
    );

  const agg = new Map<string, { totalSeconds: number; count: number; correct: number }>();
  for (const r of rows) {
    const cur = agg.get(r.topic) ?? { totalSeconds: 0, count: 0, correct: 0 };
    cur.totalSeconds += r.timeSpentSeconds ?? 0;
    cur.count++;
    const correctIds = r.correctOptionIdsJson as string[];
    const selectedIds = r.selectedOptionIdsJson as string[];
    const isCorrect = r.kind === "nat"
      ? r.natValue !== null && Math.abs(r.natValue - (r.natAnswer || 0)) < 0.01
      : correctIds.length > 0 && correctIds.length === selectedIds.length && correctIds.every(id => selectedIds.includes(id));
    if (isCorrect) cur.correct++;
    agg.set(r.topic, cur);
  }

  const result = [...agg.entries()]
    .filter(([, v]) => v.count >= 2)
    .map(([topic, v]) => ({
      topic,
      avgSeconds: Math.round(v.totalSeconds / v.count),
      attempts: v.count,
      accuracy: Math.round((v.correct / v.count) * 100),
    }))
    .sort((a, b) => b.avgSeconds - a.avgSeconds)
    .slice(0, 10);

  res.json(result);
});

// BOOKMARKS
router.get("/bookmarks", async (req, res) => {
  const userId = getAuthUserId(req);
  const rows = await db
    .select({
      questionId:           questionBookmarksTable.questionId,
      createdAt:            questionBookmarksTable.createdAt,
      body:                 questionsTable.body,
      kind:                 questionsTable.kind,
      topic:                questionsTable.topic,
      subject:              questionsTable.subject,
      source:               questionsTable.source,
      marks:                questionsTable.marks,
      optionsJson:          questionsTable.optionsJson,
      correctOptionIdsJson: questionsTable.correctOptionIdsJson,
      natAnswer:            questionsTable.natAnswer,
      explanation:          questionsTable.explanation,
    })
    .from(questionBookmarksTable)
    .innerJoin(questionsTable, eq(questionBookmarksTable.questionId, questionsTable.id))
    .where(eq(questionBookmarksTable.userId, userId))
    .orderBy(desc(questionBookmarksTable.createdAt));
  res.json(rows);
});

router.post("/bookmarks/:questionId", async (req, res) => {
  const userId = getAuthUserId(req);
  const { questionId } = req.params;
  await db.insert(questionBookmarksTable).values({ userId, questionId }).onConflictDoNothing();
  res.json({ bookmarked: true });
});

router.delete("/bookmarks/:questionId", async (req, res) => {
  const userId = getAuthUserId(req);
  const { questionId } = req.params;
  await db.delete(questionBookmarksTable)
    .where(and(eq(questionBookmarksTable.userId, userId), eq(questionBookmarksTable.questionId, questionId)));
  res.json({ bookmarked: false });
});

// FLASHCARDS
function sm2(card: { easeFactor: number; interval: number; repetitions: number }, rating: number) {
  let { easeFactor, interval, repetitions } = card;
  if (rating < 2) {
    interval = 1;
    repetitions = 0;
  } else {
    if (repetitions === 0)      interval = 1;
    else if (repetitions === 1) interval = 6;
    else                        interval = Math.round(interval * easeFactor);
    easeFactor = Math.max(1.3, easeFactor + 0.1 - (3 - rating) * (0.08 + (3 - rating) * 0.02));
    repetitions++;
  }
  const dueDate = new Date(Date.now() + interval * 86_400_000);
  return { easeFactor, interval, repetitions, dueDate };
}

router.get("/flashcard-decks", async (req, res) => {
  const userId = getAuthUserId(req);
  const decks = await db
    .select({
      id: flashcardDecksTable.id, name: flashcardDecksTable.name,
      subject: flashcardDecksTable.subject, color: flashcardDecksTable.color,
      createdAt: flashcardDecksTable.createdAt,
      cardCount: sql<number>`(select count(*) from flashcards where deck_id = ${flashcardDecksTable.id})`,
      dueCount:  sql<number>`(select count(*) from flashcards where deck_id = ${flashcardDecksTable.id} and due_date <= now())`,
    })
    .from(flashcardDecksTable)
    .where(eq(flashcardDecksTable.userId, userId))
    .orderBy(desc(flashcardDecksTable.createdAt));
  res.json(decks);
});

router.post("/flashcard-decks", async (req, res) => {
  const userId = getAuthUserId(req);
  const { name, subject, color } = req.body as { name: string; subject?: string; color?: string };
  if (!name?.trim()) { res.status(400).json({ error: "Name required" }); return; }

  const [user] = await db.select({ plan: usersTable.plan }).from(usersTable).where(eq(usersTable.id, userId));
  if (user?.plan !== "pro") {
    const [{ cnt }] = await db.select({ cnt: count() }).from(flashcardDecksTable).where(eq(flashcardDecksTable.userId, userId));
    if (cnt >= 1) { res.status(403).json({ error: "Free plan limited to 1 deck. Upgrade to Pro for unlimited." }); return; }
  }

  const id = randomUUID();
  const [deck] = await db.insert(flashcardDecksTable)
    .values({ id, userId, name: name.trim(), subject: subject?.trim() || null, color: color || "#6366f1" })
    .returning();
  res.json(deck);
});

router.delete("/flashcard-decks/:id", async (req, res) => {
  const userId = getAuthUserId(req);
  await db.delete(flashcardDecksTable)
    .where(and(eq(flashcardDecksTable.id, req.params.id), eq(flashcardDecksTable.userId, userId)));
  res.json({ ok: true });
});

router.get("/flashcard-decks/:deckId/cards", async (req, res) => {
  const userId = getAuthUserId(req);
  const cards = await db.select()
    .from(flashcardsTable)
    .where(and(eq(flashcardsTable.deckId, req.params.deckId), eq(flashcardsTable.userId, userId)))
    .orderBy(flashcardsTable.dueDate);
  res.json(cards);
});

router.post("/flashcard-decks/:deckId/cards", async (req, res) => {
  const userId = getAuthUserId(req);
  const { front, back } = req.body as { front: string; back: string };
  if (!front?.trim() || !back?.trim()) { res.status(400).json({ error: "Front and back required" }); return; }

  const [user] = await db.select({ plan: usersTable.plan }).from(usersTable).where(eq(usersTable.id, userId));
  if (user?.plan !== "pro") {
    const [{ cnt }] = await db.select({ cnt: count() }).from(flashcardsTable).where(eq(flashcardsTable.userId, userId));
    if (cnt >= 50) { res.status(403).json({ error: "Free plan limited to 50 cards. Upgrade to Pro for unlimited." }); return; }
  }

  const id = randomUUID();
  const [card] = await db.insert(flashcardsTable)
    .values({ id, deckId: req.params.deckId, userId, front: front.trim(), back: back.trim() })
    .returning();
  res.json(card);
});

router.put("/flashcards/:id", async (req, res) => {
  const userId = getAuthUserId(req);
  const { front, back } = req.body as { front?: string; back?: string };
  const updates: Partial<{ front: string; back: string }> = {};
  if (front?.trim()) updates.front = front.trim();
  if (back?.trim())  updates.back  = back.trim();
  const [card] = await db.update(flashcardsTable).set(updates)
    .where(and(eq(flashcardsTable.id, req.params.id), eq(flashcardsTable.userId, userId)))
    .returning();
  res.json(card);
});

router.delete("/flashcards/:id", async (req, res) => {
  const userId = getAuthUserId(req);
  await db.delete(flashcardsTable)
    .where(and(eq(flashcardsTable.id, req.params.id), eq(flashcardsTable.userId, userId)));
  res.json({ ok: true });
});

router.get("/flashcards/due", async (req, res) => {
  const userId = getAuthUserId(req);
  const deckId = req.query.deckId as string | undefined;
  const conditions = [eq(flashcardsTable.userId, userId), sql`${flashcardsTable.dueDate} <= now()`];
  if (deckId) conditions.push(eq(flashcardsTable.deckId, deckId));
  const cards = await db.select().from(flashcardsTable)
    .where(and(...(conditions as any[])))
    .orderBy(flashcardsTable.dueDate)
    .limit(50);
  res.json(cards);
});

router.post("/flashcards/:id/review", async (req, res) => {
  const userId = getAuthUserId(req);
  const { rating } = req.body as { rating: number };
  if (![0, 1, 2, 3].includes(rating)) { res.status(400).json({ error: "Rating must be 0–3" }); return; }

  const [card] = await db.select().from(flashcardsTable)
    .where(and(eq(flashcardsTable.id, req.params.id), eq(flashcardsTable.userId, userId)));
  if (!card) { res.status(404).json({ error: "Not found" }); return; }

  const next = sm2(card, rating);
  const [updated] = await db.update(flashcardsTable).set({
    ...next, lastReviewedAt: new Date(),
  }).where(eq(flashcardsTable.id, card.id)).returning();
  res.json(updated);
});

// LEADERBOARD
router.get("/leaderboard", requireAuth, async (req, res) => {
  const userId = getAuthUserId(req);
  const timeframe = (req.query.timeframe as string) || "weekly";

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  let periodStart: Date | null = null;
  if (timeframe === "daily") {
    periodStart = todayStart;
  } else if (timeframe === "weekly") {
    periodStart = new Date(now.getTime() - 7 * 86_400_000);
  } else if (timeframe === "monthly") {
    periodStart = new Date(now.getTime() - 30 * 86_400_000);
  }

  const [sessionAgg, todayAgg, users] = await Promise.all([
    db.select({
      userId: studySessionsTable.userId,
      totalMinutes: sql<number>`COALESCE(SUM(${studySessionsTable.durationMinutes}), 0)::int`,
    })
    .from(studySessionsTable)
    .where(periodStart ? gte(studySessionsTable.startedAt, periodStart) : undefined)
    .groupBy(studySessionsTable.userId),

    db.select({
      userId: studySessionsTable.userId,
      todayMinutes: sql<number>`COALESCE(SUM(${studySessionsTable.durationMinutes}), 0)::int`,
    })
    .from(studySessionsTable)
    .where(gte(studySessionsTable.startedAt, todayStart))
    .groupBy(studySessionsTable.userId),

    db.select({
      id: usersTable.id,
      displayName: usersTable.displayName,
      handle: usersTable.handle,
      avatarUrl: usersTable.avatarUrl,
      activeAvatarId: usersTable.activeAvatarId,
      xp: usersTable.xp,
      level: usersTable.level,
      streakDays: usersTable.streakDays,
    }).from(usersTable).limit(200),
  ]);

  const sessionMap = new Map(sessionAgg.map(s => [s.userId, s.totalMinutes]));
  const todayMap = new Map(todayAgg.map(s => [s.userId, s.todayMinutes]));

  const ranked = users
    .map(u => ({
      ...u,
      totalMinutes: sessionMap.get(u.id) ?? 0,
      todayMinutes: todayMap.get(u.id) ?? 0,
    }))
    .filter(u => u.totalMinutes > 0)
    .sort((a, b) => b.totalMinutes - a.totalMinutes)
    .slice(0, 50);

  const formatted = ranked.map((u, i) => ({
    rank: i + 1,
    userId: u.id,
    displayName: u.displayName || "User",
    handle: u.handle || u.id.substring(0, 8),
    avatarUrl: u.avatarUrl || "",
    activeAvatarId: u.activeAvatarId ?? null,
    xp: u.xp ?? 0,
    level: u.level ?? 1,
    studyMinutes: u.totalMinutes,
    totalMinutes: u.totalMinutes,
    todayMinutes: u.todayMinutes,
    streakDays: u.streakDays ?? 0,
    badge: "",
    isYou: u.id === userId,
  }));

  res.json(GetLeaderboardResponse.parse(formatted));
});

// ── PYQ Bank ──────────────────────────────────────────────────────────────────

// Meta: distinct years, subjects, topics from PYQ exam questions
router.get("/pyqs/meta", async (_req, res) => {
  const pyqExams = await db.select({ id: examsTable.id })
    .from(examsTable).where(eq(examsTable.kind, "pyq"));
  if (pyqExams.length === 0) return res.json({ years: [], subjects: [], topics: [], exams: [] });
  const pyqExamIds = pyqExams.map(e => e.id);

  const [rows, examRows] = await Promise.all([
    db.selectDistinct({ source: questionsTable.source, subject: questionsTable.subject, topic: questionsTable.topic })
      .from(questionsTable)
      .where(and(inArray(questionsTable.examId, pyqExamIds as [string, ...string[]]), isNotNull(questionsTable.source))),
    db.selectDistinct({ exam: examsTable.exam })
      .from(examsTable)
      .where(eq(examsTable.kind, "pyq")),
  ]);

  const years    = [...new Set(rows.map(r => r.source).filter(Boolean))].sort().reverse();
  const subjects = [...new Set(rows.map(r => r.subject).filter(Boolean))].sort();
  const topics   = [...new Set(rows.map(r => r.topic).filter(Boolean))].sort();
  const exams    = examRows.map(r => r.exam);
  res.json({ years, subjects, topics, exams });
});

// Questions: paginated, filterable, pro-gated solutions
router.get("/pyqs/questions", async (req, res) => {
  const userId = getAuthUserId(req);
  const [userRow] = await db.select({ plan: usersTable.plan }).from(usersTable).where(eq(usersTable.id, userId));
  const isPro = userRow?.plan === "pro";

  const examFilter    = typeof req.query.exam    === "string" && req.query.exam    ? req.query.exam    : null;
  const yearFilter    = typeof req.query.year    === "string" && req.query.year    ? req.query.year    : null;
  const subjectFilter = typeof req.query.subject === "string" && req.query.subject ? req.query.subject : null;
  const topicFilter   = typeof req.query.topic   === "string" && req.query.topic   ? req.query.topic   : null;
  const kindFilter    = typeof req.query.kind    === "string" && req.query.kind !== "all" ? req.query.kind : null;
  const page    = Math.max(1, parseInt(String(req.query.page || "1"), 10));
  const perPage = 15;
  const offset  = (page - 1) * perPage;

  // Free users: max 10 questions total
  if (!isPro && offset >= 10) return res.json({ questions: [], total: 10, page, hasMore: false, isPro });

  const pyqExams = await db.select({ id: examsTable.id })
    .from(examsTable).where(eq(examsTable.kind, "pyq"));
  if (pyqExams.length === 0) return res.json({ questions: [], total: 0, page, hasMore: false, isPro });
  const pyqExamIds = pyqExams.map(e => e.id);

  const conditions: any[] = [inArray(questionsTable.examId, pyqExamIds as [string, ...string[]])];
  if (examFilter)    conditions.push(ilike(examsTable.exam,          `%${examFilter}%`));
  if (yearFilter)    conditions.push(ilike(questionsTable.source,    `%${yearFilter}%`));
  if (subjectFilter) conditions.push(ilike(questionsTable.subject!,  `%${subjectFilter}%`));
  if (topicFilter)   conditions.push(ilike(questionsTable.topic,     `%${topicFilter}%`));
  if (kindFilter)    conditions.push(eq(questionsTable.kind, kindFilter));

  const effectiveLimit = isPro ? perPage : Math.min(perPage, 10 - offset);

  const [rows, [countRow]] = await Promise.all([
    db.select({
      id:               questionsTable.id,
      kind:             questionsTable.kind,
      body:             questionsTable.body,
      imageUrl:         questionsTable.imageUrl,
      marks:            questionsTable.marks,
      negativeMarks:    questionsTable.negativeMarks,
      topic:            questionsTable.topic,
      subject:          questionsTable.subject,
      subtopic:         questionsTable.subtopic,
      source:           questionsTable.source,
      optionsJson:      questionsTable.optionsJson,
      correctOptionIds: questionsTable.correctOptionIdsJson,
      explanation:      questionsTable.explanation,
      natAnswer:        questionsTable.natAnswer,
      exam:             examsTable.exam,
      examTitle:        examsTable.title,
    })
    .from(questionsTable)
    .leftJoin(examsTable, eq(questionsTable.examId, examsTable.id))
    .where(and(...conditions))
    .orderBy(desc(questionsTable.source), questionsTable.topic)
    .limit(effectiveLimit)
    .offset(offset),
    db.select({ total: count() })
      .from(questionsTable)
      .leftJoin(examsTable, eq(questionsTable.examId, examsTable.id))
      .where(and(...conditions)),
  ]);

  const total = Number(countRow?.total) || 0;
  res.json({
    questions: rows.map(q => ({
      ...q,
      correctOptionIds: isPro ? (q.correctOptionIds as string[]) : [],
      explanation:      isPro ? q.explanation : null,
      natAnswer:        isPro ? q.natAnswer   : null,
    })),
    total: isPro ? total : Math.min(10, total),
    page,
    hasMore: isPro ? offset + perPage < total : false,
    isPro,
  });
});

// ── Mistake Notebook ───────────────────────────────────────────────────────────

router.get("/mistakes/stats", async (req, res) => {
  const userId = getAuthUserId(req);
  const [userRow] = await db.select({ plan: usersTable.plan }).from(usersTable).where(eq(usersTable.id, userId));
  const isPro = userRow?.plan === "pro";

  const attempts = await db.select({ id: examAttemptsTable.id })
    .from(examAttemptsTable)
    .where(and(eq(examAttemptsTable.userId, userId), eq(examAttemptsTable.status, "submitted")));
  if (attempts.length === 0) return res.json({ total: 0, isPro });

  const attemptIds = attempts.map(a => a.id);
  const answers = await db.select({
    questionId:      userAnswersTable.questionId,
    selectedIds:     userAnswersTable.selectedOptionIdsJson,
    natValue:        userAnswersTable.natValue,
    status:          userAnswersTable.status,
    kind:            questionsTable.kind,
    correctIds:      questionsTable.correctOptionIdsJson,
    natAnswer:       questionsTable.natAnswer,
    submittedAt:     examAttemptsTable.submittedAt,
  })
  .from(userAnswersTable)
  .innerJoin(questionsTable, eq(userAnswersTable.questionId, questionsTable.id))
  .innerJoin(examAttemptsTable, eq(userAnswersTable.attemptId, examAttemptsTable.id))
  .where(inArray(userAnswersTable.attemptId, attemptIds as [string, ...string[]]));

  // Deduplicate by question (keep latest) then count wrong
  const latest = new Map<string, typeof answers[number]>();
  for (const a of [...answers].sort((x, y) => new Date(y.submittedAt!).getTime() - new Date(x.submittedAt!).getTime())) {
    if (!latest.has(a.questionId)) latest.set(a.questionId, a);
  }
  let total = 0;
  for (const a of latest.values()) {
    if (a.status === "unanswered") { total++; continue; }
    if (a.kind === "nat") {
      if (a.natValue === null || a.natAnswer === null || Math.abs(a.natValue - a.natAnswer) > 0.01) total++;
    } else {
      const correct = new Set(a.correctIds as string[]);
      const given   = new Set(a.selectedIds as string[]);
      if (correct.size !== given.size || [...correct].some(id => !given.has(id))) total++;
    }
  }
  res.json({ total, isPro });
});

router.get("/mistakes", async (req, res) => {
  const userId = getAuthUserId(req);
  const [userRow] = await db.select({ plan: usersTable.plan }).from(usersTable).where(eq(usersTable.id, userId));
  const isPro = userRow?.plan === "pro";

  const examFilter  = typeof req.query.exam  === "string" && req.query.exam  ? req.query.exam  : null;
  const topicFilter = typeof req.query.topic === "string" && req.query.topic ? req.query.topic : null;
  const page   = Math.max(1, parseInt(String(req.query.page || "1"), 10));
  const perPage = 20;

  // Free: cap at 10
  if (!isPro && (page - 1) * perPage >= 10) return res.json({ mistakes: [], total: 10, hasMore: false, isPro });

  const attempts = await db.select({ id: examAttemptsTable.id })
    .from(examAttemptsTable)
    .where(and(eq(examAttemptsTable.userId, userId), eq(examAttemptsTable.status, "submitted")));
  if (attempts.length === 0) return res.json({ mistakes: [], total: 0, hasMore: false, isPro });

  const attemptIds = attempts.map(a => a.id);
  const answers = await db.select({
    questionId:      userAnswersTable.questionId,
    selectedIds:     userAnswersTable.selectedOptionIdsJson,
    natValue:        userAnswersTable.natValue,
    status:          userAnswersTable.status,
    kind:            questionsTable.kind,
    body:            questionsTable.body,
    imageUrl:        questionsTable.imageUrl,
    topic:           questionsTable.topic,
    subject:         questionsTable.subject,
    subtopic:        questionsTable.subtopic,
    source:          questionsTable.source,
    marks:           questionsTable.marks,
    optionsJson:     questionsTable.optionsJson,
    correctIds:      questionsTable.correctOptionIdsJson,
    explanation:     questionsTable.explanation,
    natAnswer:       questionsTable.natAnswer,
    exam:            examsTable.exam,
    examTitle:       examsTable.title,
    submittedAt:     examAttemptsTable.submittedAt,
    attemptId:       examAttemptsTable.id,
  })
  .from(userAnswersTable)
  .innerJoin(questionsTable, eq(userAnswersTable.questionId, questionsTable.id))
  .innerJoin(examAttemptsTable, eq(userAnswersTable.attemptId, examAttemptsTable.id))
  .innerJoin(examsTable, eq(examAttemptsTable.examId, examsTable.id))
  .where(and(
    inArray(userAnswersTable.attemptId, attemptIds as [string, ...string[]]),
    ...(examFilter  ? [ilike(examsTable.exam,   `%${examFilter}%`)]  : []),
    ...(topicFilter ? [ilike(questionsTable.topic, `%${topicFilter}%`)] : []),
  ))
  .orderBy(desc(examAttemptsTable.submittedAt));

  // Deduplicate by question (keep latest attempt)
  const latest = new Map<string, typeof answers[number]>();
  for (const a of answers) {
    if (!latest.has(a.questionId)) latest.set(a.questionId, a);
  }

  // Filter wrong answers
  const wrong = [...latest.values()].filter(a => {
    if (a.status === "unanswered") return true;
    if (a.kind === "nat") {
      return a.natValue === null || a.natAnswer === null || Math.abs(a.natValue - a.natAnswer) > 0.01;
    }
    const correct = new Set(a.correctIds as string[]);
    const given   = new Set(a.selectedIds as string[]);
    return correct.size !== given.size || [...correct].some(id => !given.has(id));
  });

  const total   = wrong.length;
  const capped  = isPro ? wrong : wrong.slice(0, 10);
  const paged   = capped.slice((page - 1) * perPage, page * perPage);

  res.json({
    mistakes: paged.map(a => ({
      questionId:      a.questionId,
      kind:            a.kind,
      body:            a.body,
      imageUrl:        a.imageUrl,
      topic:           a.topic,
      subject:         a.subject,
      subtopic:        a.subtopic,
      source:          a.source,
      marks:           a.marks,
      optionsJson:     a.optionsJson as { id: string; body: string }[],
      correctIds:      a.correctIds as string[],
      explanation:     a.explanation,
      natAnswer:       a.natAnswer,
      yourSelectedIds: a.selectedIds as string[],
      yourNatValue:    a.natValue,
      yourStatus:      a.status,
      exam:            a.exam,
      examTitle:       a.examTitle,
      takenAt:         a.submittedAt,
    })),
    total: isPro ? total : Math.min(10, total),
    hasMore: isPro ? page * perPage < total : false,
    isPro,
  });
});

// DOUBTS
router.get("/doubts", async (_req, res) => {
  const doubts = await db.select({
    id: doubtsTable.id,
    authorId: doubtsTable.askedById,
    title: doubtsTable.title,
    body: doubtsTable.body,
    topic: doubtsTable.topic,
    exam: doubtsTable.exam,
    bountyXp: doubtsTable.bountyXp,
    createdAt: doubtsTable.createdAt,
    resolved: doubtsTable.resolved,
    askedBy: usersTable.displayName,
    askedByAvatar: usersTable.avatarUrl,
  })
  .from(doubtsTable)
  .leftJoin(usersTable, eq(doubtsTable.askedById, usersTable.id))
  .orderBy(desc(doubtsTable.createdAt))
  .limit(50);

  const formatted = doubts.map(d => ({
    ...d,
    askedBy: d.askedBy || "Unknown",
    askedByAvatar: d.askedByAvatar || "",
    answerCount: 0 // Mock for MVP
  }));
  res.json(ListDoubtsResponse.parse(formatted));
});

// Local schema supersedes the orval-generated CreateDoubtBody — adds subject + imageUrls
// (the auto-generated schema lags because codegen is broken on Node 21).
const CreateDoubtBodyV2 = z.object({
  title:      z.string().min(5).max(200),
  body:       z.string().min(10).max(10000),
  topic:      z.string().min(1).max(100),
  exam:       z.string().min(1).max(50),
  subject:    z.string().max(100).optional(),
  bountyXp:   z.coerce.number().int().min(0).max(1000).optional(),
  imageUrls:  z.array(z.string().regex(/^https:\/\//i)).max(8).optional(),
  questionId: z.string().max(100).nullable().optional(),
  examId:     z.string().max(100).nullable().optional(),
});

router.post("/doubts", async (req, res) => {
  const parsed = CreateDoubtBodyV2.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  const userId = getAuthUserId(req);
  const id = randomUUID();
  const [d] = await db.insert(doubtsTable).values({
    id,
    askedById: userId,
    title: parsed.data.title,
    body: parsed.data.body,
    topic: parsed.data.topic,
    subject: parsed.data.subject ?? null,
    exam: parsed.data.exam,
    imageUrls: parsed.data.imageUrls ?? [],
    bountyXp: parsed.data.bountyXp || 50,
    questionId: parsed.data.questionId ?? null,
    examId:     parsed.data.examId     ?? null,
  }).returning();

  const [me] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  res.json({
    ...d,
    askedBy: me?.displayName || "Me",
    askedByAvatar: me?.avatarUrl || "",
    answerCount: 0,
  });
});

// List doubts linked to a specific question (powers "💬 N discussions" badge)
router.get("/questions/:id/doubts", async (req, res) => {
  const questionId = req.params.id;
  const rows = await db.select({
    id: doubtsTable.id,
    title: doubtsTable.title,
    bountyXp: doubtsTable.bountyXp,
    createdAt: doubtsTable.createdAt,
    resolved: doubtsTable.resolved,
    askedBy: usersTable.displayName,
  })
  .from(doubtsTable)
  .leftJoin(usersTable, eq(doubtsTable.askedById, usersTable.id))
  .where(eq(doubtsTable.questionId, questionId))
  .orderBy(desc(doubtsTable.createdAt))
  .limit(20);

  // For each doubt, count answers
  const doubtIds = rows.map(r => r.id);
  let countsByDoubt: Map<string, number> = new Map();
  if (doubtIds.length > 0) {
    const counts = await db.select({
      doubtId: doubtAnswersTable.doubtId,
      n: count(),
    })
    .from(doubtAnswersTable)
    .where(inArray(doubtAnswersTable.doubtId, doubtIds))
    .groupBy(doubtAnswersTable.doubtId);
    countsByDoubt = new Map(counts.map(c => [c.doubtId, Number(c.n)]));
  }

  res.json(rows.map(r => ({
    id: r.id,
    title: r.title,
    askedBy: r.askedBy || "Anonymous",
    bountyXp: r.bountyXp,
    answerCount: countsByDoubt.get(r.id) ?? 0,
    createdAt: r.createdAt,
    resolved: r.resolved,
  })));
});

// ── Mock Performance: Weakest subtopics across all submitted attempts ─────────
router.get("/mock/performance/weak-subtopics", requireAuth, async (req, res) => {
  const userId = getAuthUserId(req);

  const attempts = await db
    .select({ id: examAttemptsTable.id })
    .from(examAttemptsTable)
    .where(and(eq(examAttemptsTable.userId, userId), eq(examAttemptsTable.status, "submitted")));

  if (attempts.length === 0) return res.json([]);

  const attemptIds = attempts.map(a => a.id);

  const rows = await db
    .select({
      subtopic: questionsTable.subtopic,
      subject:  questionsTable.subject,
      topic:    questionsTable.topic,
      kind:     questionsTable.kind,
      correctOptionIds: questionsTable.correctOptionIdsJson,
      natAnswer:        questionsTable.natAnswer,
      selectedOptions:  userAnswersTable.selectedOptionIdsJson,
      natValue:         userAnswersTable.natValue,
      answerStatus:     userAnswersTable.status,
    })
    .from(userAnswersTable)
    .innerJoin(questionsTable, eq(userAnswersTable.questionId, questionsTable.id))
    .where(inArray(userAnswersTable.attemptId, attemptIds));

  const subtopicMap = new Map<string, { correct: number; total: number; subject: string; topic: string }>();

  for (const row of rows) {
    if (row.answerStatus === "unanswered") continue;
    const key = row.subtopic || row.topic;
    if (!key) continue;

    const entry = subtopicMap.get(key) ?? { correct: 0, total: 0, subject: row.subject || "", topic: row.topic || "" };
    entry.total++;

    let isCorrect = false;
    if (row.kind === "nat") {
      if (row.natValue != null && row.natAnswer != null) {
        isCorrect = Math.abs((row.natValue as number) - (row.natAnswer as number)) <= 0.001;
      }
    } else {
      const selected = (row.selectedOptions as string[]) || [];
      const correctIds = (row.correctOptionIds as string[]) || [];
      isCorrect = selected.length === correctIds.length && selected.every(id => correctIds.includes(id));
    }

    if (isCorrect) entry.correct++;
    subtopicMap.set(key, entry);
  }

  const result = Array.from(subtopicMap.entries())
    .filter(([, v]) => v.total >= 3)
    .map(([subtopic, v]) => ({
      subtopic,
      subject: v.subject,
      topic:   v.topic,
      accuracy: Math.round((v.correct / v.total) * 100),
      total:   v.total,
      correct: v.correct,
    }))
    .sort((a, b) => a.accuracy - b.accuracy)
    .slice(0, 8);

  res.json(result);
});

// ── Recommended next exams based on weak topics ───────────────────────────────
router.get("/mock/performance/recommended-exams", requireAuth, async (req, res) => {
  const userId = getAuthUserId(req);

  // Reuse weak-subtopics logic to get top weak areas
  const attempts = await db
    .select({ id: examAttemptsTable.id })
    .from(examAttemptsTable)
    .where(and(eq(examAttemptsTable.userId, userId), eq(examAttemptsTable.status, "submitted")));

  // Get exams the user has already attempted
  const attemptedExamIds = new Set(
    (await db.select({ examId: examAttemptsTable.examId })
      .from(examAttemptsTable)
      .where(eq(examAttemptsTable.userId, userId)))
      .map(r => r.examId)
  );

  // Get all published exams
  const allExams = await db
    .select({ id: examsTable.id, title: examsTable.title, exam: examsTable.exam,
              kind: examsTable.kind, durationMinutes: examsTable.durationMinutes,
              totalQuestions: examsTable.totalQuestions, difficulty: examsTable.difficulty,
              topicsJson: examsTable.topicsJson })
    .from(examsTable)
    .where(eq(examsTable.isLive, true))
    .limit(100);

  if (allExams.length === 0) return res.json([]);

  // If user has no attempts, return random 3 unattempted exams
  if (attempts.length === 0) {
    const unattempted = allExams.filter(e => !attemptedExamIds.has(e.id)).slice(0, 3);
    return res.json(unattempted.map(e => ({ ...e, matchScore: 0, matchReasons: [] })));
  }

  // Compute weak topics
  const attemptIds = attempts.map(a => a.id);
  const rows = await db
    .select({ topic: questionsTable.topic, subtopic: questionsTable.subtopic,
              kind: questionsTable.kind, correctOptionIds: questionsTable.correctOptionIdsJson,
              natAnswer: questionsTable.natAnswer, selectedOptions: userAnswersTable.selectedOptionIdsJson,
              natValue: userAnswersTable.natValue, answerStatus: userAnswersTable.status })
    .from(userAnswersTable)
    .innerJoin(questionsTable, eq(userAnswersTable.questionId, questionsTable.id))
    .where(inArray(userAnswersTable.attemptId, attemptIds));

  const topicMap = new Map<string, { correct: number; total: number }>();
  for (const row of rows) {
    if (row.answerStatus === "unanswered") continue;
    const key = row.subtopic || row.topic;
    if (!key) continue;
    const entry = topicMap.get(key) ?? { correct: 0, total: 0 };
    entry.total++;
    let isCorrect = false;
    if (row.kind === "nat") {
      if (row.natValue != null && row.natAnswer != null)
        isCorrect = Math.abs((row.natValue as number) - (row.natAnswer as number)) <= 0.001;
    } else {
      const selected = (row.selectedOptions as string[]) || [];
      const correctIds = (row.correctOptionIds as string[]) || [];
      isCorrect = selected.length === correctIds.length && selected.every(id => correctIds.includes(id));
    }
    if (isCorrect) entry.correct++;
    topicMap.set(key, entry);
  }

  const weakTopics = new Set(
    Array.from(topicMap.entries())
      .filter(([, v]) => v.total >= 2)
      .sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total))
      .slice(0, 5)
      .map(([topic]) => topic.toLowerCase())
  );

  // Score each exam by topic overlap with weak areas
  const scored = allExams.map(e => {
    const topics = (e.topicsJson as string[]) || [];
    const matches = topics.filter(t => {
      const tl = t.toLowerCase();
      return Array.from(weakTopics).some(w => tl.includes(w) || w.includes(tl));
    });
    return { ...e, matchScore: matches.length, matchReasons: matches.slice(0, 3) };
  });

  // Prefer unattempted, then sort by match score desc
  const unattempted = scored.filter(e => !attemptedExamIds.has(e.id)).sort((a, b) => b.matchScore - a.matchScore);
  const attempted   = scored.filter(e =>  attemptedExamIds.has(e.id)).sort((a, b) => b.matchScore - a.matchScore);

  const result = [...unattempted, ...attempted].slice(0, 3);
  res.json(result);
});

// ── Mock Cohort Stats: weekly attempts + user percentile ──────────────────────
router.get("/mock/exams/:id/cohort-stats", requireAuth, async (req, res) => {
  const examId  = req.params.id;
  const userId  = getAuthUserId(req);
  const weekAgo = new Date(Date.now() - 7 * 86_400_000);

  const [{ total }] = await db
    .select({ total: count() })
    .from(examAttemptsTable)
    .where(and(
      eq(examAttemptsTable.examId, examId),
      eq(examAttemptsTable.status, "submitted"),
      gte(examAttemptsTable.startedAt, weekAgo),
    ));

  const [myAttempt] = await db
    .select({ score: examAttemptsTable.score })
    .from(examAttemptsTable)
    .where(and(
      eq(examAttemptsTable.examId, examId),
      eq(examAttemptsTable.userId, userId),
      eq(examAttemptsTable.status, "submitted"),
    ))
    .orderBy(desc(examAttemptsTable.submittedAt))
    .limit(1);

  let beatPercentage: number | null = null;
  if (myAttempt?.score != null && Number(total) > 1) {
    const [{ beaten }] = await db
      .select({ beaten: count() })
      .from(examAttemptsTable)
      .where(and(
        eq(examAttemptsTable.examId, examId),
        eq(examAttemptsTable.status, "submitted"),
        gte(examAttemptsTable.startedAt, weekAgo),
        sql`${examAttemptsTable.score} < ${myAttempt.score}`,
      ));
    beatPercentage = Math.round((Number(beaten) / Number(total)) * 100);
  }

  res.json({ totalAttempts: Number(total), beatPercentage });
});

// ── Related doubts: topic/subtopic match (auto-recommend, Part 4 Layer 2) ─────
router.get("/questions/:id/related-doubts", requireAuth, async (req, res) => {
  const questionId = req.params.id;
  const topic    = String(req.query.topic    || "");
  const subtopic = String(req.query.subtopic || "");

  if (!topic && !subtopic) return res.json([]);

  const topicConditions: ReturnType<typeof eq>[] = [];
  if (subtopic) topicConditions.push(eq(doubtsTable.topic, subtopic));
  if (topic)    topicConditions.push(ilike(doubtsTable.topic, topic));

  const rows = await db.select({
    id:        doubtsTable.id,
    title:     doubtsTable.title,
    topic:     doubtsTable.topic,
    bountyXp:  doubtsTable.bountyXp,
    createdAt: doubtsTable.createdAt,
    resolved:  doubtsTable.resolved,
    askedBy:   usersTable.displayName,
  })
  .from(doubtsTable)
  .leftJoin(usersTable, eq(doubtsTable.askedById, usersTable.id))
  .where(and(
    or(isNull(doubtsTable.questionId), ne(doubtsTable.questionId, questionId)),
    or(...topicConditions),
  ))
  .orderBy(desc(doubtsTable.createdAt))
  .limit(3);

  res.json(rows.map(r => ({
    id:          r.id,
    title:       r.title,
    topic:       r.topic,
    askedBy:     r.askedBy || "Anonymous",
    bountyXp:    r.bountyXp,
    createdAt:   r.createdAt,
    resolved:    r.resolved,
    answerCount: 0,
  })));
});

router.get("/doubts/:id", async (req, res) => {
  const params = GetDoubtParams.safeParse({ id: idOf(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const [d] = await db.select({
    id: doubtsTable.id,
    authorId: doubtsTable.askedById,
    title: doubtsTable.title,
    body: doubtsTable.body,
    topic: doubtsTable.topic,
    exam: doubtsTable.exam,
    bountyXp: doubtsTable.bountyXp,
    createdAt: doubtsTable.createdAt,
    resolved: doubtsTable.resolved,
    askedBy: usersTable.displayName,
    askedByAvatar: usersTable.avatarUrl,
  })
  .from(doubtsTable)
  .leftJoin(usersTable, eq(doubtsTable.askedById, usersTable.id))
  .where(eq(doubtsTable.id, params.data.id));

  if (!d) {
    res.status(404).json({ error: "Doubt not found" });
    return;
  }

  const answers = await db.select({
    id: doubtAnswersTable.id,
    doubtId: doubtAnswersTable.doubtId,
    authorId: doubtAnswersTable.authorId,
    body: doubtAnswersTable.body,
    upvotes: doubtAnswersTable.upvotes,
    isAccepted: doubtAnswersTable.accepted,
    createdAt: doubtAnswersTable.createdAt,
    authorName: usersTable.displayName,
    authorAvatar: usersTable.avatarUrl,
  })
  .from(doubtAnswersTable)
  .leftJoin(usersTable, eq(doubtAnswersTable.authorId, usersTable.id))
  .where(eq(doubtAnswersTable.doubtId, params.data.id))
  .orderBy(desc(doubtAnswersTable.upvotes));

  const formattedAnswers = answers.map(a => ({
    ...a,
    authorName: a.authorName || "Unknown",
    authorAvatar: a.authorAvatar || "",
    mineUpvoted: false
  }));

  res.json(GetDoubtResponse.parse({
    ...d,
    askedBy: d.askedBy || "Unknown",
    askedByAvatar: d.askedByAvatar || "",
    answerCount: answers.length,
    answers: formattedAnswers
  }));
});

const AnswerDoubtBodyV2 = z.object({
  body:      z.string().min(2).max(10000),
  imageUrls: z.array(z.string().regex(/^https:\/\//i)).max(8).optional(),
});

router.post("/doubts/:id/answers", async (req, res) => {
  const id = String(req.params.id).slice(0, 100);
  const body = AnswerDoubtBodyV2.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }

  const userId = getAuthUserId(req);
  const answerId = randomUUID();
  const [a] = await db.insert(doubtAnswersTable).values({
    id: answerId,
    doubtId: id,
    authorId: userId,
    body: body.data.body,
    imageUrls: body.data.imageUrls ?? [],
  }).returning();

  const [me] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  // Notify the doubt author (skip if they're answering their own doubt)
  const [doubt] = await db.select().from(doubtsTable).where(eq(doubtsTable.id, id));
  if (doubt && doubt.askedById !== userId) {
    createNotification(
      doubt.askedById,
      "doubt_reply",
      "New answer on your doubt",
      `${me?.displayName ?? "Someone"} answered: "${doubt.title.slice(0, 60)}${doubt.title.length > 60 ? "…" : ""}"`,
      `/doubts/${doubt.id}`,
    );
  }

  res.json({
    ...a,
    authorName: me?.displayName || "Me",
    authorAvatar: me?.avatarUrl || "",
    imageUrls: a.imageUrls ?? [],
    mineUpvoted: false,
    isAccepted: false,
    comments: [],
  });
});

// ─── Answer upvote — toggle (the frontend calls /api/answers/:id/upvote) ─────
router.post("/answers/:id/upvote", async (req, res) => {
  const answerId = String(req.params.id).slice(0, 100);
  const userId = getAuthUserId(req);

  const [existing] = await db.select().from(doubtAnswersTable).where(eq(doubtAnswersTable.id, answerId));
  if (!existing) return res.status(404).json({ error: "Answer not found" });

  const [already] = await db.select().from(doubtAnswerUpvotesTable)
    .where(and(eq(doubtAnswerUpvotesTable.userId, userId), eq(doubtAnswerUpvotesTable.answerId, answerId)));

  if (already) {
    // Toggle off
    await db.delete(doubtAnswerUpvotesTable)
      .where(and(eq(doubtAnswerUpvotesTable.userId, userId), eq(doubtAnswerUpvotesTable.answerId, answerId)));
    const [a] = await db.update(doubtAnswersTable)
      .set({ upvotes: Math.max(0, existing.upvotes - 1) })
      .where(eq(doubtAnswersTable.id, answerId)).returning();
    return res.json({ upvotes: a.upvotes, mineUpvoted: false });
  } else {
    await db.insert(doubtAnswerUpvotesTable).values({ userId, answerId });
    const [a] = await db.update(doubtAnswersTable)
      .set({ upvotes: existing.upvotes + 1 })
      .where(eq(doubtAnswersTable.id, answerId)).returning();
    return res.json({ upvotes: a.upvotes, mineUpvoted: true });
  }
});

// ─── Question upvote — toggle ────────────────────────────────────────────────
router.post("/doubts/:id/upvote", async (req, res) => {
  const doubtId = String(req.params.id).slice(0, 100);
  const userId = getAuthUserId(req);

  const [doubt] = await db.select().from(doubtsTable).where(eq(doubtsTable.id, doubtId));
  if (!doubt) return res.status(404).json({ error: "Doubt not found" });

  const [already] = await db.select().from(doubtUpvotesTable)
    .where(and(eq(doubtUpvotesTable.userId, userId), eq(doubtUpvotesTable.doubtId, doubtId)));

  if (already) {
    await db.delete(doubtUpvotesTable)
      .where(and(eq(doubtUpvotesTable.userId, userId), eq(doubtUpvotesTable.doubtId, doubtId)));
    const [d] = await db.update(doubtsTable)
      .set({ upvotes: Math.max(0, doubt.upvotes - 1) })
      .where(eq(doubtsTable.id, doubtId)).returning();
    return res.json({ upvotes: d.upvotes, mineUpvoted: false });
  } else {
    await db.insert(doubtUpvotesTable).values({ userId, doubtId });
    const [d] = await db.update(doubtsTable)
      .set({ upvotes: doubt.upvotes + 1 })
      .where(eq(doubtsTable.id, doubtId)).returning();
    return res.json({ upvotes: d.upvotes, mineUpvoted: true });
  }
});

// ─── Accept best answer (asker-only) — toggles, only one accepted per doubt ──
router.post("/doubts/:doubtId/answers/:answerId/accept", async (req, res) => {
  const doubtId  = String(req.params.doubtId).slice(0, 100);
  const answerId = String(req.params.answerId).slice(0, 100);
  const userId = getAuthUserId(req);

  const [doubt] = await db.select().from(doubtsTable).where(eq(doubtsTable.id, doubtId));
  if (!doubt) return res.status(404).json({ error: "Doubt not found" });
  if (doubt.askedById !== userId) return res.status(403).json({ error: "Only the asker can accept an answer" });

  const [answer] = await db.select().from(doubtAnswersTable)
    .where(and(eq(doubtAnswersTable.id, answerId), eq(doubtAnswersTable.doubtId, doubtId)));
  if (!answer) return res.status(404).json({ error: "Answer not found" });

  if (answer.accepted) {
    // Toggle off
    await db.update(doubtAnswersTable).set({ accepted: false }).where(eq(doubtAnswersTable.id, answerId));
    await db.update(doubtsTable).set({ resolved: false }).where(eq(doubtsTable.id, doubtId));
    return res.json({ accepted: false, resolved: false });
  }

  // Unaccept any other accepted answer on this doubt first
  await db.update(doubtAnswersTable)
    .set({ accepted: false })
    .where(and(eq(doubtAnswersTable.doubtId, doubtId), eq(doubtAnswersTable.accepted, true)));
  await db.update(doubtAnswersTable).set({ accepted: true }).where(eq(doubtAnswersTable.id, answerId));
  await db.update(doubtsTable).set({ resolved: true }).where(eq(doubtsTable.id, doubtId));

  return res.json({ accepted: true, resolved: true });
});

// ─── Comments on answers (StackOverflow-style clarifications) ────────────────
const AnswerCommentBody = z.object({ body: z.string().min(1).max(2000) });

router.post("/answers/:id/comments", async (req, res) => {
  const answerId = String(req.params.id).slice(0, 100);
  const parsed = AnswerCommentBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const userId = getAuthUserId(req);
  const id = randomUUID();
  const [c] = await db.insert(doubtAnswerCommentsTable).values({
    id, answerId, authorId: userId, body: parsed.data.body,
  }).returning();
  const [me] = await db.select().from(usersTable).where(eq(usersTable.id, userId));

  res.json({
    id: c.id,
    body: c.body,
    createdAt: c.createdAt,
    authorId: c.authorId,
    authorName: me?.displayName || "Me",
    authorAvatar: me?.avatarUrl || "",
  });
});

router.delete("/answer-comments/:id", async (req, res) => {
  const id = String(req.params.id).slice(0, 100);
  const userId = getAuthUserId(req);
  const [c] = await db.select().from(doubtAnswerCommentsTable).where(eq(doubtAnswerCommentsTable.id, id));
  if (!c) return res.status(404).json({ error: "Comment not found" });
  if (c.authorId !== userId) return res.status(403).json({ error: "Only the author can delete" });
  await db.delete(doubtAnswerCommentsTable).where(eq(doubtAnswerCommentsTable.id, id));
  res.json({ ok: true });
});

// PODS
router.get("/pods", (_req, res): void => {
  res.json(ListPodsResponse.parse(store.listPods()));
});

router.get("/pods/:id", (req, res): void => {
  const params = GetPodParams.safeParse({ id: idOf(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const p = store.getPod(params.data.id);
  if (!p) {
    res.status(404).json({ error: "Pod not found" });
    return;
  }
  res.json(GetPodResponse.parse(p));
});

// RESOURCES
router.get("/resources", (_req, res): void => {
  res.json(ListResourcesResponse.parse(store.listResources()));
});

router.post("/resources", (req, res): void => {
  const parsed = CreateResourceBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  res.json(CreateResourceResponse.parse(store.createResource(parsed.data)));
});

// REVISION
router.get("/revision/stats", (_req, res): void => {
  res.json(store.getRevisionStats());
});

router.get("/revision/community-decks", (_req, res): void => {
  res.json(store.getCommunityDecks());
});

router.get("/revision/leaderboard", (_req, res): void => {
  res.json(store.getRevisionLeaderboard());
});
router.get("/revision/items", (_req, res): void => {
  res.json(ListRevisionItemsResponse.parse(store.listRevision()));
});

router.post("/revision/items", (req, res): void => {
  const parsed = CreateRevisionItemBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  res.json(CreateRevisionItemResponse.parse(store.createRevision(parsed.data)));
});

router.post("/revision/items/:id/review", (req, res): void => {
  const params = ReviewRevisionItemParams.safeParse({ id: idOf(req.params.id) });
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }
  const body = ReviewRevisionItemBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: body.error.message });
    return;
  }
  const r = store.reviewRevision(params.data.id, body.data.quality);
  if (!r) {
    res.status(404).json({ error: "Revision item not found" });
    return;
  }
  res.json(ReviewRevisionItemResponse.parse(r));
});

// CALENDAR
router.get("/calendar/events", (_req, res): void => {
  res.json(ListCalendarEventsResponse.parse(store.listCalendar()));
});

router.post("/calendar/events", (req, res): void => {
  const parsed = CreateCalendarEventBody.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.message });
    return;
  }
  res.json(CreateCalendarEventResponse.parse(store.createCalendar(parsed.data)));
});

// ACHIEVEMENTS
router.get("/achievements", (_req, res): void => {
  res.json(ListAchievementsResponse.parse(store.listAchievements()));
});

// ── DIRECT MESSAGES (DMs) ──────────────────────────────────────────────────

// List all conversations for the current user
router.get("/dms", async (req, res) => {
  try {
    const userId = getAuthUserId(req);

    const conversations = await db
      .select({
        id: dmConversationsTable.id,
        user1Id: dmConversationsTable.user1Id,
        user2Id: dmConversationsTable.user2Id,
        updatedAt: dmConversationsTable.updatedAt,
      })
      .from(dmConversationsTable)
      .where(or(
        eq(dmConversationsTable.user1Id, userId),
        eq(dmConversationsTable.user2Id, userId),
      ))
      .orderBy(desc(dmConversationsTable.updatedAt))
      .limit(50);

    if (conversations.length === 0) {
      return res.json({ conversations: [] });
    }

    const otherUserIds = conversations.map((conv) =>
      conv.user1Id === userId ? conv.user2Id : conv.user1Id,
    );
    const convIds = conversations.map((c) => c.id);

    const otherUsers = await db
      .select({
        id: usersTable.id,
        displayName: usersTable.displayName,
        avatarUrl: usersTable.avatarUrl,
      })
      .from(usersTable)
      .where(inArray(usersTable.id, otherUserIds));

    const userById = new Map(otherUsers.map((u) => [u.id, u]));

    // Fetch last message per conversation using a safe subquery approach
    const lastMessageByConv = new Map<string, { body: string; createdAt: Date }>();
    if (convIds.length > 0) {
      const lastMessages = await db
        .select({
          conversationId: directMessagesTable.conversationId,
          body: directMessagesTable.body,
          createdAt: directMessagesTable.createdAt,
        })
        .from(directMessagesTable)
        .where(
          and(
            inArray(directMessagesTable.conversationId, convIds),
            sql`${directMessagesTable.createdAt} = (
              SELECT MAX(dm2.created_at) FROM direct_messages dm2
              WHERE dm2.conversation_id = ${directMessagesTable.conversationId}
            )`,
          ),
        );

      for (const msg of lastMessages) {
        lastMessageByConv.set(msg.conversationId, { body: msg.body, createdAt: msg.createdAt });
      }
    }

    const formatted = conversations.map((conv) => {
      const otherUserId = conv.user1Id === userId ? conv.user2Id : conv.user1Id;
      const otherUser = userById.get(otherUserId);
      return {
        id: conv.id,
        otherUser: {
          id: otherUser?.id || otherUserId,
          displayName: otherUser?.displayName || "Unknown User",
          avatarUrl: otherUser?.avatarUrl || "",
        },
        lastMessage: lastMessageByConv.get(conv.id) ?? null,
        updatedAt: conv.updatedAt,
      };
    });

    res.json({ conversations: formatted });
  } catch (error: any) {
    console.error("GET /api/dms Error:", error);
    res.status(500).json({ error: error.message, stack: error.stack });
  }
});

// Create or get a conversation with a specific user
router.post("/dms/user/:targetUserId", async (req, res) => {
  const userId = getAuthUserId(req);
  const { targetUserId } = req.params;

  if (userId === targetUserId) {
    return res.status(400).json({ error: "Cannot DM yourself" });
  }

  // Check if they are connected
  const isConnected = await db.select().from(connectionsTable)
    .where(and(
      or(
        and(eq(connectionsTable.requesterId, userId), eq(connectionsTable.recipientId, targetUserId)),
        and(eq(connectionsTable.requesterId, targetUserId), eq(connectionsTable.recipientId, userId))
      ),
      eq(connectionsTable.status, "accepted")
    ));

  if (isConnected.length === 0) {
    return res.status(403).json({ error: "You must be connected to send a direct message" });
  }

  // Check if conversation already exists
  const existing = await db.select().from(dmConversationsTable)
    .where(or(
      and(eq(dmConversationsTable.user1Id, userId), eq(dmConversationsTable.user2Id, targetUserId)),
      and(eq(dmConversationsTable.user1Id, targetUserId), eq(dmConversationsTable.user2Id, userId))
    ));

  if (existing.length > 0) {
    return res.json({ conversation: existing[0] });
  }

  // Create new conversation
  const id = randomUUID();
  const [newConv] = await db.insert(dmConversationsTable).values({
    id,
    user1Id: userId,
    user2Id: targetUserId,
  }).returning();

  res.json({ conversation: newConv });
});

// Get messages for a conversation
router.get("/dms/:conversationId/messages", async (req, res) => {
  const { conversationId } = req.params;
  const userId = getAuthUserId(req);

  // Ensure user is part of the conversation
  const [conv] = await db.select().from(dmConversationsTable).where(eq(dmConversationsTable.id, conversationId));
  if (!conv || (conv.user1Id !== userId && conv.user2Id !== userId)) {
    return res.status(403).json({ error: "Access denied" });
  }

  const messages = await db.select({
    id: directMessagesTable.id,
    body: directMessagesTable.body,
    createdAt: directMessagesTable.createdAt,
    author: {
      id: usersTable.id,
      displayName: usersTable.displayName,
      avatarUrl: usersTable.avatarUrl,
    }
  }).from(directMessagesTable)
    .leftJoin(usersTable, eq(directMessagesTable.authorId, usersTable.id))
    .where(eq(directMessagesTable.conversationId, conversationId))
    .orderBy(desc(directMessagesTable.createdAt))
    .limit(50);

  // Reverse so oldest is first (typical chat order)
  res.json({ messages: messages.reverse() });
});

// Send a DM
router.post("/dms/:conversationId/messages", async (req, res) => {
  const { conversationId } = req.params;
  const parsed = z.object({ body: z.string().min(1).max(4000) }).safeParse(req.body);
  const userId = getAuthUserId(req);

  if (!parsed.success || !parsed.data.body.trim()) {
    return res.status(400).json({ error: "Message body required" });
  }
  const { body } = parsed.data;

  // Ensure user is part of the conversation
  const [conv] = await db.select().from(dmConversationsTable).where(eq(dmConversationsTable.id, conversationId));
  if (!conv || (conv.user1Id !== userId && conv.user2Id !== userId)) {
    return res.status(403).json({ error: "Access denied" });
  }

  const targetUserId = conv.user1Id === userId ? conv.user2Id : conv.user1Id;

  // Check connection status
  const isConnected = await db.select().from(connectionsTable)
    .where(and(
      or(
        and(eq(connectionsTable.requesterId, userId), eq(connectionsTable.recipientId, targetUserId)),
        and(eq(connectionsTable.requesterId, targetUserId), eq(connectionsTable.recipientId, userId))
      ),
      eq(connectionsTable.status, "accepted")
    ));

  if (isConnected.length === 0) {
    return res.status(403).json({ error: "You must be connected to send a direct message" });
  }

  const id = randomUUID();
  const [msg] = await db.insert(directMessagesTable).values({
    id,
    conversationId,
    authorId: userId,
    body,
  }).returning();

  // Update conversation updatedAt
  await db.update(dmConversationsTable)
    .set({ updatedAt: new Date() })
    .where(eq(dmConversationsTable.id, conversationId));

  // Emit socket event to both users
  try {
    const io = getIO();
    io.to(`user_${conv.user1Id}`).to(`user_${conv.user2Id}`).emit("dm:new", {
      message: { ...msg, conversationId },
    });
  } catch (e) {}

  res.json({ message: msg });
});
// ---------------------------------------------------------------------------
// User Profiles & Following
// ---------------------------------------------------------------------------

router.get("/users/:targetUserId/profile", async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const currentUserId = getAuthUserId(req);
    
    // Get target user
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, targetUserId));
    if (!user) return res.status(404).json({ error: "User not found" });

    // Get followers/following counts (use COUNT to avoid fetching all rows)
    const [followersCount] = await db
      .select({ cnt: count() })
      .from(userFollowersTable)
      .where(eq(userFollowersTable.followingId, targetUserId));
    const [followingCount] = await db
      .select({ cnt: count() })
      .from(userFollowersTable)
      .where(eq(userFollowersTable.followerId, targetUserId));
    
    // Check if current user is following (targeted single-row lookup)
    const isFollowing = currentUserId
      ? !!(await db.select({ id: userFollowersTable.followerId })
          .from(userFollowersTable)
          .where(and(eq(userFollowersTable.followerId, currentUserId), eq(userFollowersTable.followingId, targetUserId)))
          .limit(1)).length
      : false;

    // Check connection status
    let connectionStatus = null;
    if (currentUserId) {
      const [conn] = await db.select().from(connectionsTable)
        .where(or(
          and(eq(connectionsTable.requesterId, currentUserId), eq(connectionsTable.recipientId, targetUserId)),
          and(eq(connectionsTable.requesterId, targetUserId), eq(connectionsTable.recipientId, currentUserId))
        ));
      if (conn) connectionStatus = conn.status;
    }

    // Get today's study minutes for the Aura calculation
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const [dailyStats] = await db
      .select({ total: sql<number>`cast(sum(${studySessionsTable.durationMinutes}) as integer)` })
      .from(studySessionsTable)
      .where(and(eq(studySessionsTable.userId, targetUserId), gte(studySessionsTable.startedAt, today)));
      
    res.json({
      ...user,
      dailyStudyMinutes: dailyStats?.total || 0,
      _count: {
        followers: Number(followersCount?.cnt ?? 0),
        following: Number(followingCount?.cnt ?? 0)
      },
      isFollowing,
      connectionStatus,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load profile" });
  }
});


router.post("/users/:targetUserId/follow", async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const currentUserId = getAuthUserId(req);
    if (!currentUserId || currentUserId === targetUserId) return res.status(400).json({ error: "Invalid request" });
    
    await db.insert(userFollowersTable).values({
      followerId: currentUserId,
      followingId: targetUserId,
    }).onConflictDoNothing();
    
    res.json({ success: true, isFollowing: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to follow" });
  }
});

// Mock upgrade to Pro
router.post("/users/mock-upgrade", requireAuth, async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const [updatedUser] = await db.update(usersTable).set({ plan: "pro" }).where(eq(usersTable.id, userId)).returning();
    res.json(updatedUser);
  } catch (err) {
    console.error("Mock upgrade failed", err);
    res.status(500).json({ error: "Upgrade failed" });
  }
});

router.delete("/users/:targetUserId/follow", async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const currentUserId = getAuthUserId(req);
    if (!currentUserId) return res.status(401).json({ error: "Unauthorized" });
    
    await db.delete(userFollowersTable).where(
      and(
        eq(userFollowersTable.followerId, currentUserId),
        eq(userFollowersTable.followingId, targetUserId)
      )
    );
    
    res.json({ success: true, isFollowing: false });
  } catch (err) {
    res.status(500).json({ error: "Failed to unfollow" });
  }
});// ---------------------------------------------------------------------------
// Connections (Focus Protection & DMs)
// ---------------------------------------------------------------------------

router.get("/connections", async (req, res) => {
  try {
    const currentUserId = getAuthUserId(req);
    
    // Fetch connections where the user is either the requester or recipient
    const connections = await db.select({
      id: connectionsTable.id,
      requesterId: connectionsTable.requesterId,
      recipientId: connectionsTable.recipientId,
      status: connectionsTable.status,
      context: connectionsTable.context,
      createdAt: connectionsTable.createdAt,
      updatedAt: connectionsTable.updatedAt,
      requester: {
        id: usersTable.id,
        displayName: usersTable.displayName,
        avatarUrl: usersTable.avatarUrl,
      },
    })
    .from(connectionsTable)
    .leftJoin(usersTable, eq(connectionsTable.requesterId, usersTable.id))
    .where(or(
      eq(connectionsTable.requesterId, currentUserId),
      eq(connectionsTable.recipientId, currentUserId)
    ));

    // For frontend convenience, let's also fetch recipient details separately and map them
    const recipientIds = connections.map(c => c.recipientId);
    let recipientsMap = new Map();
    if (recipientIds.length > 0) {
      const recipients = await db.select({
        id: usersTable.id,
        displayName: usersTable.displayName,
        avatarUrl: usersTable.avatarUrl,
      }).from(usersTable).where(inArray(usersTable.id, recipientIds));
      recipientsMap = new Map(recipients.map(u => [u.id, u]));
    }

    const mappedConnections = connections.map(c => ({
      ...c,
      recipient: recipientsMap.get(c.recipientId) || null,
    }));

    res.json({ connections: mappedConnections });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to load connections" });
  }
});

router.post("/connections/:targetUserId", async (req, res) => {
  try {
    const { targetUserId } = req.params;
    const currentUserId = getAuthUserId(req);
    const parsed = z.object({ context: z.string().max(500).nullable().optional() }).safeParse(req.body ?? {});
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.message });
    }
    const { context } = parsed.data;

    if (!currentUserId || currentUserId === targetUserId) {
      return res.status(400).json({ error: "Invalid request" });
    }

    // Check if a connection already exists
    const existing = await db.select().from(connectionsTable)
      .where(or(
        and(eq(connectionsTable.requesterId, currentUserId), eq(connectionsTable.recipientId, targetUserId)),
        and(eq(connectionsTable.requesterId, targetUserId), eq(connectionsTable.recipientId, currentUserId))
      ));

    if (existing.length > 0) {
      return res.status(400).json({ error: "Connection already exists or is pending", connection: existing[0] });
    }

    const id = randomUUID();
    const [newConn] = await db.insert(connectionsTable).values({
      id,
      requesterId: currentUserId,
      recipientId: targetUserId,
      status: "pending",
      context: context || null,
    }).returning();

    res.json({ success: true, connection: newConn });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create connection request" });
  }
});

router.post("/connections/:connectionId/accept", async (req, res) => {
  try {
    const { connectionId } = req.params;
    const currentUserId = getAuthUserId(req);

    const [conn] = await db.select().from(connectionsTable).where(eq(connectionsTable.id, connectionId));
    if (!conn) return res.status(404).json({ error: "Connection not found" });

    if (conn.recipientId !== currentUserId) {
      return res.status(403).json({ error: "Not authorized to accept this request" });
    }

    const [updatedConn] = await db.update(connectionsTable)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(eq(connectionsTable.id, connectionId))
      .returning();

    res.json({ success: true, connection: updatedConn });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to accept connection" });
  }
});

router.post("/connections/:connectionId/reject", async (req, res) => {
  try {
    const { connectionId } = req.params;
    const currentUserId = getAuthUserId(req);

    const [conn] = await db.select().from(connectionsTable).where(eq(connectionsTable.id, connectionId));
    if (!conn) return res.status(404).json({ error: "Connection not found" });

    if (conn.recipientId !== currentUserId && conn.requesterId !== currentUserId) {
      return res.status(403).json({ error: "Not authorized" });
    }

    await db.update(connectionsTable)
      .set({ status: "rejected", updatedAt: new Date() })
      .where(eq(connectionsTable.id, connectionId));

    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to reject connection" });
  }
});

// ── STICKY NOTES ─────────────────────────────────────────────────────────────

router.get("/sticky-notes", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const notes = await db.select().from(stickyNotesTable)
      .where(eq(stickyNotesTable.userId, userId))
      .orderBy(desc(stickyNotesTable.createdAt));
    res.json(notes);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch sticky notes" });
  }
});

router.post("/sticky-notes", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { content, color } = req.body;
    if (!content || typeof content !== "string" || content.trim() === "") {
      res.status(400).json({ error: "content is required" });
      return;
    }
    const [note] = await db.insert(stickyNotesTable).values({
      id: randomUUID(),
      userId,
      content: content.trim(),
      color: color ?? "yellow",
      pinned: "false",
    }).returning();
    res.json(note);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to create sticky note" });
  }
});

router.patch("/sticky-notes/:id/pin", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const noteId = req.params.id;
    const [existing] = await db.select().from(stickyNotesTable)
      .where(and(eq(stickyNotesTable.id, noteId), eq(stickyNotesTable.userId, userId)));
    if (!existing) { res.status(404).json({ error: "Note not found" }); return; }

    // Unpin all notes first, then pin the selected one
    await db.update(stickyNotesTable)
      .set({ pinned: "false", updatedAt: new Date() })
      .where(eq(stickyNotesTable.userId, userId));

    const newPinned = existing.pinned === "true" ? "false" : "true";
    const [updated] = await db.update(stickyNotesTable)
      .set({ pinned: newPinned, updatedAt: new Date() })
      .where(eq(stickyNotesTable.id, noteId))
      .returning();
    res.json(updated);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to pin sticky note" });
  }
});

router.delete("/sticky-notes/:id", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const noteId = req.params.id;
    const [existing] = await db.select().from(stickyNotesTable)
      .where(and(eq(stickyNotesTable.id, noteId), eq(stickyNotesTable.userId, userId)));
    if (!existing) { res.status(404).json({ error: "Note not found" }); return; }
    await db.delete(stickyNotesTable).where(eq(stickyNotesTable.id, noteId));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete sticky note" });
  }
});

// ── USER AIM ──────────────────────────────────────────────────────────────────

router.get("/aim", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const [aim] = await db.select().from(userAimTable).where(eq(userAimTable.userId, userId));
    res.json(aim ?? null);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch aim" });
  }
});

router.put("/aim", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    const { examName, examDate, targetScore, personalNote } = req.body;
    if (!examName || !examDate) {
      res.status(400).json({ error: "examName and examDate are required" });
      return;
    }
    const [aim] = await db.insert(userAimTable).values({
      userId,
      examName,
      examDate,
      targetScore: targetScore ?? null,
      personalNote: personalNote ?? null,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: userAimTable.userId,
      set: { examName, examDate, targetScore: targetScore ?? null, personalNote: personalNote ?? null, updatedAt: new Date() },
    })
    .returning();
    res.json(aim);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to save aim" });
  }
});

router.delete("/aim", async (req, res) => {
  try {
    const userId = getAuthUserId(req);
    await db.delete(userAimTable).where(eq(userAimTable.userId, userId));
    res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to delete aim" });
  }
});

// ---------------------------------------------------------------------------
// Notifications
// ---------------------------------------------------------------------------

// Helper — create a notification (fire-and-forget, never throws)
export async function createNotification(
  userId: string,
  type: string,
  title: string,
  body: string,
  link?: string,
) {
  try {
    await db.insert(notificationsTable).values({
      id: randomUUID(),
      userId,
      type,
      title,
      body,
      link: link ?? null,
    });
  } catch {
    // Notifications are non-critical; silently ignore failures
  }
}

router.get("/notifications", async (req, res) => {
  const userId = getAuthUserId(req);
  const notifs = await db
    .select()
    .from(notificationsTable)
    .where(eq(notificationsTable.userId, userId))
    .orderBy(desc(notificationsTable.createdAt))
    .limit(50);
  res.json(notifs);
});

router.get("/notifications/unread-count", async (req, res) => {
  const userId = getAuthUserId(req);
  const [row] = await db
    .select({ cnt: count() })
    .from(notificationsTable)
    .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.read, false)));
  res.json({ count: row?.cnt ?? 0 });
});

router.patch("/notifications/read-all", async (req, res) => {
  const userId = getAuthUserId(req);
  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(and(eq(notificationsTable.userId, userId), eq(notificationsTable.read, false)));
  res.json({ ok: true });
});

router.patch("/notifications/:id/read", async (req, res) => {
  const userId = getAuthUserId(req);
  await db
    .update(notificationsTable)
    .set({ read: true })
    .where(and(eq(notificationsTable.id, req.params.id), eq(notificationsTable.userId, userId)));
  res.json({ ok: true });
});

// ── Today's Focus: flashcards due + next upcoming exam ────────────────────────
router.get("/me/today-focus", async (req, res) => {
  const userId = getAuthUserId(req);
  const now = new Date();

  const [flashcardsDueRow, nextExamRows] = await Promise.all([
    db.select({ n: count() })
      .from(flashcardsTable)
      .where(and(eq(flashcardsTable.userId, userId), sql`${flashcardsTable.dueDate} <= ${now}`)),
    db.select({ id: examsTable.id, title: examsTable.title, scheduledAt: examsTable.scheduledAt })
      .from(examsTable)
      .where(and(eq(examsTable.isLive, true), isNotNull(examsTable.scheduledAt), sql`${examsTable.scheduledAt} > ${now}`))
      .orderBy(examsTable.scheduledAt)
      .limit(1),
  ]);

  res.json({
    flashcardsDue: Number(flashcardsDueRow[0]?.n ?? 0),
    nextExam: nextExamRows[0]
      ? { id: nextExamRows[0].id, title: nextExamRows[0].title, scheduledAt: nextExamRows[0].scheduledAt }
      : null,
  });
});

// ── Topic Practice: random questions by topic/subtopic ────────────────────────
router.get("/practice/questions", async (req, res) => {
  const topic = typeof req.query.topic === "string" ? req.query.topic.trim() : "";
  if (!topic) return res.status(400).json({ error: "topic is required" });
  const limit = Math.min(30, Math.max(1, parseInt(String(req.query.limit ?? "10")) || 10));

  const questions = await db.select({
    id: questionsTable.id,
    kind: questionsTable.kind,
    body: questionsTable.body,
    imageUrl: questionsTable.imageUrl,
    topic: questionsTable.topic,
    subtopic: questionsTable.subtopic,
    subject: questionsTable.subject,
    source: questionsTable.source,
    marks: questionsTable.marks,
    negativeMarks: questionsTable.negativeMarks,
    options: questionsTable.optionsJson,
  })
  .from(questionsTable)
  .where(or(ilike(questionsTable.subtopic, topic), ilike(questionsTable.topic, topic)))
  .orderBy(sql`RANDOM()`)
  .limit(limit);

  res.json({ questions });
});

const practiceCheckSchema = z.object({
  answers: z.array(z.object({
    questionId: z.string(),
    selectedOptionIds: z.array(z.string()).default([]),
    natValue: z.number().optional(),
  })),
});

router.post("/practice/check", async (req, res) => {
  const parsed = practiceCheckSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });

  const questionIds = parsed.data.answers.map(a => a.questionId);
  if (questionIds.length === 0) return res.json({ results: [], totalScore: 0 });

  const questions = await db.select({
    id: questionsTable.id,
    kind: questionsTable.kind,
    correctOptionIds: questionsTable.correctOptionIdsJson,
    natAnswer: questionsTable.natAnswer,
    explanation: questionsTable.explanation,
    marks: questionsTable.marks,
    negativeMarks: questionsTable.negativeMarks,
  })
  .from(questionsTable)
  .where(inArray(questionsTable.id, questionIds));

  const qMap = new Map(questions.map(q => [q.id, q]));
  let totalScore = 0;

  const results = parsed.data.answers.map(a => {
    const q = qMap.get(a.questionId);
    if (!q) return null;

    const skipped = (a.selectedOptionIds?.length === 0) && a.natValue == null;
    let correct = false;

    if (!skipped) {
      if (q.kind === "nat") {
        correct = a.natValue != null && q.natAnswer != null &&
          Math.abs(a.natValue - (q.natAnswer as number)) <= 0.001;
      } else {
        const correctIds = (q.correctOptionIds as string[]) || [];
        const sel = a.selectedOptionIds || [];
        correct = sel.length === correctIds.length && sel.every(id => correctIds.includes(id));
      }
    }

    if (correct) totalScore += Number(q.marks);
    else if (!skipped) totalScore -= Number(q.negativeMarks ?? 0);

    return {
      questionId: a.questionId,
      correct,
      skipped,
      correctOptionIds: q.correctOptionIds as string[],
      natAnswer: q.natAnswer,
      explanation: q.explanation,
    };
  }).filter(Boolean);

  res.json({ results, totalScore });
});

// ── Retry wrong answers from an exam attempt ──────────────────────────────────
router.get("/practice/retry", async (req, res) => {
  const userId = getAuthUserId(req);
  const attemptId = typeof req.query.attemptId === "string" ? req.query.attemptId : null;
  if (!attemptId) return res.status(400).json({ error: "attemptId is required" });

  const [attempt] = await db
    .select({ id: examAttemptsTable.id, userId: examAttemptsTable.userId })
    .from(examAttemptsTable)
    .where(and(eq(examAttemptsTable.id, attemptId), eq(examAttemptsTable.userId, userId)));

  if (!attempt) return res.status(404).json({ error: "Attempt not found" });

  // Fetch all answered questions with the user's answers
  const rows = await db
    .select({
      id: questionsTable.id,
      kind: questionsTable.kind,
      body: questionsTable.body,
      imageUrl: questionsTable.imageUrl,
      topic: questionsTable.topic,
      subtopic: questionsTable.subtopic,
      subject: questionsTable.subject,
      source: questionsTable.source,
      marks: questionsTable.marks,
      negativeMarks: questionsTable.negativeMarks,
      options: questionsTable.optionsJson,
      correctOptionIds: questionsTable.correctOptionIdsJson,
      natAnswer: questionsTable.natAnswer,
      selectedIds: userAnswersTable.selectedOptionIdsJson,
      natValue: userAnswersTable.natValue,
      status: userAnswersTable.status,
    })
    .from(userAnswersTable)
    .innerJoin(questionsTable, eq(userAnswersTable.questionId, questionsTable.id))
    .where(eq(userAnswersTable.attemptId, attemptId));

  const wrongQuestions = rows.filter(r => {
    if (!r.status || r.status === "unanswered" || r.status === "marked") return false;
    const selectedIds = (r.selectedIds as string[]) ?? [];
    const correctIds = (r.correctOptionIds as string[]) ?? [];
    if (r.kind === "nat") {
      return r.natValue === null || Math.abs(r.natValue - (r.natAnswer ?? 0)) >= 0.01;
    }
    return !(correctIds.length === selectedIds.length && correctIds.every(id => selectedIds.includes(id)));
  }).map(r => ({
    id: r.id, kind: r.kind, body: r.body, imageUrl: r.imageUrl,
    topic: r.topic, subtopic: r.subtopic, subject: r.subject, source: r.source,
    marks: r.marks, negativeMarks: r.negativeMarks,
    options: r.options,
  }));

  res.json({ questions: wrongQuestions });
});

// ─── Onboarding ───────────────────────────────────────────────────────────────

const onboardingSchema = z.object({
  examFocus:          z.string().min(1).max(50),
  dailyTargetMinutes: z.number().int().min(15).max(480),
});

router.patch("/me/onboarding", async (req, res) => {
  const userId = getAuthUserId(req);
  const parsed = onboardingSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.message });
  const { examFocus, dailyTargetMinutes } = parsed.data;
  await db.update(usersTable)
    .set({ examFocus, dailyTargetMinutes })
    .where(eq(usersTable.id, userId));
  res.json({ ok: true });
});

const FALLBACK_QUESTION = {
  id: "onboarding-demo",
  kind: "mcq" as const,
  body: "Which of the following is a sorting algorithm?",
  options: [
    { id: "a", body: "Binary Search" },
    { id: "b", body: "Bubble Sort" },
    { id: "c", body: "Hash Map" },
    { id: "d", body: "Stack" },
  ],
  correctOptionIds: ["b"],
  explanation: "Bubble Sort repeatedly steps through the list, compares adjacent elements and swaps them if they are in the wrong order.",
  topic: "Data Structures",
  subject: "Computer Science",
};

router.get("/onboarding/sample-question", async (req, res) => {
  const [q] = await db.select({
    id: questionsTable.id,
    kind: questionsTable.kind,
    body: questionsTable.body,
    options: questionsTable.optionsJson,
    correctOptionIds: questionsTable.correctOptionIdsJson,
    explanation: questionsTable.explanation,
    topic: questionsTable.topic,
    subject: questionsTable.subject,
  })
  .from(questionsTable)
  .where(eq(questionsTable.kind, "mcq"))
  .orderBy(sql`RANDOM()`)
  .limit(1);

  if (!q) return res.json(FALLBACK_QUESTION);

  res.json({
    id: q.id,
    kind: q.kind,
    body: q.body,
    options: q.options as { id: string; body: string }[],
    correctOptionIds: q.correctOptionIds as string[],
    explanation: q.explanation,
    topic: q.topic,
    subject: q.subject,
  });
});

export default router;
