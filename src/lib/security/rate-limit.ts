export interface RateLimitOptions {
  maxRequests?: number;
  windowMs?: number;
  now?: number;
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
}

const DEFAULT_MAX_REQUESTS = 15;
const DEFAULT_WINDOW_MS = 60_000;
const MAX_TRACKED_KEYS = 2_000;

const requestLogByKey = new Map<string, number[]>();

function pruneStaleEntries(cutoff: number) {
  for (const [key, timestamps] of requestLogByKey.entries()) {
    const active = timestamps.filter((t) => t > cutoff);
    if (active.length === 0) {
      requestLogByKey.delete(key);
    } else {
      requestLogByKey.set(key, active);
    }
  }
}

export function checkRateLimit(
  key: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const maxRequests = Math.max(1, options.maxRequests ?? DEFAULT_MAX_REQUESTS);
  const windowMs = Math.max(1_000, options.windowMs ?? DEFAULT_WINDOW_MS);
  const now = options.now ?? Date.now();
  const cutoff = now - windowMs;

  if (requestLogByKey.size > MAX_TRACKED_KEYS) {
    pruneStaleEntries(cutoff);
  }

  const existing = requestLogByKey.get(key) ?? [];
  const active = existing.filter((timestamp) => timestamp > cutoff);

  if (active.length >= maxRequests) {
    const oldestInWindow = active[0];
    const resetAt = oldestInWindow + windowMs;
    const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));
    requestLogByKey.set(key, active);
    return {
      allowed: false,
      limit: maxRequests,
      remaining: 0,
      resetAt,
      retryAfterSeconds,
    };
  }

  active.push(now);
  requestLogByKey.set(key, active);

  const resetAt = active[0] + windowMs;
  return {
    allowed: true,
    limit: maxRequests,
    remaining: Math.max(0, maxRequests - active.length),
    resetAt,
    retryAfterSeconds: 0,
  };
}

export function resetRateLimiter(): void {
  requestLogByKey.clear();
}

export function getClientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }

  const realIp =
    request.headers.get("x-real-ip") ||
    request.headers.get("cf-connecting-ip");
  if (realIp?.trim()) {
    return realIp.trim().slice(0, 64);
  }

  return "local-client";
}
