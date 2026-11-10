import { describe, expect, it } from "vitest";
import {
  computeVerdictFromEvidence,
  deduplicateByPublisher,
  extractRegistrableRoot,
} from "@/lib/pipeline/verdict-engine";
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

describe("computeVerdictFromEvidence & P0 corroboration integrity", () => {
  it("extracts registrable publisher roots across multi-level .go.id and media subdomains", () => {
    expect(extractRegistrableRoot("https://korlantas.polri.go.id/news")).toBe(
      "polri.go.id"
    );
    expect(extractRegistrableRoot("https://humas.polri.go.id/press")).toBe(
      "polri.go.id"
    );
    expect(extractRegistrableRoot("https://komdigi.go.id/hoaks")).toBe(
      "komdigi.go.id"
    );
    expect(extractRegistrableRoot("https://nasional.kompas.com/read/1")).toBe(
      "kompas.com"
    );
    expect(extractRegistrableRoot("https://cekfakta.tempo.co/read/2")).toBe(
      "tempo.co"
    );
  });

  it("defaults to UNVERIFIED when no relevant evidence exists or all sources are irrelevant", () => {
    const emptyVerdict = computeVerdictFromEvidence({
      primaryClaim: "Klaim tanpa sumber",
      postStance: "asserting_claim",
      postStanceSummary: "Postingan mendukung klaim.",
      sources: [],
    });
    expect(emptyVerdict.claimVerdict).toBe("UNVERIFIED");

    const irrelevantOnly = computeVerdictFromEvidence({
      primaryClaim: "Klaim berbeda dari sumber",
      postStance: "asserting_claim",
      postStanceSummary: "Postingan mendukung klaim.",
      sources: [
        makeSource({
          id: "SRC-01",
          relation: "irrelevant",
          sourceTier: "official_government",
        }),
        makeSource({
          id: "SRC-02",
          domain: "turnbackhoax.id",
          url: "https://turnbackhoax.id/other",
          relation: "irrelevant",
          sourceTier: "fact_checker",
        }),
      ],
    });
    expect(irrelevantOnly.claimVerdict).toBe("UNVERIFIED");
  });

  it("defaults to UNVERIFIED when only uncorroborated public_source blogs exist", () => {
    const verdict = computeVerdictFromEvidence({
      primaryClaim: "Rumor lokal tanpa konfirmasi instansi",
      postStance: "asserting_claim",
      postStanceSummary: "Akun mengklaim rumor.",
      sources: [
        makeSource({
          id: "SRC-01",
          url: "https://blog-warga.example.org/a",
          domain: "blog-warga.example.org",
          publisher: "Blog Warga",
          relation: "supporting",
          sourceTier: "public_source",
        }),
        makeSource({
          id: "SRC-02",
          url: "https://catatan-netizen.example.net/b",
          domain: "catatan-netizen.example.net",
          publisher: "Catatan Netizen",
          relation: "supporting",
          sourceTier: "public_source",
        }),
      ],
    });

    expect(verdict.claimVerdict).toBe("UNVERIFIED");
  });

  it("prevents multiple articles from the same publisher from counting as independent corroboration", () => {
    const duplicatedKompas = [
      makeSource({
        id: "SRC-01",
        url: "https://www.kompas.com/nasional/read/1",
        domain: "kompas.com",
        publisher: "Kompas",
        relation: "contradicting",
        sourceTier: "credible_media",
      }),
      makeSource({
        id: "SRC-02",
        url: "https://nasional.kompas.com/read/2",
        domain: "nasional.kompas.com",
        publisher: "Kompas Nasional",
        relation: "contradicting",
        sourceTier: "credible_media",
      }),
      makeSource({
        id: "SRC-03",
        url: "https://megapolitan.kompas.com/read/3",
        domain: "megapolitan.kompas.com",
        publisher: "Kompas Megapolitan",
        relation: "contradicting",
        sourceTier: "credible_media",
      }),
    ];

    expect(deduplicateByPublisher(duplicatedKompas)).toHaveLength(1);

    const singleMediaOnly = computeVerdictFromEvidence({
      primaryClaim: "Klaim hanya diliput berulang satu media",
      postStance: "asserting_claim",
      postStanceSummary: "Postingan mengklaim.",
      sources: duplicatedKompas,
    });
    expect(singleMediaOnly.claimVerdict).toBe("UNVERIFIED");

    // Two genuinely independent credible media publishers corroborate FALSE
    const twoIndependentMedia = computeVerdictFromEvidence({
      primaryClaim: "Klaim dibantah dua media independen",
      postStance: "asserting_claim",
      postStanceSummary: "Postingan mengklaim.",
      sources: [
        duplicatedKompas[0],
        makeSource({
          id: "SRC-04",
          url: "https://nasional.tempo.co/read/99",
          domain: "nasional.tempo.co",
          publisher: "Tempo",
          relation: "contradicting",
          sourceTier: "credible_media",
        }),
      ],
    });
    expect(twoIndependentMedia.claimVerdict).toBe("FALSE");
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
          url: "https://turnbackhoax.id/sim",
          domain: "turnbackhoax.id",
          publisher: "TurnBackHoax",
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

  it("does not allow a single contradicting source to override dominant partial_context evidence into FALSE", () => {
    const verdict = computeVerdictFromEvidence({
      primaryClaim: "Kasus penyidikan pejabat tertentu berjalan",
      postStance: "asserting_claim",
      postStanceSummary: "Unggahan menyebut penyidikan.",
      sources: [
        makeSource({
          id: "SRC-01",
          url: "https://komdigi.go.id/hoaks-foto",
          domain: "komdigi.go.id",
          publisher: "Komdigi",
          relation: "contradicting",
          sourceTier: "official_government",
        }),
        makeSource({
          id: "SRC-02",
          url: "https://apnews.com/article/1",
          domain: "apnews.com",
          publisher: "AP News",
          relation: "partial_context",
          sourceTier: "credible_media",
        }),
        makeSource({
          id: "SRC-03",
          url: "https://bakom.go.id/statement",
          domain: "bakom.go.id",
          publisher: "Bakom RI",
          relation: "partial_context",
          sourceTier: "official_government",
        }),
        makeSource({
          id: "SRC-04",
          url: "https://dpr.go.id/berita/1",
          domain: "dpr.go.id",
          publisher: "DPR RI",
          relation: "partial_context",
          sourceTier: "official_government",
        }),
      ],
    });

    expect(verdict.claimVerdict).not.toBe("FALSE");
    expect(verdict.claimVerdict).toBe("MISLEADING");
  });

  it("returns TRUE when official sources confirm and none contradict", () => {
    const verdict = computeVerdictFromEvidence({
      primaryClaim: "Tarif BI-FAST maksimal Rp 2.500",
      postStance: "neutral_discussion",
      postStanceSummary: "Laporan netral.",
      sources: [
        makeSource({
          url: "https://www.bi.go.id/bifast",
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
          url: "https://turnbackhoax.id/tsunami",
          domain: "turnbackhoax.id",
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
          url: "https://kompas.com/1",
          domain: "kompas.com",
          relation: "supporting",
          sourceTier: "credible_media",
        }),
        makeSource({
          id: "SRC-02",
          url: "https://tempo.co/2",
          domain: "tempo.co",
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
