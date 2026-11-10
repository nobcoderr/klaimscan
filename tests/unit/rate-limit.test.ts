import { afterEach, describe, expect, it } from "vitest";
import {
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

  it("supports Upstash Redis REST distributed rate limit with graceful fallback", async () => {
    let calls = 0;
    const okFetch = (async () => {
      calls += 1;
      if (calls === 1) {
        return new Response(
          JSON.stringify([{ result: 1 }, { result: -1 }]),
          { status: 200 }
        );
      }
      if (calls === 2) {
        return new Response(JSON.stringify([{ result: "OK" }]), {
          status: 200,
        });
      }
      return new Response(
        JSON.stringify([{ result: 3 }, { result: 45_000 }]),
        { status: 200 }
      );
    }) as unknown as typeof fetch;

    const first = await enforceDistributedRateLimit({
      key: "203.0.113.10",
      namespace: "test",
      maxRequests: 2,
      windowMs: 60_000,
      upstashUrl: "https://example.upstash.io",
      upstashToken: "secret-token",
      fetchImpl: okFetch,
    });
    expect(first.allowed).toBe(true);
    expect(first.backend).toBe("upstash_redis");

    const blocked = await enforceDistributedRateLimit({
      key: "203.0.113.10",
      namespace: "test",
      maxRequests: 2,
      windowMs: 60_000,
      upstashUrl: "https://example.upstash.io",
      upstashToken: "secret-token",
      fetchImpl: okFetch,
    });
    expect(blocked.allowed).toBe(false);
    expect(blocked.backend).toBe("upstash_redis");

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
