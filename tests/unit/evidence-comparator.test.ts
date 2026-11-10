import { describe, expect, it } from "vitest";
import {
  doesCandidateMatchProposition,
  inferRelationFromRatingText,
  mapEvaluationsToVerifiedSources,
} from "@/lib/pipeline/evidence-comparator";
import type { CandidateEvidence } from "@/lib/pipeline/evidence-retriever";

const SAMPLE_CANDIDATES: CandidateEvidence[] = [
  {
    id: "SRC-01",
    title: "Klarifikasi Korlantas Polri",
    url: "https://korlantas.polri.go.id/info",
    domain: "korlantas.polri.go.id",
    publisher: "Korlantas Polri",
    publishedAt: "2026-10-14",
    snippet: "SIM tetap berlaku 5 tahun, tidak berlaku seumur hidup.",
    claimedText: "SIM berlaku seumur hidup gratis tanpa perpanjangan",
    origin: "google_fact_check",
    sourceTier: "official_government",
    ratingText: "Salah",
  },
];

describe("evidence-comparator P0 proposition alignment & anti-hallucination", () => {
  it("maps affirmative, negated, partial, and unverified ratings safely", () => {
    expect(inferRelationFromRatingText("Salah / Hoaks")).toBe("contradicting");
    expect(inferRelationFromRatingText("Tidak Benar")).toBe("contradicting");
    expect(inferRelationFromRatingText("Bukan Fakta")).toBe("contradicting");
    expect(inferRelationFromRatingText("Not True")).toBe("contradicting");
    expect(inferRelationFromRatingText("Untrue")).toBe("contradicting");
    expect(inferRelationFromRatingText("Menyesatkan")).toBe("partial_context");
    expect(inferRelationFromRatingText("Sebagian Benar")).toBe(
      "partial_context"
    );
    expect(inferRelationFromRatingText("Partly True")).toBe("partial_context");
    expect(inferRelationFromRatingText("Benar")).toBe("supporting");
    expect(inferRelationFromRatingText("Accurate")).toBe("supporting");
    expect(inferRelationFromRatingText("Belum Terbukti")).toBeNull();
    expect(inferRelationFromRatingText("Unverified")).toBeNull();
    expect(inferRelationFromRatingText("Tidak diketahui")).toBeNull();
  });

  it("ignores fabricated IDs and uses rating polarity only when proposition matches", () => {
    const output = mapEvaluationsToVerifiedSources({
      candidates: SAMPLE_CANDIDATES,
      primaryClaim: "SIM berlaku seumur hidup",
      evaluations: [
        {
          id: "INVENTED-99",
          addressesSameProposition: true,
          matchesTimeContext: true,
          relation: "supporting",
          claimEvaluated: "Fake",
          rationale: "Hallucinated source",
          mentionsOutdatedContext: false,
        },
        {
          id: "SRC-01",
          addressesSameProposition: true,
          matchesTimeContext: true,
          relation: "supporting", // Same proposition; ratingText "Salah" fixes LLM polarity confusion
          claimEvaluated: "SIM berlaku seumur hidup",
          rationale: "Korlantas menegaskan SIM berlaku 5 tahun.",
          mentionsOutdatedContext: false,
        },
      ],
    });

    expect(output.sources).toHaveLength(1);
    expect(output.sources[0].id).toBe("SRC-01");
    expect(output.sources[0].relation).toBe("contradicting");
    expect(output.sources[0].claimEvaluated).toBe("SIM berlaku seumur hidup");
  });

  it("NEVER lets FALSE/Salah ratingText on cover-photo debunk override text event claim (forces irrelevant)", () => {
    const output = mapEvaluationsToVerifiedSources({
      candidates: [
        {
          id: "SRC-01",
          title: "Hoaks Foto Bareskrim Tangkap Pejabat A",
          url: "https://komdigi.go.id/hoaks-foto",
          domain: "komdigi.go.id",
          publisher: "Komdigi RI",
          publishedAt: "2026-11-10",
          snippet:
            "Foto penangkapan adalah editan, meskipun proses penyidikan hukum tetap berjalan.",
          claimedText: "Foto penangkapan di Bareskrim adalah asli",
          origin: "google_fact_check",
          sourceTier: "official_government",
          ratingText: "Salah",
        },
      ],
      primaryClaim: "Pejabat A ditetapkan sebagai tersangka kasus penyadapan",
      evaluations: [
        {
          id: "SRC-01",
          addressesSameProposition: true,
          matchesTimeContext: true,
          targetAspect: "text_claim",
          relation: "contradicting",
          claimEvaluated: "Pejabat A ditetapkan sebagai tersangka",
          rationale:
            "Artikel hanya memeriksa manipulasi foto, bukan kebenaran penetapan tersangka.",
          mentionsOutdatedContext: false,
        },
      ],
    });

    expect(output.sources[0].targetAspect).toBe("image_authenticity");
    expect(output.sources[0].relation).toBe("irrelevant");
  });

  it("rejects mismatched time-context articles unless explicitly flagging recycled/outdated claims", () => {
    const mismatchOutput = mapEvaluationsToVerifiedSources({
      candidates: SAMPLE_CANDIDATES,
      primaryClaim: "Kebijakan SIM gratis baru November 2026",
      evaluations: [
        {
          id: "SRC-01",
          addressesSameProposition: true,
          matchesTimeContext: false,
          relation: "contradicting",
          claimEvaluated: "Aturan lama 2018",
          rationale: "Membahas periode regulasi lama yang tidak lagi relevan.",
          mentionsOutdatedContext: false,
        },
      ],
    });

    expect(mismatchOutput.sources[0].relation).toBe("irrelevant");
    expect(mismatchOutput.outdatedSignalDetected).toBe(false);
  });

  it("guards LLM-timeout fallback so unrelated Google Fact Check results stay irrelevant", () => {
    const unrelatedCandidate: CandidateEvidence = {
      id: "SRC-02",
      title: "Hoaks Vaksin Mengandung Chip Mikro",
      url: "https://turnbackhoax.id/2025/vaksin",
      domain: "turnbackhoax.id",
      publisher: "TurnBackHoax",
      publishedAt: "2025-05-01",
      snippet: "Klaim vaksin COVID mengandung pelacak GPS adalah salah.",
      claimedText: "Vaksin mengandung microchip pelacak",
      origin: "google_fact_check",
      sourceTier: "fact_checker",
      ratingText: "Salah",
    };

    expect(
      doesCandidateMatchProposition(
        unrelatedCandidate,
        "Bank Indonesia menetapkan tarif BI-FAST maksimal Rp2.500"
      )
    ).toBe(false);

    const fallbackOutput = mapEvaluationsToVerifiedSources({
      candidates: [unrelatedCandidate],
      primaryClaim: "Bank Indonesia menetapkan tarif BI-FAST maksimal Rp2.500",
      evaluations: [],
    });

    expect(fallbackOutput.sources[0].relation).toBe("irrelevant");

    const matchingFallback = mapEvaluationsToVerifiedSources({
      candidates: SAMPLE_CANDIDATES,
      primaryClaim: "SIM berlaku seumur hidup gratis tanpa perpanjangan",
      evaluations: [],
    });
    expect(matchingFallback.sources[0].relation).toBe("contradicting");
  });

  it("retains undated official evergreen sources when claim has no date constraint", () => {
    const evergreenCandidate: CandidateEvidence = {
      id: "SRC-03",
      title: "Infrastruktur Sistem Pembayaran Ritel BI-FAST",
      url: "https://www.bi.go.id/id/fungsi-utama/sistem-pembayaran/ritel/infrastruktur/default.aspx",
      domain: "bi.go.id",
      publisher: "Bank Indonesia",
      publishedAt: null,
      snippet: "Tarif maksimal BI-FAST untuk nasabah ritel ditetapkan Rp 2.500.",
      origin: "openai_web_search",
      sourceTier: "official_government",
    };

    const output = mapEvaluationsToVerifiedSources({
      candidates: [evergreenCandidate],
      primaryClaim: "Biaya transfer antarbank lewat BI-FAST maksimal Rp 2.500 per transaksi",
      claimDateMentioned: "",
      evaluations: [
        {
          id: "SRC-03",
          addressesSameProposition: true,
          matchesTimeContext: false,
          temporalCompatibility: "unclear",
          sourceEventDate: null,
          targetAspect: "official_legal_status",
          evaluatedAtomicClaimId: null,
          relation: "supporting",
          claimEvaluated: "Tarif BI-FAST maksimal Rp 2.500",
          rationale:
            "Sumber resmi BI mendukung ketentuan tarif, namun metadata tanggal terbit tidak tersedia sehingga waktu tidak dapat dipastikan.",
          mentionsOutdatedContext: false,
        },
      ],
    });

    expect(output.sources[0].relation).toBe("supporting");
  });
});
