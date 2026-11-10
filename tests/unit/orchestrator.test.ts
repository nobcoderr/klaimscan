import { afterEach, describe, expect, it, vi } from "vitest";
import * as envModule from "@/lib/env";
import * as extractorModule from "@/lib/pipeline/claim-extractor";
import * as comparatorModule from "@/lib/pipeline/evidence-comparator";
import * as retrieverModule from "@/lib/pipeline/evidence-retriever";
import {
  PipelineTimeoutError,
  runAnalysisPipeline,
} from "@/lib/pipeline/orchestrator";
import { makeMinimalPngBuffer } from "../fixtures/images";

describe("orchestrator P1 whole-pipeline deadline & graceful degradation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("degrades comparison stage cleanly when remaining pipeline deadline budget is tight", async () => {
    vi.spyOn(envModule, "getServerEnvConfig").mockReturnValue({
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
      pipelineDeadlineMs: 5_500,
      trustedProxyMode: "none",
      upstashRedisRestUrl: undefined,
      upstashRedisRestToken: undefined,
    });

    vi.spyOn(extractorModule, "extractClaimFromScreenshot").mockResolvedValue({
      extractedText: "SIM seumur hidup gratis mulai berlaku.",
      primaryClaim: "SIM berlaku seumur hidup gratis tanpa perpanjangan",
      secondaryClaims: [],
      topicCategory: "Kebijakan Publik",
      claimDateMentioned: null,
      language: "id",
      platform: "Instagram",
      visibleAccountHandle: "@contoh",
      visibleAccountName: "Contoh",
      visiblePostUrl: null,
      visibleTimestamp: "1 jam lalu",
      postStance: "asserting_claim",
      postStanceSummary: "Akun menyebarkan klaim.",
      containsCheckableClaim: true,
      searchQueries: ["klarifikasi SIM seumur hidup"],
    });

    // Consume ~3.2s during retrieval so remaining budget < 3s triggers safe fallback instead of LLM hang
    vi.spyOn(retrieverModule, "retrieveEvidence").mockImplementation(async () => {
      await new Promise((resolve) => setTimeout(resolve, 3_200));
      return {
        candidates: [
          {
            id: "SRC-01",
            title: "Cek Fakta SIM Seumur Hidup",
            url: "https://turnbackhoax.id/sim-seumur-hidup",
            domain: "turnbackhoax.id",
            publisher: "TurnBackHoax",
            publishedAt: "2026-10-15",
            snippet: "SIM tetap berlaku 5 tahun, tidak seumur hidup.",
            claimedText: "SIM berlaku seumur hidup gratis",
            origin: "google_fact_check",
            sourceTier: "fact_checker",
            ratingText: "Salah",
          },
        ],
        searchSummary: "Bantahan resmi SIM seumur hidup.",
        warnings: [],
      };
    });

    const compareSpy = vi.spyOn(
      comparatorModule,
      "compareEvidenceAgainstClaim"
    );

    const report = await runAnalysisPipeline({
      rawBuffer: makeMinimalPngBuffer(),
      fileName: "test.png",
      declaredMimeType: "image/png",
      deadlineMs: 5_500,
    });

    expect(compareSpy).not.toHaveBeenCalled();
    expect(report.isDemo).toBe(false);
    expect(report.verdict.claimVerdict).toBe("FALSE");
    expect(report.claimExtraction.textVerificationNotice).toBe(
      "Verifikasi dilakukan terhadap klaim tekstual. Keaslian foto sampul tidak diperiksa."
    );
    expect(report.claimExtraction.normalizedClaims?.length).toBeGreaterThanOrEqual(
      1
    );
    expect(report.warnings.some((w) => /fallback/i.test(w))).toBe(true);
  }, 10_000);

  it("throws PipelineTimeoutError cleanly when Vision stage exceeds pipeline deadline", async () => {
    vi.spyOn(envModule, "getServerEnvConfig").mockReturnValue({
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
      pipelineDeadlineMs: 5_000,
      trustedProxyMode: "none",
      upstashRedisRestUrl: undefined,
      upstashRedisRestToken: undefined,
    });

    vi.spyOn(extractorModule, "extractClaimFromScreenshot").mockImplementation(
      async ({ signal }) => {
        return await new Promise((_, reject) => {
          signal?.addEventListener(
            "abort",
            () => reject(new Error("aborted by deadline")),
            { once: true }
          );
        });
      }
    );

    await expect(
      runAnalysisPipeline({
        rawBuffer: makeMinimalPngBuffer(),
        fileName: "test.png",
        declaredMimeType: "image/png",
        deadlineMs: 5_000,
      })
    ).rejects.toBeInstanceOf(PipelineTimeoutError);
  }, 10_000);
});
