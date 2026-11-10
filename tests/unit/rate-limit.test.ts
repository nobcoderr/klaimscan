import { afterEach, describe, expect, it } from "vitest";
import {
  checkRateLimit,
  getClientIpFromRequest,
  resetRateLimiter,
} from "@/lib/security/rate-limit";

describe("rate-limit & client IP extraction", () => {
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

  it("resets allowance after window elapses and isolates separate IPs", () => {
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

  it("extracts first forwarded IP safely with fallback", () => {
    const reqForwarded = new Request("http://localhost/api/analyze", {
      headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.1" },
    });
    expect(getClientIpFromRequest(reqForwarded)).toBe("203.0.113.9");

    const reqFallback = new Request("http://localhost/api/analyze");
    expect(getClientIpFromRequest(reqFallback)).toBe("local-client");
  });
});
