import { describe, expect, it } from "vitest";
import {
  doesCandidateMatchProposition,
  inferRelationFromRatingText,
  mapEvaluationsToVerifiedSources,
} from "@/lib/pipeline/evidence-comparator";
import type { CandidateEvidence } from "@/lib/pipeline/evidence-retriever";
import { computeVerdictFromEvidence } from "@/lib/pipeline/verdict-engine";

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

  it("rejects opposite-polarity claims sharing identical keywords and defaults failed comparator to UNVERIFIED", () => {
    const oppositePolicyCandidate: CandidateEvidence = {
      id: "SRC-OPP-1",
      title: "Hoaks Korlantas Hapus Perpanjangan SIM Seumur Hidup",
      url: "https://turnbackhoax.id/2026/10/sim-hapus",
      domain: "turnbackhoax.id",
      publisher: "TurnBackHoax",
      publishedAt: "2026-10-20",
      snippet: "Klaim bahwa Korlantas menghapus perpanjangan SIM menjadi seumur hidup adalah salah.",
      claimedText: "Korlantas Polri menghapus perpanjangan SIM menjadi seumur hidup gratis",
      origin: "google_fact_check",
      sourceTier: "fact_checker",
      ratingText: "Salah",
    };

    // Opposite claim sharing identical keywords ("Korlantas", "Polri", "perpanjangan", "SIM") must NOT match
    expect(
      doesCandidateMatchProposition(
        oppositePolicyCandidate,
        "Korlantas Polri mewajibkan perpanjangan SIM setiap 5 tahun"
      )
    ).toBe(false);

    // Even if negation is used with identical words
    expect(
      doesCandidateMatchProposition(
        {
          title: "Cek Fakta Status Tersangka",
          snippet: "Penjelasan",
          claimedText: "Listyo Sigit ditetapkan sebagai tersangka penyadapan",
          publishedAt: "2026-11-05",
        },
        "Listyo Sigit tidak ditetapkan sebagai tersangka penyadapan"
      )
    ).toBe(false);

    // Antonym direction (naik vs turun)
    expect(
      doesCandidateMatchProposition(
        {
          title: "Cek Fakta Tarif BI-FAST",
          snippet: "Klarifikasi",
          claimedText: "Bank Indonesia menurunkan tarif BI-FAST menjadi gratis",
          publishedAt: "2026-11-05",
        },
        "Bank Indonesia menaikkan tarif BI-FAST mulai bulan depan"
      )
    ).toBe(false);

    // When LLM comparator fails (evaluations: []), opposite claim rating cannot invert verdict -> UNVERIFIED
    const failedComparatorResult = mapEvaluationsToVerifiedSources({
      candidates: [oppositePolicyCandidate],
      primaryClaim: "Korlantas Polri mewajibkan perpanjangan SIM setiap 5 tahun",
      evaluations: [],
    });
    expect(failedComparatorResult.sources[0].relation).toBe("irrelevant");

    const verdict = computeVerdictFromEvidence({
      primaryClaim: "Korlantas Polri mewajibkan perpanjangan SIM setiap 5 tahun",
      postStance: "asserting_claim",
      postStanceSummary: "Postingan menyebut kewajiban perpanjangan SIM 5 tahun.",
      sources: failedComparatorResult.sources,
    });
    expect(verdict.claimVerdict).toBe("UNVERIFIED");
  });

  it("rejects mismatched entities, conflicting monetary amounts, and conflicting event dates including UTC/WIB rollover", () => {
    // Different person entities sharing identical event keywords
    expect(
      doesCandidateMatchProposition(
        {
          title: "Cek Fakta Kasus Korupsi",
          snippet: "Klarifikasi",
          claimedText: "Agus Wijaya ditetapkan sebagai tersangka kasus korupsi dana bantuan",
          publishedAt: "2026-11-05",
        },
        "Budi Santoso ditetapkan sebagai tersangka kasus korupsi dana bantuan"
      )
    ).toBe(false);

    // Different amounts sharing identical keywords
    expect(
      doesCandidateMatchProposition(
        {
          title: "Tarif BI-FAST",
          snippet: "Klarifikasi",
          claimedText: "Bank Indonesia menetapkan tarif BI-FAST maksimal Rp25.000",
          publishedAt: "2026-11-05",
        },
        "Bank Indonesia menetapkan tarif BI-FAST maksimal Rp2.500"
      )
    ).toBe(false);

    // Different calendar event dates
    expect(
      doesCandidateMatchProposition(
        {
          title: "Hoaks Demonstrasi",
          snippet: "Klarifikasi",
          claimedText: "Demonstrasi besar terjadi pada 12 Oktober 2024",
          publishedAt: "2024-10-15",
        },
        "Demonstrasi besar terjadi pada 10 November 2026",
        { claimDateMentioned: "10 November 2026" }
      )
    ).toBe(false);

    // UTC 2026-11-10T18:30:00Z == 2026-11-11 01:30 Asia/Jakarta (WIB)
    const utcRolloverNow = new Date("2026-11-10T18:30:00.000Z");
    const outdatedYesterdayCandidate: CandidateEvidence = {
      id: "SRC-WIB-1",
      title: "Hoaks Pemadaman Listrik Hari Ini 10 November 2026",
      url: "https://turnbackhoax.id/2026/11/10/pemadaman",
      domain: "turnbackhoax.id",
      publisher: "TurnBackHoax",
      publishedAt: "2026-11-10",
      snippet: "Klarifikasi kejadian kemarin 10 November 2026.",
      claimedText: "Pemadaman listrik total terjadi pada 10 November 2026",
      origin: "google_fact_check",
      sourceTier: "fact_checker",
      ratingText: "Salah",
    };

    // 10 Nov vs 11 Nov WIB is >= 1 day apart -> rejected by date mismatch
    expect(
      doesCandidateMatchProposition(
        outdatedYesterdayCandidate,
        "Pemadaman listrik total terjadi hari ini di Jakarta",
        {
          claimDateMentioned: "hari ini",
          referenceNow: utcRolloverNow,
        }
      )
    ).toBe(false);
  });

  it("interprets 'hari ini' and 'kemarin' in Asia/Jakarta WIB when UTC date lags behind WIB", () => {
    const utcNightWibNextDay = new Date("2026-11-10T18:30:00.000Z"); // 2026-11-11 01:30 WIB

    const resYesterdayWib = mapEvaluationsToVerifiedSources({
      candidates: [
        {
          id: "SRC-KEMARIN",
          title: "Berita Resmi 10 November 2026",
          url: "https://www.antaranews.com/berita/2026-11-10/kejadian",
          domain: "antaranews.com",
          publisher: "ANTARA News",
          publishedAt: "2026-11-10",
          snippet: "Kejadian berlangsung 10 November 2026.",
          origin: "openai_web_search",
          sourceTier: "credible_media",
        },
        {
          id: "SRC-ARSIP",
          title: "Klarifikasi Lama Oktober 2026",
          url: "https://turnbackhoax.id/2026-10-12/arsip",
          domain: "turnbackhoax.id",
          publisher: "TurnBackHoax",
          publishedAt: "2026-10-12",
          snippet: "Klarifikasi video masa lalu 2024.",
          claimedText: "Kejadian berlangsung kemarin",
          origin: "google_fact_check",
          sourceTier: "fact_checker",
          ratingText: "Salah",
        },
      ],
      primaryClaim: "Insiden banjir terjadi kemarin di Bekasi",
      claimDateMentioned: "kemarin",
      referenceNow: utcNightWibNextDay,
      evaluations: [
        {
          id: "SRC-KEMARIN",
          addressesSameProposition: true,
          matchesTimeContext: true,
          temporalCompatibility: "current_match",
          sourceEventDate: "2026-11-10",
          targetAspect: "event_occurrence",
          relation: "supporting",
          claimEvaluated: "Insiden banjir 10 November 2026",
          rationale: "Sesuai tanggal kemarin WIB (2026-11-10).",
          mentionsOutdatedContext: false,
        },
        {
          id: "SRC-ARSIP",
          addressesSameProposition: true,
          matchesTimeContext: true,
          temporalCompatibility: "unclear",
          sourceEventDate: "2024",
          targetAspect: "text_claim",
          relation: "contradicting",
          claimEvaluated: "Arsip 2024",
          rationale: "Bantahan arsip lama.",
          mentionsOutdatedContext: false,
        },
      ],
    });

    expect(resYesterdayWib.sources.find((s) => s.id === "SRC-KEMARIN")?.relation).toBe(
      "supporting"
    );
    expect(
      resYesterdayWib.sources.find((s) => s.id === "SRC-ARSIP")?.temporalStatus
    ).toBe("historical_debunk");
    expect(resYesterdayWib.sources.find((s) => s.id === "SRC-ARSIP")?.relation).toBe(
      "irrelevant"
    );
  });

  it("flips LLM polarity inversion on debunking screenshots when rationale explicitly supports rejection of the claim", () => {
    const inverted = mapEvaluationsToVerifiedSources({
      candidates: [
        {
          id: "SRC-DETIK",
          title: "Viral Isu SIM Gratis dan Berlaku Seumur Hidup, Korlantas: Hoax",
          url: "https://news.detik.com/berita/d-123/viral-sim-seumur-hidup-hoax",
          domain: "news.detik.com",
          publisher: "Detikcom",
          publishedAt: "2026-11-09",
          snippet: "Korlantas Polri menegaskan masa berlaku SIM tetap 5 tahun.",
          origin: "openai_web_search",
          sourceTier: "credible_media",
        },
        {
          id: "SRC-TRUE",
          title: "Tarif BI-FAST Resmi Rp 2.500",
          url: "https://www.bi.go.id/id/bifast",
          domain: "bi.go.id",
          publisher: "Bank Indonesia",
          publishedAt: "2026-11-09",
          snippet: "Tarif transfer ritel BI-FAST maksimal Rp 2.500 (bukan hoaks).",
          origin: "openai_web_search",
          sourceTier: "official_government",
        },
      ],
      primaryClaim: "SIM berlaku seumur hidup gratis tanpa perpanjangan",
      evaluations: [
        {
          id: "SRC-DETIK",
          addressesSameProposition: true,
          matchesTimeContext: true,
          temporalCompatibility: "current_match",
          sourceEventDate: "2026-11-09",
          targetAspect: "text_claim",
          relation: "supporting",
          claimEvaluated: "SIM berlaku seumur hidup gratis tanpa perpanjangan",
          rationale:
            "Berita Detik mengutip bantahan Korlantas bahwa SIM seumur hidup adalah hoaks, sehingga mendukung penolakan atas klaim utama.",
          mentionsOutdatedContext: false,
        },
        {
          id: "SRC-TRUE",
          addressesSameProposition: true,
          matchesTimeContext: true,
          temporalCompatibility: "current_match",
          sourceEventDate: "2026-11-09",
          targetAspect: "text_claim",
          relation: "supporting",
          claimEvaluated: "Tarif BI-FAST Rp 2.500",
          rationale: "Bank Indonesia mengonfirmasi ketentuan ini resmi dan bukan hoaks.",
          mentionsOutdatedContext: false,
        },
      ],
    });

    expect(inverted.sources.find((s) => s.id === "SRC-DETIK")?.relation).toBe(
      "contradicting"
    );
    expect(inverted.sources.find((s) => s.id === "SRC-TRUE")?.relation).toBe(
      "supporting"
    );
  });
});
