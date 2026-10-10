import { Router, type Request, type Response, type NextFunction } from "express";
import { db } from "@workspace/db";
import { examsTable } from "@workspace/db/schema";
import { eq, and } from "drizzle-orm";

const router = Router();

const BOT_UA = /whatsapp|telegram|twitterbot|facebookexternalhit|linkedinbot|discordbot|slackbot|googlebot|bingbot|applebot|duckduckbot|pinterestbot|vkshare|w3c_validator/i;

function escapeHtml(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

router.get("/e/:code", async (req: Request, res: Response, next: NextFunction) => {
  if (!BOT_UA.test(req.headers["user-agent"] ?? "")) return next();

  try {
    const code = String(req.params.code).slice(0, 20);
    const [exam] = await db
      .select({
        id: examsTable.id,
        title: examsTable.title,
        exam: examsTable.exam,
        kind: examsTable.kind,
        durationMinutes: examsTable.durationMinutes,
        totalQuestions: examsTable.totalQuestions,
        totalMarks: examsTable.totalMarks,
        difficulty: examsTable.difficulty,
        description: examsTable.description,
        negativeMarking: examsTable.negativeMarking,
      })
      .from(examsTable)
      .where(and(eq(examsTable.inviteCode, code), eq(examsTable.isLive, true)));

    if (!exam) return next();

    const siteUrl =
      process.env.SITE_URL ||
      (process.env.NODE_ENV === "production"
        ? "https://studycircle-jn9a.onrender.com"
        : "http://localhost:5173");

    const url = `${siteUrl}/e/${code}`;
    const title = escapeHtml(`${exam.title} — StudyCircle`);
    const desc = escapeHtml(
      [
        `${exam.exam} Mock Test`,
        `${exam.totalQuestions} Questions`,
        `${exam.durationMinutes} min`,
        `${exam.totalMarks} marks`,
        exam.negativeMarking > 0 ? `Negative marking: −${exam.negativeMarking}` : null,
        exam.description ? exam.description.slice(0, 120) : null,
      ]
        .filter(Boolean)
        .join(" · ")
    );
    const image = `${siteUrl}/og-exam.png`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>${title}</title>
  <meta name="description" content="${desc}">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${url}">
  <meta property="og:title" content="${title}">
  <meta property="og:description" content="${desc}">
  <meta property="og:image" content="${image}">
  <meta property="og:site_name" content="StudyCircle">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${title}">
  <meta name="twitter:description" content="${desc}">
  <meta name="twitter:image" content="${image}">
  <meta http-equiv="refresh" content="0;url=${url}">
</head>
<body>
  <p>Redirecting to <a href="${url}">${title}</a>…</p>
</body>
</html>`);
  } catch {
    next();
  }
});

export default router;
