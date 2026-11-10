import { afterEach, describe, expect, it } from "vitest";
import {
  ATOMIC_FIXED_WINDOW_LUA,
  checkRateLimit,
  consumeGlobalCreditQuota,
  enforceDistributedRateLimit,
  getClientIpFromRequest,
  normalizeValidatedIp,
  resetRateLimiter,
  tryAcquireAnalysisSlot,
  verifyAnalyzeAccessToken,
} from "@/lib/security/rate-limit";

describe("rate-limit, proxy trust hardening & API credit safeguards", () => {
  afterEach(() => {
    resetRateLimiter();
  });

  it("permits requests within threshold and blocks overflow with retryAfterSeconds", () => {
    const t0 = 1_700_000_000_000;
    const r1 = checkRateLimit("ip-1", { maxRequests: 2, windowMs: 10_000, now: t0 });
    const r2 = checkRateLimit("ip-1", {
      maxRequests: 2,
      windowMs: 10_000,
      now: t0 + 500,
    });
    const r3 = checkRateLimit("ip-1", {
      maxRequests: 2,
      windowMs: 10_000,
      now: t0 + 1_000,
    });

    expect(r1.allowed).toBe(true);
    expect(r1.remaining).toBe(1);
    expect(r2.allowed).toBe(true);
    expect(r2.remaining).toBe(0);
    expect(r3.allowed).toBe(false);
    expect(r3.retryAfterSeconds).toBeGreaterThanOrEqual(9);
  });

  it("resets allowance after window elapses and isolates separate keys", () => {
    const t0 = 1_700_000_000_000;
    checkRateLimit("ip-a", { maxRequests: 1, windowMs: 5_000, now: t0 });
    expect(
      checkRateLimit("ip-a", { maxRequests: 1, windowMs: 5_000, now: t0 + 100 }).allowed
    ).toBe(false);
    expect(
      checkRateLimit("ip-b", { maxRequests: 1, windowMs: 5_000, now: t0 + 100 }).allowed
    ).toBe(true);
    expect(
      checkRateLimit("ip-a", { maxRequests: 1, windowMs: 5_000, now: t0 + 6_000 }).allowed
    ).toBe(true);
  });

  it("ignores spoofable x-forwarded-for in default untrusted mode and validates platform proxy modes", () => {
    const reqSpoofed = new Request("http://localhost/api/analyze", {
      headers: {
        "x-forwarded-for": "203.0.113.9, 198.51.100.2",
        "x-real-ip": "1.2.3.4",
        "cf-connecting-ip": "5.6.7.8",
      },
    });
    expect(getClientIpFromRequest(reqSpoofed, { trustedProxyMode: "none" })).toBe(
      "untrusted-client"
    );

    const reqVercel = new Request("http://localhost/api/analyze", {
      headers: {
        "x-forwarded-for": "1.1.1.1",
        "x-vercel-forwarded-for": "198.51.100.55",
      },
    });
    expect(getClientIpFromRequest(reqVercel, { trustedProxyMode: "vercel" })).toBe(
      "198.51.100.55"
    );

    const reqCloudflare = new Request("http://localhost/api/analyze", {
      headers: {
        "x-forwarded-for": "1.1.1.1",
        "cf-connecting-ip": "203.0.113.77",
      },
    });
    expect(
      getClientIpFromRequest(reqCloudflare, { trustedProxyMode: "cloudflare" })
    ).toBe("203.0.113.77");

    // In forwarded-rightmost mode, spoofed leftmost IP is ignored in favor of proxy-appended rightmost IP
    expect(
      getClientIpFromRequest(reqSpoofed, {
        trustedProxyMode: "forwarded-rightmost",
      })
    ).toBe("198.51.100.2");

    expect(normalizeValidatedIp("not-an-ip")).toBeNull();
    expect(normalizeValidatedIp("::ffff:203.0.113.10")).toBe("203.0.113.10");
  });

  it("executes atomic Lua INCR+PEXPIRE in one Upstash pipeline call and allows client-limit fallback", async () => {
    const capturedBodies: unknown[] = [];
    let counter = 0;
    const atomicLuaFetch = (async (_url: string, init?: RequestInit) => {
      counter += 1;
      const parsed = JSON.parse(String(init?.body ?? "[]")) as unknown[];
      capturedBodies.push(parsed);
      return new Response(JSON.stringify([{ result: [counter, 58_000] }]), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const first = await enforceDistributedRateLimit({
      key: "203.0.113.10",
      namespace: "test",
      maxRequests: 2,
      windowMs: 60_000,
      upstashUrl: "https://example.upstash.io",
      upstashToken: "secret-token",
      fetchImpl: atomicLuaFetch,
    });
    expect(first.allowed).toBe(true);
    expect(first.remaining).toBe(1);
    expect(first.backend).toBe("upstash_redis");

    // Must send ONE single EVAL Lua command (never separate INCR + PEXPIRE roundtrips)
    expect(capturedBodies).toHaveLength(1);
    const firstCmd = (capturedBodies[0] as unknown[][])[0];
    expect(firstCmd?.[0]).toBe("EVAL");
    expect(firstCmd?.[1]).toBe(ATOMIC_FIXED_WINDOW_LUA);

    await enforceDistributedRateLimit({
      key: "203.0.113.10",
      namespace: "test",
      maxRequests: 2,
      windowMs: 60_000,
      upstashUrl: "https://example.upstash.io",
      upstashToken: "secret-token",
      fetchImpl: atomicLuaFetch,
    });

    const blocked = await enforceDistributedRateLimit({
      key: "203.0.113.10",
      namespace: "test",
      maxRequests: 2,
      windowMs: 60_000,
      upstashUrl: "https://example.upstash.io",
      upstashToken: "secret-token",
      fetchImpl: atomicLuaFetch,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.backend).toBe("upstash_redis");

    // Per-client rate limit keeps memory fallback when Redis temporarily fails
    const fallback = await enforceDistributedRateLimit({
      key: "203.0.113.10",
      namespace: "test",
      maxRequests: 2,
      windowMs: 60_000,
      upstashUrl: "https://example.upstash.io",
      upstashToken: "secret-token",
      fetchImpl: (async () =>
        new Response("error", { status: 500 })) as unknown as typeof fetch,
    });
    expect(fallback.allowed).toBe(true);
    expect(fallback.backend).toBe("memory_fallback");
  });

  it("fails closed on paid global AI credit limits when Redis errors, times out, or is required but missing", async () => {
    const httpErrorQuota = await consumeGlobalCreditQuota({
      maxHourlyRequests: 10,
      upstashUrl: "https://example.upstash.io",
      upstashToken: "secret-token",
      fetchImpl: (async () =>
        new Response("Service Unavailable", { status: 503 })) as unknown as typeof fetch,
    });
    expect(httpErrorQuota.allowed).toBe(false);
    expect(httpErrorQuota.failClosed).toBe(true);
    expect(httpErrorQuota.backend).toBe("store_unavailable");

    const networkTimeoutQuota = await consumeGlobalCreditQuota({
      maxHourlyRequests: 10,
      upstashUrl: "https://example.upstash.io",
      upstashToken: "secret-token",
      fetchImpl: (async () => {
        throw new Error("ETIMEDOUT");
      }) as unknown as typeof fetch,
    });
    expect(networkTimeoutQuota.allowed).toBe(false);
    expect(networkTimeoutQuota.failClosed).toBe(true);
    expect(networkTimeoutQuota.backend).toBe("store_unavailable");

    const missingRequiredStore = await consumeGlobalCreditQuota({
      maxHourlyRequests: 10,
      requireDistributedStore: true,
      upstashUrl: undefined,
      upstashToken: undefined,
    });
    expect(missingRequiredStore.allowed).toBe(false);
    expect(missingRequiredStore.failClosed).toBe(true);
    expect(missingRequiredStore.backend).toBe("store_unavailable");
  });

  it("enforces strict distributed credit & concurrency limits under concurrent bursts without over-issuance", async () => {
    let atomicRedisCount = 0;
    const concurrentRedisFetch = (async () => {
      const next = ++atomicRedisCount;
      await Promise.resolve();
      return new Response(JSON.stringify([{ result: [next, 3_600_000] }]), {
        status: 200,
      });
    }) as unknown as typeof fetch;

    const quotaBurst = await Promise.all(
      Array.from({ length: 10 }, () =>
        consumeGlobalCreditQuota({
          maxHourlyRequests: 3,
          upstashUrl: "https://example.upstash.io",
          upstashToken: "secret-token",
          fetchImpl: concurrentRedisFetch,
        })
      )
    );

    const allowedQuotaCount = quotaBurst.filter((r) => r.allowed).length;
    const blockedQuotaCount = quotaBurst.filter((r) => !r.allowed).length;
    expect(allowedQuotaCount).toBe(3);
    expect(blockedQuotaCount).toBe(7);

    // Concurrent semaphore slot acquisition
    const slots = Array.from({ length: 8 }, () => tryAcquireAnalysisSlot(3));
    expect(slots.filter((s) => s.acquired)).toHaveLength(3);
    expect(slots.filter((s) => !s.acquired)).toHaveLength(5);
    for (const s of slots) s.release();
    expect(tryAcquireAnalysisSlot(1).acquired).toBe(true);
  });

  it("enforces global hourly credit quota, concurrency slots, and optional access tokens", async () => {
    const q1 = await consumeGlobalCreditQuota({ maxHourlyRequests: 1 });
    const q2 = await consumeGlobalCreditQuota({ maxHourlyRequests: 1 });
    expect(q1.allowed).toBe(true);
    expect(q2.allowed).toBe(false);

    const slot1 = tryAcquireAnalysisSlot(1);
    const slot2 = tryAcquireAnalysisSlot(1);
    expect(slot1.acquired).toBe(true);
    expect(slot2.acquired).toBe(false);
    slot1.release();
    const slot3 = tryAcquireAnalysisSlot(1);
    expect(slot3.acquired).toBe(true);
    slot3.release();

    const noTokenReq = new Request("http://localhost/api/analyze");
    expect(verifyAnalyzeAccessToken(noTokenReq, undefined)).toBe(true);
    expect(verifyAnalyzeAccessToken(noTokenReq, "top-secret")).toBe(false);

    const validHeaderReq = new Request("http://localhost/api/analyze", {
      headers: { "x-klaimscan-access-token": "top-secret" },
    });
    expect(verifyAnalyzeAccessToken(validHeaderReq, "top-secret")).toBe(true);
  });
});
