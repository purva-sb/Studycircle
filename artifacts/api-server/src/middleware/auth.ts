import type { Request, RequestHandler } from "express";
import { verifyToken } from "@clerk/backend";

declare global {
  namespace Express {
    interface Request {
      auth?: { userId: string };
    }
  }
}

function getBearerToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith("Bearer ")) return null;
  return auth.slice(7);
}

export async function verifyClerkToken(token: string): Promise<string> {
  const secretKey = process.env.CLERK_SECRET_KEY;
  if (!secretKey) {
    throw new Error("CLERK_SECRET_KEY is not configured");
  }
  const payload = await verifyToken(token, { secretKey });
  if (!payload.sub) {
    throw new Error("Invalid token: missing subject");
  }
  return payload.sub;
}

/** Requires a valid Clerk session JWT. */
export const requireAuth: RequestHandler = async (req, res, next) => {
  const token = getBearerToken(req);
  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  try {
    req.auth = { userId: await verifyClerkToken(token) };
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
};

export function getAuthUserId(req: Request): string {
  const userId = req.auth?.userId;
  if (!userId) {
    throw new Error("Authenticated user required");
  }
  return userId;
}

/** Returns userId if the request has a valid auth token, or null for unauthenticated requests. */
export function getOptionalAuthUserId(req: Request): string | null {
  return req.auth?.userId ?? null;
}

/** Requires a valid Clerk session JWT AND the user's ID must be in ADMIN_USER_IDS env var. */
export const requireAdmin: RequestHandler = async (req, res, next) => {
  const token = getBearerToken(req);
  if (!token) { res.status(401).json({ error: "Unauthorized" }); return; }
  try {
    const userId = await verifyClerkToken(token);
    req.auth = { userId };
    const adminIds = (process.env.ADMIN_USER_IDS ?? "").split(",").map(s => s.trim()).filter(Boolean);
    if (!adminIds.includes(userId)) { res.status(403).json({ error: "Forbidden" }); return; }
    next();
  } catch {
    res.status(401).json({ error: "Unauthorized" });
  }
};
