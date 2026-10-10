import path from "node:path";
import express, { type Express, type ErrorRequestHandler } from "express";
import cors from "cors";
import helmet from "helmet";
import pinoHttp from "pino-http";
import rateLimit from "express-rate-limit";
import router from "./routes";
import ogRouter from "./routes/og";
import { logger } from "./lib/logger";

const app: Express = express();

const isProduction = process.env.NODE_ENV === "production";
if (isProduction && !process.env.CORS_ORIGINS) {
  throw new Error("CORS_ORIGINS env var must be set in production");
}

// Trust Render's load balancer so express-rate-limit can read real client IPs from X-Forwarded-For
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://*.clerk.accounts.dev", "https://clerk.com", "https://*.cloudflare.com"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        styleSrcElem: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "https://*.clerk.accounts.dev", "https://clerk.com", "wss:", "https:"],
        frameSrc: ["'self'", "https://*.clerk.accounts.dev"],
        workerSrc: ["'self'", "blob:"],
      },
    },
  }),
);

// Redirect HTTP → HTTPS in production (Render terminates TLS but sets X-Forwarded-Proto)
if (isProduction) {
  app.use((req, res, next) => {
    if (req.headers["x-forwarded-proto"] !== "https") {
      return res.redirect(301, `https://${req.headers.host}${req.url}`);
    }
    next();
  });
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
const corsOrigins = process.env.CORS_ORIGINS?.split(",").map((o) => o.trim()).filter(Boolean) ?? [
  "http://localhost:5173",
  "http://localhost:5000",
];
app.use(
  cors({
    origin: corsOrigins,
    credentials: true,
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));

// Rate limiting middleware
const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100, // Limit each IP to 100 requests per `window` (here, per 1 minute)
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  message: { error: "Too many requests, please try again later." },
});

// Apply rate limiter to all /api routes
app.use("/api", apiLimiter, router);

// ── SEO: robots + sitemap redirect ───────────────────────────────────────────
app.get("/robots.txt", (_req, res) => {
  const siteUrl = process.env.SITE_URL ||
    (process.env.NODE_ENV === "production" ? "https://studycircle-jn9a.onrender.com" : "http://localhost:5173");
  res.setHeader("Content-Type", "text/plain");
  res.send(`User-agent: *\nAllow: /\nAllow: /doubts/\nDisallow: /api/\nSitemap: ${siteUrl}/sitemap.xml`);
});

// Redirect to API-served sitemap (actual endpoint lives in routes/studycircle.ts)
app.get("/sitemap.xml", (_req, res) => res.redirect(301, "/api/sitemap.xml"));

// OG tag injection for social media bots on exam share links (must come before static serving)
app.use(ogRouter);

// Serve static files from the frontend's build directory
const publicDir = path.resolve(__dirname, "..", "..", "studycircle", "dist", "public");
app.use(express.static(publicDir));

// Fallback to index.html for SPA routing
app.use((req, res) => {
  if (req.path.startsWith("/api")) {
    res.status(404).json({ message: "API route not found" });
    return;
  }
  res.sendFile(path.join(publicDir, "index.html"), (err) => {
    if (err) {
      res.status(404).send("Not found");
    }
  });
});

// Centralized error handler — Express 5 forwards rejected async handlers here.
// Catches any route error, logs it, and returns a generic 500 without leaking internals.
const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  req.log?.error({ err }, "Unhandled route error");
  res.status(500).json({ error: "Internal server error" });
};
app.use(errorHandler);

export default app;
