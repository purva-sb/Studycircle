import type { RequestHandler } from "express";

/** Sets HTTP cache hints for read-heavy GET handlers (pairs with client React Query staleTime). */
export function privateCache(maxAgeSeconds: number): RequestHandler {
  return (_req, res, next) => {
    res.set("Cache-Control", `private, max-age=${maxAgeSeconds}`);
    next();
  };
}
