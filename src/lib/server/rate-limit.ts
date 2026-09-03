/**
 * QTB DEV TOOLS — in-memory sliding-window rate limiter.
 *
 * Designed for the single-node deployment model (no external cache required).
 * Buckets live in module scope, survive across requests, and are pruned
 * lazily so the map never grows unbounded.
 */

interface HitRecord {
  hits: number[];
}

const buckets = new Map<string, HitRecord>();

let callCounter = 0;
const SWEEP_EVERY = 500;

function sweep(now: number, windowMs: number): void {
  if (buckets.size < 4000) return;
  for (const [key, rec] of buckets) {
    const alive = rec.hits.filter((t) => now - t < windowMs);
    if (alive.length === 0) buckets.delete(key);
    else rec.hits = alive;
  }
}

export interface RateLimitResult {
  ok: boolean;
  /** Seconds until the oldest hit leaves the window (for Retry-After). */
  retryAfterSec: number;
  remaining: number;
}

/**
 * Records one hit against `key`. Returns whether the action is allowed
 * under a sliding window of `limit` hits per `windowMs`.
 */
export function hitRateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  callCounter += 1;
  if (callCounter % SWEEP_EVERY === 0) sweep(now, windowMs);

  const rec = buckets.get(key) ?? { hits: [] };
  rec.hits = rec.hits.filter((t) => now - t < windowMs);

  if (rec.hits.length >= limit) {
    const oldest = rec.hits[0] ?? now;
    buckets.set(key, rec);
    return {
      ok: false,
      retryAfterSec: Math.max(1, Math.ceil((oldest + windowMs - now) / 1000)),
      remaining: 0,
    };
  }

  rec.hits.push(now);
  buckets.set(key, rec);
  return { ok: true, retryAfterSec: 0, remaining: limit - rec.hits.length };
}

/** Clears a bucket (e.g. after a successful login). */
export function clearRateLimit(key: string): void {
  buckets.delete(key);
}

/** Best-effort client IP from proxy headers (Caddy in front of Next). */
export function getClientIp(request: Request): string {
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}

/** Human-readable minutes/seconds for rate-limit messages. */
export function humanWait(retryAfterSec: number): string {
  if (retryAfterSec >= 90) {
    const mins = Math.ceil(retryAfterSec / 60);
    return `${mins} minutes`;
  }
  return `${retryAfterSec} seconds`;
}

/**
 * Enforces a rate limit and returns a ready-to-return 429 Response when the
 * limit is exceeded, or null when the caller may proceed.
 */
export function enforceRateLimit(
  request: Request,
  bucket: string,
  limit: number,
  windowMs: number
): Response | null {
  const ip = getClientIp(request);
  const result = hitRateLimit(`${bucket}:${ip}`, limit, windowMs);
  if (result.ok) return null;
  return Response.json(
    {
      error: `Too many attempts. Please try again in ${humanWait(result.retryAfterSec)}.`,
      code: "RATE_LIMITED",
      retryAfter: result.retryAfterSec,
    },
    { status: 429, headers: { "Retry-After": String(result.retryAfterSec) } }
  );
}

/* ------------------------------------------------------------------ */
/* Auth-specific presets                                               */
/* ------------------------------------------------------------------ */

export const AUTH_LIMITS = {
  /** Login attempts per IP. */
  loginIp: { limit: 10, windowMs: 5 * 60 * 1000 },
  /** Failed logins per IP+email combo (cleared on success). */
  loginFail: { limit: 8, windowMs: 15 * 60 * 1000 },
  /** Registrations per IP. */
  register: { limit: 5, windowMs: 60 * 60 * 1000 },
  /** Password changes per user. */
  changePassword: { limit: 5, windowMs: 15 * 60 * 1000 },
} as const;
