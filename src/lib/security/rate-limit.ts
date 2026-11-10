import crypto from "node:crypto";
import { isIP } from "node:net";
import type { TrustedProxyMode } from "@/lib/env";
import { parseTrustedProxyMode } from "@/lib/env";

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
  backend?: "memory" | "upstash_redis" | "memory_fallback";
}

const DEFAULT_MAX_REQUESTS = 12;
const DEFAULT_WINDOW_MS = 60_000;
const MAX_TRACKED_KEYS = 2_000;
const REDIS_TIMEOUT_MS = 1_500;
const UNTRUSTED_CLIENT_BUCKET = "untrusted-client";

const requestLogByKey = new Map<string, number[]>();
let activeAnalysisCount = 0;

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
      backend: "memory",
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
    backend: "memory",
  };
}

export function resetRateLimiter(): void {
  requestLogByKey.clear();
  activeAnalysisCount = 0;
}

export function normalizeValidatedIp(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let candidate = raw.trim().slice(0, 64);
  if (!candidate) return null;

  if (candidate.startsWith("[") && candidate.includes("]")) {
    candidate = candidate.slice(1, candidate.indexOf("]"));
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(candidate)) {
    candidate = candidate.split(":")[0] ?? "";
  }

  if (candidate.toLowerCase().startsWith("::ffff:")) {
    candidate = candidate.slice(7);
  }

  return isIP(candidate) !== 0 ? candidate : null;
}

export function getClientIpFromRequest(
  request: Request,
  options?: { trustedProxyMode?: TrustedProxyMode }
): string {
  const mode =
    options?.trustedProxyMode ??
    parseTrustedProxyMode(process.env.TRUSTED_PROXY_MODE);

  if (mode === "none") {
    // Do not trust spoofable x-forwarded-for / x-real-ip headers when no trusted edge proxy is configured
    return UNTRUSTED_CLIENT_BUCKET;
  }

  if (mode === "vercel") {
    const vercelIp = request.headers
      .get("x-vercel-forwarded-for")
      ?.split(",")[0];
    return normalizeValidatedIp(vercelIp) ?? UNTRUSTED_CLIENT_BUCKET;
  }

  if (mode === "cloudflare") {
    const cfIp = request.headers.get("cf-connecting-ip");
    return normalizeValidatedIp(cfIp) ?? UNTRUSTED_CLIENT_BUCKET;
  }

  // forwarded-rightmost: inspect rightmost hop appended by the trusted proxy, ignoring spoofed leftmost values
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded.split(",");
    for (let idx = hops.length - 1; idx >= 0; idx -= 1) {
      const valid = normalizeValidatedIp(hops[idx]);
      if (valid) return valid;
    }
  }

  return UNTRUSTED_CLIENT_BUCKET;
}

function hashRateLimitKey(rawKey: string): string {
  return crypto.createHash("sha256").update(rawKey).digest("hex").slice(0, 24);
}

interface UpstashPipelineCommandResult {
  result?: unknown;
  error?: string;
}

export async function enforceDistributedRateLimit(params: {
  key: string;
  namespace: string;
  maxRequests: number;
  windowMs: number;
  upstashUrl?: string;
  upstashToken?: string;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<RateLimitResult> {
  const {
    key,
    namespace,
    maxRequests,
    windowMs,
    upstashUrl,
    upstashToken,
    fetchImpl = fetch,
    now = Date.now(),
  } = params;

  const safeLimit = Math.max(1, maxRequests);
  const safeWindowMs = Math.max(1_000, windowMs);

  if (!upstashUrl || !upstashToken) {
    return checkRateLimit(`${namespace}:${key}`, {
      maxRequests: safeLimit,
      windowMs: safeWindowMs,
      now,
    });
  }

  const windowBucket = Math.floor(now / safeWindowMs);
  const redisKey = `klaimscan:${namespace}:${windowBucket}:${hashRateLimitKey(key)}`;
  const endpoint = `${upstashUrl.replace(/\/+$/, "")}/pipeline`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REDIS_TIMEOUT_MS);

  try {
    const response = await fetchImpl(endpoint, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${upstashToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([
        ["INCR", redisKey],
        ["PTTL", redisKey],
      ]),
    });

    if (!response.ok) {
      throw new Error(`Upstash HTTP ${response.status}`);
    }

    const data = (await response.json()) as UpstashPipelineCommandResult[];
    const count = Number(data?.[0]?.result);
    const pttl = Number(data?.[1]?.result);

    if (!Number.isFinite(count) || count <= 0) {
      throw new Error("Invalid Upstash pipeline counter response");
    }

    if (!Number.isFinite(pttl) || pttl < 0) {
      const expireTtlMs = safeWindowMs + 2_000;
      void fetchImpl(endpoint, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${upstashToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify([["PEXPIRE", redisKey, expireTtlMs]]),
      }).catch(() => undefined);
    }

    const effectiveTtlMs =
      Number.isFinite(pttl) && pttl > 0
        ? pttl
        : (windowBucket + 1) * safeWindowMs - now;
    const resetAt = now + Math.max(1_000, effectiveTtlMs);

    if (count > safeLimit) {
      return {
        allowed: false,
        limit: safeLimit,
        remaining: 0,
        resetAt,
        retryAfterSeconds: Math.max(1, Math.ceil((resetAt - now) / 1000)),
        backend: "upstash_redis",
      };
    }

    return {
      allowed: true,
      limit: safeLimit,
      remaining: Math.max(0, safeLimit - count),
      resetAt,
      retryAfterSeconds: 0,
      backend: "upstash_redis",
    };
  } catch {
    console.warn(
      JSON.stringify({
        level: "warn",
        event: "distributed_rate_limiter_fallback",
        namespace,
      })
    );
    const local = checkRateLimit(`${namespace}:${key}`, {
      maxRequests: safeLimit,
      windowMs: safeWindowMs,
      now,
    });
    return {
      ...local,
      backend: "memory_fallback",
    };
  } finally {
    clearTimeout(timer);
  }
}

export async function consumeGlobalCreditQuota(params: {
  maxHourlyRequests: number;
  upstashUrl?: string;
  upstashToken?: string;
  fetchImpl?: typeof fetch;
  now?: number;
}): Promise<RateLimitResult> {
  return enforceDistributedRateLimit({
    key: "__global_hourly__",
    namespace: "global-credits",
    maxRequests: params.maxHourlyRequests,
    windowMs: 3_600_000,
    upstashUrl: params.upstashUrl,
    upstashToken: params.upstashToken,
    fetchImpl: params.fetchImpl,
    now: params.now,
  });
}

export function tryAcquireAnalysisSlot(
  maxConcurrent: number
): { acquired: boolean; activeCount: number; release: () => void } {
  const safeMax = Math.max(1, maxConcurrent);
  if (activeAnalysisCount >= safeMax) {
    return {
      acquired: false,
      activeCount: activeAnalysisCount,
      release: () => undefined,
    };
  }

  activeAnalysisCount += 1;
  let released = false;

  return {
    acquired: true,
    activeCount: activeAnalysisCount,
    release: () => {
      if (!released) {
        released = true;
        activeAnalysisCount = Math.max(0, activeAnalysisCount - 1);
      }
    },
  };
}

export function verifyAnalyzeAccessToken(
  request: Request,
  configuredToken?: string
): boolean {
  if (!configuredToken) return true;

  const headerToken = request.headers.get("x-klaimscan-access-token")?.trim();
  const authHeader = request.headers.get("authorization")?.trim();
  const bearerToken =
    authHeader && /^Bearer\s+/i.test(authHeader)
      ? authHeader.replace(/^Bearer\s+/i, "").trim()
      : undefined;

  const candidate = headerToken || bearerToken;
  if (!candidate) return false;

  const expectedDigest = crypto
    .createHash("sha256")
    .update(configuredToken)
    .digest();
  const actualDigest = crypto.createHash("sha256").update(candidate).digest();

  return crypto.timingSafeEqual(expectedDigest, actualDigest);
}
