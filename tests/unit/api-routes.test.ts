import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as analyzePost } from "@/app/api/analyze/route";
import { GET as healthGet } from "@/app/api/health/route";
import * as envModule from "@/lib/env";
import { sanitizeScreenshotBuffer } from "@/lib/image/sanitize";
import * as extractorModule from "@/lib/pipeline/claim-extractor";
import * as orchestratorModule from "@/lib/pipeline/orchestrator";
import { PipelineTimeoutError } from "@/lib/pipeline/orchestrator";
import { sanitizeApiErrorMessage } from "@/lib/security/error-sanitizer";
import { resetRateLimiter } from "@/lib/security/rate-limit";
import { DEMO_FIXTURE_CASES } from "../fixtures/cases";
import {
  makeMinimalPngBuffer,
  makeOversizedPngBuffer,
  makeRealRasterPngBuffer,
} from "../fixtures/images";

function makeEnvConfig(
  overrides: Partial<envModule.ServerEnvConfig> = {}
): envModule.ServerEnvConfig {
  return {
    openAiApiKey: "sk-proj-test-key-1234567890",
    factCheckApiKey: undefined,
    visionModel: "gpt-5.4-mini",
    searchModel: "gpt-5.4-mini",
    usingFallbackVisionModel: false,
    usingFallbackSearchModel: false,
    publicAnalyzeEnabled: true,
    analyzeAccessToken: undefined,
    rateLimitMaxRequests: 12,
    rateLimitWindowMs: 60_000,
    globalHourlyLimit: 60,
    maxConcurrentAnalyses: 4,
    pipelineDeadlineMs: 48_000,
    trustedProxyMode: "none",
    upstashRedisRestUrl: undefined,
    upstashRedisRestToken: undefined,
    requireDistributedQuota: false,
    ...overrides,
  };
}

describe("API routes & P0/P1 security hardening", () => {
  afterEach(() => {
    resetRateLimiter();
    vi.restoreAllMocks();
  });

  it("GET /api/health returns online status and safe operational flags without exposing secrets", async () => {
    const response = await healthGet();
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      status: string;
      config: Record<string, unknown>;
    };
    expect(body.status).toBe("online");
    expect(body.config).toHaveProperty("openAiConfigured");
    expect(body.config).toHaveProperty("factCheckConfigured");
    expect(body.config).toHaveProperty("publicAnalyzeEnabled");
    expect(body.config).toHaveProperty("distributedRateLimitConfigured");
    expect(JSON.stringify(body)).not.toContain("AIzaSy");
    expect(JSON.stringify(body)).not.toContain("sk-");
  });

  it("POST /api/analyze rejects non-multipart bodies and missing files with 400", async () => {
    const badReq = new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: "https://example.com" }),
    });
    const badRes = await analyzePost(badReq);
    expect(badRes.status).toBe(400);
    expect(((await badRes.json()) as { code?: string }).code).toBe(
      "INVALID_FORM_DATA"
    );

    const formData = new FormData();
    const missingReq = new Request("http://localhost/api/analyze", {
      method: "POST",
      body: formData,
    });
    const missingRes = await analyzePost(missingReq);
    expect(missingRes.status).toBe(400);
    expect(((await missingRes.json()) as { code?: string }).code).toBe(
      "MISSING_FILE"
    );
  });

  it("POST /api/analyze rejects invalid non-image, >4MB files, and >4.45MB Content-Length payloads with clear 400 error", async () => {
    const formFake = new FormData();
    formFake.append(
      "file",
      new Blob(["not an image".repeat(20)], { type: "image/png" }),
      "fake.png"
    );
    const fakeRes = await analyzePost(
      new Request("http://localhost/api/analyze", { method: "POST", body: formFake })
    );
    expect(fakeRes.status).toBe(400);
    expect(((await fakeRes.json()) as { code?: string }).code).toBe(
      "INVALID_IMAGE"
    );

    const oversized = makeOversizedPngBuffer();
    const formHuge = new FormData();
    formHuge.append(
      "file",
      new Blob([new Uint8Array(oversized)], { type: "image/png" }),
      "huge.png"
    );
    const hugeRes = await analyzePost(
      new Request("http://localhost/api/analyze", { method: "POST", body: formHuge })
    );
    expect(hugeRes.status).toBe(400);
    const hugeBody = (await hugeRes.json()) as { error?: string; code?: string };
    expect(hugeBody.code).toBe("INVALID_IMAGE");
    expect(hugeBody.error).toContain("4 MB");

    const hugeHeaderReq = new Request("http://localhost/api/analyze", {
      method: "POST",
      headers: { "Content-Length": "4600000" },
      body: new FormData(),
    });
    const hugeHeaderRes = await analyzePost(hugeHeaderReq);
    expect(hugeHeaderRes.status).toBe(400);
    const hugeHeaderBody = (await hugeHeaderRes.json()) as {
      error?: string;
      code?: string;
    };
    expect(hugeHeaderBody.code).toBe("INVALID_IMAGE");
    expect(hugeHeaderBody.error).toContain("4 MB");
  });

  it("POST /api/analyze returns 503 cleanly when OPENAI_API_KEY is missing without faking evidence", async () => {
    vi.spyOn(envModule, "getServerEnvConfig").mockReturnValue(
      makeEnvConfig({ openAiApiKey: undefined })
    );

    const formData = new FormData();
    formData.append(
      "file",
      new Blob([new Uint8Array(makeMinimalPngBuffer())], { type: "image/png" }),
      "valid.png"
    );

    const response = await analyzePost(
      new Request("http://localhost/api/analyze", { method: "POST", body: formData })
    );
    expect(response.status).toBe(503);
    const body = (await response.json()) as { code?: string; report?: unknown };
    expect(body.code).toBe("OPENAI_NOT_CONFIGURED");
    expect(body.report).toBeUndefined();
  });

  it("POST /api/analyze enforces access toggle & optional access token gate", async () => {
    vi.spyOn(envModule, "getServerEnvConfig").mockReturnValue(
      makeEnvConfig({ publicAnalyzeEnabled: false })
    );
    const disabledRes = await analyzePost(
      new Request("http://localhost/api/analyze", { method: "POST" })
    );
    expect(disabledRes.status).toBe(503);
    expect(((await disabledRes.json()) as { code?: string }).code).toBe(
      "PUBLIC_ANALYZE_DISABLED"
    );

    vi.spyOn(envModule, "getServerEnvConfig").mockReturnValue(
      makeEnvConfig({ analyzeAccessToken: "judge-passcode-2026" })
    );
    const unauthRes = await analyzePost(
      new Request("http://localhost/api/analyze", { method: "POST" })
    );
    expect(unauthRes.status).toBe(401);
    expect(((await unauthRes.json()) as { code?: string }).code).toBe(
      "UNAUTHORIZED_ACCESS"
    );
  });

  it("POST /api/analyze returns generic error + errorId without leaking raw upstream exceptions", async () => {
    vi.spyOn(envModule, "getServerEnvConfig").mockReturnValue(makeEnvConfig());
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(orchestratorModule, "runAnalysisPipeline").mockRejectedValue(
      new Error("Upstream 401 ECONNREFUSED internal stack for key sk-proj-secret1234567890abcdef")
    );

    const formData = new FormData();
    formData.append(
      "file",
      new Blob([new Uint8Array(makeMinimalPngBuffer())], { type: "image/png" }),
      "valid.png"
    );

    const response = await analyzePost(
      new Request("http://localhost/api/analyze", { method: "POST", body: formData })
    );
    expect(response.status).toBe(500);
    const body = (await response.json()) as {
      error?: string;
      code?: string;
      errorId?: string;
      report?: unknown;
    };
    expect(body.code).toBe("PIPELINE_ERROR");
    expect(body.errorId).toMatch(/^ERR-[0-9A-F]{8}$/);
    expect(body.report).toBeUndefined();
    expect(body.error).not.toContain("ECONNREFUSED");
    expect(body.error).not.toContain("secret1234567890");
    expect(body.error).not.toContain("sk-proj");

    // Server diagnostic log captures redacted diagnostic with errorId
    expect(errorSpy).toHaveBeenCalledTimes(1);
    const logged = String(errorSpy.mock.calls[0]?.[0] ?? "");
    expect(logged).toContain("[REDACTED_OPENAI_KEY]");
    expect(logged).not.toContain("secret1234567890");
  });

  it("POST /api/analyze returns 504 on whole-pipeline timeout without returning fake results", async () => {
    vi.spyOn(envModule, "getServerEnvConfig").mockReturnValue(makeEnvConfig());
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(orchestratorModule, "runAnalysisPipeline").mockRejectedValue(
      new PipelineTimeoutError("Deadline exceeded")
    );

    const formData = new FormData();
    formData.append(
      "file",
      new Blob([new Uint8Array(makeMinimalPngBuffer())], { type: "image/png" }),
      "valid.png"
    );

    const response = await analyzePost(
      new Request("http://localhost/api/analyze", { method: "POST", body: formData })
    );
    expect(response.status).toBe(504);
    const body = (await response.json()) as { code?: string; errorId?: string };
    expect(body.code).toBe("PIPELINE_TIMEOUT");
    expect(body.errorId).toMatch(/^ERR-/);
  });

  it("POST /api/analyze returns 200 report on successful live pipeline execution", async () => {
    vi.spyOn(envModule, "getServerEnvConfig").mockReturnValue(makeEnvConfig());

    const liveReportFixture = { ...DEMO_FIXTURE_CASES[0], isDemo: false };
    vi.spyOn(orchestratorModule, "runAnalysisPipeline").mockResolvedValue(
      liveReportFixture
    );

    const formData = new FormData();
    formData.append(
      "file",
      new Blob([new Uint8Array(makeMinimalPngBuffer())], { type: "image/png" }),
      "valid.png"
    );

    const response = await analyzePost(
      new Request("http://localhost/api/analyze", { method: "POST", body: formData })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as { report: { isDemo: boolean } };
    expect(body.report.isDemo).toBe(false);
  });

  it("POST /api/analyze enforces rate limiting even if caller rotates spoofed x-forwarded-for headers", async () => {
    vi.spyOn(envModule, "getServerEnvConfig").mockReturnValue(
      makeEnvConfig({ rateLimitMaxRequests: 3, trustedProxyMode: "none" })
    );

    for (let i = 0; i < 3; i += 1) {
      const res = await analyzePost(
        new Request("http://localhost/api/analyze", {
          method: "POST",
          headers: { "x-forwarded-for": `198.51.100.${i + 10}` },
          body: new FormData(),
        })
      );
      expect(res.status).toBe(400);
    }

    const blockedRes = await analyzePost(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "x-forwarded-for": "198.51.100.250" },
        body: new FormData(),
      })
    );
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.headers.get("Retry-After")).toBeTruthy();
    expect(((await blockedRes.json()) as { code?: string }).code).toBe(
      "RATE_LIMITED"
    );
  });

  it("POST /api/analyze blocks global hourly AI credit overuse", async () => {
    vi.spyOn(envModule, "getServerEnvConfig").mockReturnValue(
      makeEnvConfig({ globalHourlyLimit: 1, rateLimitMaxRequests: 50 })
    );
    const liveReportFixture = { ...DEMO_FIXTURE_CASES[0], isDemo: false };
    vi.spyOn(orchestratorModule, "runAnalysisPipeline").mockResolvedValue(
      liveReportFixture
    );

    const makeValidReq = () => {
      const fd = new FormData();
      fd.append(
        "file",
        new Blob([new Uint8Array(makeMinimalPngBuffer())], { type: "image/png" }),
        "valid.png"
      );
      return new Request("http://localhost/api/analyze", {
        method: "POST",
        body: fd,
      });
    };

    const first = await analyzePost(makeValidReq());
    expect(first.status).toBe(200);

    const second = await analyzePost(makeValidReq());
    expect(second.status).toBe(429);
    expect(((await second.json()) as { code?: string }).code).toBe(
      "GLOBAL_CREDIT_LIMIT"
    );
  });

  it("POST /api/analyze ignores spoofed client ocrGuide image, derives server OCR ruler exclusively from file, and locks report sha256", async () => {
    vi.spyOn(envModule, "getServerEnvConfig").mockReturnValue(makeEnvConfig());

    const genuineImgA = await makeRealRasterPngBuffer(320, 640);
    const spoofedImgB = await makeRealRasterPngBuffer(640, 320, { noisy: true });
    const expectedSha = sanitizeScreenshotBuffer(
      genuineImgA,
      "img-a.png",
      "image/png"
    ).summary.sha256;

    const capturedGuideHashes: string[] = [];
    vi.spyOn(extractorModule, "extractClaimFromScreenshot").mockImplementation(
      async (params) => {
        expect(params.expectedImageSha256).toBe(expectedSha);
        expect(params.serverGuide?.sourceSha256).toBe(expectedSha);
        expect(params.serverGuide?.hasCoordinateRulers).toBe(true);
        capturedGuideHashes.push(params.serverGuide?.sourceSha256 ?? "");
        return {
          ...DEMO_FIXTURE_CASES[0].claimExtraction,
          containsCheckableClaim: false,
          primaryClaim: "Tidak ada teks klaim.",
        };
      }
    );

    const fd = new FormData();
    fd.append(
      "file",
      new Blob([new Uint8Array(genuineImgA)], { type: "image/png" }),
      "img-a.png"
    );
    // Attacker tries to smuggle completely different image as ocrGuide
    fd.append(
      "ocrGuide",
      new Blob([new Uint8Array(spoofedImgB)], { type: "image/png" }),
      "spoofed-guide.png"
    );

    const response = await analyzePost(
      new Request("http://localhost/api/analyze", { method: "POST", body: fd })
    );
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      report: {
        imageMetadata: { sha256: string };
        warnings: string[];
      };
    };

    expect(capturedGuideHashes).toEqual([expectedSha]);
    expect(body.report.imageMetadata.sha256).toBe(expectedSha);
    expect(
      body.report.warnings.some((w) => /ocrGuide/i.test(w))
    ).toBe(true);
  });

  it("POST /api/analyze accepts large valid portrait & landscape screenshots under 4.5MB limit", async () => {
    vi.spyOn(envModule, "getServerEnvConfig").mockReturnValue(makeEnvConfig());
    const liveReportFixture = { ...DEMO_FIXTURE_CASES[0], isDemo: false };
    vi.spyOn(orchestratorModule, "runAnalysisPipeline").mockResolvedValue(
      liveReportFixture
    );

    const largePortrait = await makeRealRasterPngBuffer(880, 1280, { noisy: true });
    const largeLandscape = await makeRealRasterPngBuffer(1280, 880, { noisy: true });

    for (const [name, buf] of [
      ["large-portrait.png", largePortrait],
      ["large-landscape.png", largeLandscape],
    ] as const) {
      expect(buf.length).toBeLessThan(4_200_000);
      const fd = new FormData();
      fd.append("file", new Blob([new Uint8Array(buf)], { type: "image/png" }), name);
      const res = await analyzePost(
        new Request("http://localhost/api/analyze", { method: "POST", body: fd })
      );
      expect(res.status).toBe(200);
    }
  });

  it("POST /api/analyze fails closed (503 CREDIT_GUARD_UNAVAILABLE) without calling AI pipeline when distributed Redis store errors or is missing while required", async () => {
    const pipelineSpy = vi.spyOn(orchestratorModule, "runAnalysisPipeline");

    // 1. Missing Redis store while requireDistributedQuota=true (e.g. serverless multi-instance prod)
    vi.spyOn(envModule, "getServerEnvConfig").mockReturnValue(
      makeEnvConfig({
        requireDistributedQuota: true,
        upstashRedisRestUrl: undefined,
        upstashRedisRestToken: undefined,
      })
    );

    const makeReq = () => {
      const fd = new FormData();
      fd.append(
        "file",
        new Blob([new Uint8Array(makeMinimalPngBuffer())], { type: "image/png" }),
        "valid.png"
      );
      return new Request("http://localhost/api/analyze", {
        method: "POST",
        body: fd,
      });
    };

    const missingStoreRes = await analyzePost(makeReq());
    expect(missingStoreRes.status).toBe(503);
    expect(((await missingStoreRes.json()) as { code?: string }).code).toBe(
      "CREDIT_GUARD_UNAVAILABLE"
    );
    expect(missingStoreRes.headers.get("X-RateLimit-Backend")).toBe(
      "store_unavailable"
    );
    expect(pipelineSpy).not.toHaveBeenCalled();

    // 2. Configured Redis store fails with HTTP 500 during global credit quota check
    vi.spyOn(envModule, "getServerEnvConfig").mockReturnValue(
      makeEnvConfig({
        upstashRedisRestUrl: "https://outage.upstash.io",
        upstashRedisRestToken: "test-token",
        requireDistributedQuota: false,
      })
    );
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Redis Down", { status: 500 })
    );

    const outageRes = await analyzePost(makeReq());
    expect(outageRes.status).toBe(503);
    expect(((await outageRes.json()) as { code?: string }).code).toBe(
      "CREDIT_GUARD_UNAVAILABLE"
    );
    expect(pipelineSpy).not.toHaveBeenCalled();
  });

  it("sanitizeApiErrorMessage redacts OpenAI, Google API key, and Bearer tokens for server diagnostics", () => {
    const clean = sanitizeApiErrorMessage(
      new Error(
        "Failed with sk-abc1234567890xyz and AIzaSyD_examplekey123456 Bearer tok123"
      )
    );
    expect(clean).toContain("[REDACTED_OPENAI_KEY]");
    expect(clean).toContain("[REDACTED_API_KEY]");
    expect(clean).toContain("Bearer [REDACTED_TOKEN]");
    expect(clean).not.toContain("abc1234567890xyz");
    expect(clean).not.toContain("examplekey123456");
  });
});
