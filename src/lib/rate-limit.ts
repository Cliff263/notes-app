/**
 * A token bucket per caller, held in memory.
 *
 * This is per-instance: two serverless instances keep separate counters, so it
 * raises the cost of guessing rather than making it impossible. That is the
 * right trade for an app this size — swapping the Map for Upstash Redis is the
 * only change needed to make it global.
 */
type Bucket = { tokens: number; updatedAt: number };

const buckets = new Map<string, Bucket>();

/** Stops the map growing without bound on a long-lived server. */
const MAX_KEYS = 10_000;

export type RateLimitResult = {
  ok: boolean;
  remaining: number;
  /** Seconds until the next token, for the Retry-After header. */
  retryAfter: number;
};

export function rateLimit(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const refillRate = limit / windowMs;

  const existing = buckets.get(key);
  const bucket: Bucket = existing ?? { tokens: limit, updatedAt: now };

  // Refill for the time that has passed, capped at the bucket size.
  const refill = (now - bucket.updatedAt) * refillRate;
  bucket.tokens = Math.min(limit, bucket.tokens + refill);
  bucket.updatedAt = now;

  if (bucket.tokens < 1) {
    buckets.set(key, bucket);
    return {
      ok: false,
      remaining: 0,
      retryAfter: Math.ceil((1 - bucket.tokens) / refillRate / 1000),
    };
  }

  bucket.tokens -= 1;

  if (!existing && buckets.size >= MAX_KEYS) {
    // Drop the least recently touched entry rather than growing forever.
    let oldestKey: string | null = null;
    let oldest = Infinity;
    for (const [candidate, value] of buckets) {
      if (value.updatedAt < oldest) {
        oldest = value.updatedAt;
        oldestKey = candidate;
      }
    }
    if (oldestKey) buckets.delete(oldestKey);
  }

  buckets.set(key, bucket);
  return { ok: true, remaining: Math.floor(bucket.tokens), retryAfter: 0 };
}

/** Best-effort client address, trusting the proxy headers a host sets. */
export function clientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]!.trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}

export function tooManyRequests(result: RateLimitResult) {
  return Response.json(
    { error: "Too many attempts. Please wait a moment and try again." },
    { status: 429, headers: { "Retry-After": String(Math.max(result.retryAfter, 1)) } },
  );
}

/** One place for the limits, so they can be reasoned about together. */
export const LIMITS = {
  signup: { limit: 5, windowMs: 60 * 60_000 },
  signIn: { limit: 10, windowMs: 15 * 60_000 },
  signInPerIp: { limit: 40, windowMs: 15 * 60_000 },
  forgot: { limit: 5, windowMs: 60 * 60_000 },
  reset: { limit: 10, windowMs: 60 * 60_000 },
  share: { limit: 60, windowMs: 60_000 },
} as const;

/** Exposed for tests, which need a clean slate between cases. */
export function __resetRateLimits() {
  buckets.clear();
}
