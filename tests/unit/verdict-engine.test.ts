import { describe, expect, it } from "vitest";
import { computeVerdictFromEvidence } from "@/lib/pipeline/verdict-engine";
import type { EvidenceSource } from "@/lib/types";

function makeSource(overrides: Partial<EvidenceSource>): EvidenceSource {
  return {
    id: "SRC-01",
    title: "Klarifikasi Resmi",
    url: "https://korlantas.polri.go.id/info",
    domain: "korlantas.polri.go.id",
    publisher: "Korlantas Polri",
    publishedAt: "2026-11-01",
    snippet: "Penjelasan resmi.",
    relation: "contradicting",
    claimEvaluated: "SIM berlaku seumur hidup",
    sourceTier: "official_government",
    origin: "openai_web_search",
    rationale: "Sumber resmi.",
    ...overrides,
  };
}

describe("computeVerdictFromEvidence", () => {
  it("defaults to UNVERIFIED when no relevant evidence exists", () => {
    const verdict = computeVerdictFromEvidence({
      primaryClaim: "Klaim tanpa sumber",
      postStance: "asserting_claim",
      postStanceSummary: "Postingan mendukung klaim.",
      sources: [],
    });

    expect(verdict.claimVerdict).toBe("UNVERIFIED");
  });

  it("defaults to UNVERIFIED when only a single uncorroborated public_source exists", () => {
    const verdict = computeVerdictFromEvidence({
      primaryClaim: "Rumor lokal tanpa konfirmasi instansi",
      postStance: "asserting_claim",
      postStanceSummary: "Akun mengklaim rumor.",
      sources: [
        makeSource({
          domain: "blog-warga.example.org",
          publisher: "Blog Warga",
          relation: "supporting",
          sourceTier: "public_source",
        }),
      ],
    });

    expect(verdict.claimVerdict).toBe("UNVERIFIED");
  });

  it("keeps Claim Verdict FALSE separate from debunking Post Stance (@vereditum rule)", () => {
    const verdict = computeVerdictFromEvidence({
      primaryClaim: "SIM berlaku seumur hidup gratis tanpa perpanjangan",
      postStance: "debunking_claim",
      postStanceSummary: "Akun @vereditum sedang mengklarifikasi isu.",
      sources: [
        makeSource({ id: "SRC-01", relation: "contradicting" }),
        makeSource({
          id: "SRC-02",
          domain: "turnbackhoax.id",
          sourceTier: "fact_checker",
          relation: "contradicting",
        }),
      ],
    });

    expect(verdict.claimVerdict).toBe("FALSE");
    expect(verdict.postStance).toBe("debunking_claim");
    expect(verdict.postClassification).toContain("Debunking");
    expect(verdict.explanation).toContain("bukan pembuat hoaks");
  });

  it("returns TRUE when official sources confirm and none contradict", () => {
    const verdict = computeVerdictFromEvidence({
      primaryClaim: "Tarif BI-FAST maksimal Rp 2.500",
      postStance: "neutral_discussion",
      postStanceSummary: "Laporan netral.",
      sources: [
        makeSource({
          domain: "bi.go.id",
          publisher: "Bank Indonesia",
          relation: "supporting",
          sourceTier: "official_government",
        }),
      ],
    });

    expect(verdict.claimVerdict).toBe("TRUE");
  });

  it("returns OUTDATED when outdated context signal dominates", () => {
    const verdict = computeVerdictFromEvidence({
      primaryClaim: "Gempa tsunami hari ini di pesisir",
      postStance: "asserting_claim",
      postStanceSummary: "Video lama diunggah ulang.",
      sources: [
        makeSource({
          relation: "partial_context",
          sourceTier: "fact_checker",
        }),
      ],
      outdatedSignalDetected: true,
    });

    expect(verdict.claimVerdict).toBe("OUTDATED");
  });

  it("returns MISLEADING when credible sources conflict", () => {
    const verdict = computeVerdictFromEvidence({
      primaryClaim: "Kebijakan baru berlaku penuh untuk semua warga",
      postStance: "quoting_claim",
      postStanceSummary: "Postingan mengutip sebagian headline.",
      sources: [
        makeSource({
          id: "SRC-01",
          relation: "supporting",
          sourceTier: "credible_media",
        }),
        makeSource({
          id: "SRC-02",
          relation: "contradicting",
          sourceTier: "credible_media",
        }),
      ],
    });

    expect(verdict.claimVerdict).toBe("MISLEADING");
  });

  it("never outputs fabricated numerical confidence percentage fields", () => {
    const verdict = computeVerdictFromEvidence({
      primaryClaim: "SIM seumur hidup",
      postStance: "debunking_claim",
      postStanceSummary: "Klarifikasi",
      sources: [makeSource({ relation: "contradicting" })],
    });

    expect("confidence" in verdict).toBe(false);
    expect("confidenceScore" in verdict).toBe(false);
  });
});
