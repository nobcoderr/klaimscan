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
      requireDistributedQuota: false,
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
    expect(report.verdict.claimVerdict).toBe("UNVERIFIED");
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
      requireDistributedQuota: false,
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

  it("flags unconfirmed temporal context and holds UNVERIFIED when screenshot says 'hari ini' without visible publication calendar date", async () => {
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
      pipelineDeadlineMs: 20_000,
      trustedProxyMode: "none",
      upstashRedisRestUrl: undefined,
      upstashRedisRestToken: undefined,
      requireDistributedQuota: false,
    });

    vi.spyOn(extractorModule, "extractClaimFromScreenshot").mockResolvedValue({
      extractedText: "Gempa bumi terjadi hari ini di wilayah selatan.",
      primaryClaim: "Gempa bumi terjadi hari ini di wilayah selatan",
      secondaryClaims: [],
      topicCategory: "Bencana",
      claimDateMentioned: "hari ini",
      language: "id",
      platform: "Instagram",
      visibleAccountHandle: "@info_bencana",
      visibleAccountName: "Info Bencana",
      visiblePostUrl: null,
      visibleTimestamp: null,
      postStance: "asserting_claim",
      postStanceSummary: "Akun menyebut peristiwa terjadi hari ini.",
      containsCheckableClaim: true,
      searchQueries: ["gempa bumi wilayah selatan"],
    });

    vi.spyOn(retrieverModule, "retrieveEvidence").mockResolvedValue({
      candidates: [
        {
          id: "SRC-01",
          title: "BMKG Laporkan Gempa Wilayah Selatan",
          url: "https://bmkg.go.id/berita/gempa-selatan",
          domain: "bmkg.go.id",
          publisher: "BMKG",
          publishedAt: "2024-05-12",
          snippet: "BMKG mencatat gempa terjadi pada Mei 2024.",
          origin: "openai_web_search",
          sourceTier: "official_government",
        },
      ],
      searchSummary: "Arsip gempa 2024 ditemukan.",
      warnings: [],
    });

    vi.spyOn(comparatorModule, "compareEvidenceAgainstClaim").mockResolvedValue(
      comparatorModule.mapEvaluationsToVerifiedSources({
        candidates: [
          {
            id: "SRC-01",
            title: "BMKG Laporkan Gempa Wilayah Selatan",
            url: "https://bmkg.go.id/berita/gempa-selatan",
            domain: "bmkg.go.id",
            publisher: "BMKG",
            publishedAt: "2024-05-12",
            snippet: "BMKG mencatat gempa terjadi pada Mei 2024.",
            origin: "openai_web_search",
            sourceTier: "official_government",
          },
        ],
        primaryClaim: "Gempa bumi terjadi hari ini di wilayah selatan",
        claimDateMentioned: "hari ini",
        visibleTimestamp: null,
        evaluations: [
          {
            id: "SRC-01",
            addressesSameProposition: true,
            matchesTimeContext: true,
            temporalCompatibility: "current_match",
            sourceEventDate: "2024-05-12",
            targetAspect: "event_occurrence",
            relation: "supporting",
            claimEvaluated: "Gempa bumi terjadi di wilayah selatan",
            rationale: "BMKG mengonfirmasi kejadian.",
            mentionsOutdatedContext: false,
          },
        ],
      })
    );

    const report = await runAnalysisPipeline({
      rawBuffer: makeMinimalPngBuffer(),
      fileName: "old-relative-date.png",
      declaredMimeType: "image/png",
    });

    expect(report.verdict.claimVerdict).toBe("UNVERIFIED");
    expect(report.verdict.explanation).toContain("belum dapat dipastikan");
    expect(
      report.warnings.some((w) => /belum dapat dipastikan/i.test(w))
    ).toBe(true);
  }, 10_000);
});
