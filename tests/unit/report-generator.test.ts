import { describe, expect, it } from "vitest";
import { buildInvestigationReport } from "@/lib/pipeline/report-generator";
import { createInitialPipelineSteps } from "@/lib/pipeline/steps";
import { computeVerdictFromEvidence } from "@/lib/pipeline/verdict-engine";
import type { ClaimExtractionResult, EvidenceSource } from "@/lib/types";

describe("report-generator & public-trace compliance", () => {
  it("produces auditable Case Report with separated supporting/contradicting sources, SHA-256, and limitations", () => {
    const extraction: ClaimExtractionResult = {
      extractedText: "@vereditum membantah hoaks SIM seumur hidup.",
      primaryClaim: "SIM berlaku seumur hidup gratis",
      secondaryClaims: [],
      topicCategory: "Kebijakan Publik",
      claimDateMentioned: "Nov 2026",
      language: "id",
      platform: "Instagram",
      visibleAccountHandle: "@vereditum",
      visibleAccountName: "Vereditum",
      visiblePostUrl: "https://instagram.com/vereditum",
      visibleTimestamp: "3 jam lalu",
      postStance: "debunking_claim",
      postStanceSummary: "Akun membantah hoaks.",
      containsCheckableClaim: true,
      searchQueries: ["SIM seumur hidup Korlantas"],
    };

    const sources: EvidenceSource[] = [
      {
        id: "SRC-01",
        title: "Klarifikasi Korlantas",
        url: "https://korlantas.polri.go.id/",
        domain: "korlantas.polri.go.id",
        publisher: "Korlantas Polri",
        publishedAt: "2026-10-14",
        snippet: "Masa berlaku tetap 5 tahun.",
        relation: "contradicting",
        claimEvaluated: extraction.primaryClaim,
        sourceTier: "official_government",
        origin: "openai_web_search",
        rationale: "Membantah klaim seumur hidup.",
      },
      {
        id: "SRC-02",
        title: "Opini Warganet",
        url: "https://forum.example.com/thread/1",
        domain: "forum.example.com",
        publisher: "Forum Publik",
        publishedAt: null,
        snippet: "Mendengar isu serupa.",
        relation: "supporting",
        claimEvaluated: extraction.primaryClaim,
        sourceTier: "public_source",
        origin: "openai_web_search",
        rationale: "Sekadar mengulang klaim.",
      },
    ];

    const verdict = computeVerdictFromEvidence({
      primaryClaim: extraction.primaryClaim,
      postStance: extraction.postStance,
      postStanceSummary: extraction.postStanceSummary,
      sources,
    });

    const report = buildInvestigationReport({
      checkedAt: "2026-11-10T12:00:00.000Z",
      imageMetadata: {
        fileName: "sample.png",
        mimeType: "image/png",
        originalBytes: 2048,
        sanitizedBytes: 1900,
        metadataRemovedBytes: 148,
        strippedSegments: ["PNG tEXt"],
        sha256: "a".repeat(64),
        persistedOnServer: false,
      },
      extraction,
      verdict,
      sources,
      pipelineSteps: createInitialPipelineSteps(),
      warnings: [],
    });

    expect(report.isDemo).toBe(false);
    expect(report.imageMetadata.sha256).toHaveLength(64);
    expect(report.imageMetadata.persistedOnServer).toBe(false);
    expect(report.supportingEvidence).toHaveLength(1);
    expect(report.contradictingEvidence).toHaveLength(1);
    expect(report.publicOriginTrace.visibleAccountHandle).toBe("@vereditum");
    expect(report.publicOriginTrace.attributionCaveat).toContain(
      "penulis asli"
    );
    expect(report.publicOriginTrace.privacyGuarantee).toContain("IP pribadi");
    expect(report.limitations.length).toBeGreaterThanOrEqual(3);
  });
});
