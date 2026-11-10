import { afterEach, describe, expect, it, vi } from "vitest";
import { POST as analyzePost } from "@/app/api/analyze/route";
import { GET as healthGet } from "@/app/api/health/route";
import * as envModule from "@/lib/env";
import * as orchestratorModule from "@/lib/pipeline/orchestrator";
import { sanitizeApiErrorMessage } from "@/lib/security/error-sanitizer";
import { resetRateLimiter } from "@/lib/security/rate-limit";
import { DEMO_FIXTURE_CASES } from "../fixtures/cases";
import {
  makeMinimalPngBuffer,
  makeOversizedPngBuffer,
} from "../fixtures/images";

describe("API routes & security failure handling", () => {
  afterEach(() => {
    resetRateLimiter();
    vi.restoreAllMocks();
  });

  it("GET /api/health returns online status without exposing secret keys", async () => {
    const response = await healthGet();
    expect(response.status).toBe(200);
    const body = (await response.json()) as {
      status: string;
      config: Record<string, unknown>;
    };
    expect(body.status).toBe("online");
    expect(body.config).toHaveProperty("openAiConfigured");
    expect(body.config).toHaveProperty("factCheckConfigured");
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

  it("POST /api/analyze rejects invalid non-image and >5MB files with 400", async () => {
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
    expect(hugeBody.error).toContain("5 MB");
  });

  it("POST /api/analyze returns 503 cleanly when OPENAI_API_KEY is missing without faking evidence", async () => {
    vi.spyOn(envModule, "getServerEnvConfig").mockReturnValue({
      openAiApiKey: undefined,
      factCheckApiKey: undefined,
      visionModel: "gpt-4.1-mini",
      searchModel: "gpt-4.1-mini",
      usingFallbackVisionModel: true,
      usingFallbackSearchModel: true,
    });

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

  it("POST /api/analyze returns 500 cleanly on upstream pipeline failure without returning mock fixtures", async () => {
    vi.spyOn(envModule, "getServerEnvConfig").mockReturnValue({
      openAiApiKey: "sk-proj-test-key-1234567890",
      factCheckApiKey: undefined,
      visionModel: "gpt-4.1-mini",
      searchModel: "gpt-4.1-mini",
      usingFallbackVisionModel: false,
      usingFallbackSearchModel: false,
    });
    vi.spyOn(orchestratorModule, "runAnalysisPipeline").mockRejectedValue(
      new Error("Upstream 401 for key sk-proj-secret1234567890abcdef")
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
      report?: unknown;
    };
    expect(body.code).toBe("PIPELINE_ERROR");
    expect(body.report).toBeUndefined();
    expect(body.error).toContain("[REDACTED_OPENAI_KEY]");
    expect(body.error).not.toContain("secret1234567890");
  });

  it("POST /api/analyze returns 200 report on successful live pipeline execution", async () => {
    vi.spyOn(envModule, "getServerEnvConfig").mockReturnValue({
      openAiApiKey: "sk-proj-test-key-1234567890",
      factCheckApiKey: undefined,
      visionModel: "gpt-4.1-mini",
      searchModel: "gpt-4.1-mini",
      usingFallbackVisionModel: false,
      usingFallbackSearchModel: false,
    });

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

  it("POST /api/analyze enforces 429 rate limiting per client IP", async () => {
    for (let i = 0; i < 15; i += 1) {
      const formData = new FormData();
      const res = await analyzePost(
        new Request("http://localhost/api/analyze", {
          method: "POST",
          headers: { "x-forwarded-for": "198.51.100.42" },
          body: formData,
        })
      );
      expect(res.status).toBe(400);
    }

    const blockedForm = new FormData();
    const blockedRes = await analyzePost(
      new Request("http://localhost/api/analyze", {
        method: "POST",
        headers: { "x-forwarded-for": "198.51.100.42" },
        body: blockedForm,
      })
    );
    expect(blockedRes.status).toBe(429);
    expect(blockedRes.headers.get("Retry-After")).toBeTruthy();
    expect(((await blockedRes.json()) as { code?: string }).code).toBe(
      "RATE_LIMITED"
    );
  });

  it("sanitizeApiErrorMessage redacts OpenAI and Google API key tokens", () => {
    const clean = sanitizeApiErrorMessage(
      new Error("Failed with sk-abc1234567890xyz and AIzaSyD_examplekey123456")
    );
    expect(clean).toContain("[REDACTED_OPENAI_KEY]");
    expect(clean).toContain("[REDACTED_API_KEY]");
    expect(clean).not.toContain("abc1234567890xyz");
    expect(clean).not.toContain("examplekey123456");
  });
});
