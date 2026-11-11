import { describe, expect, it } from "vitest";
import {
  compareEvidenceAgainstClaim,
  doesCandidateMatchProposition,
  hasDirectionalRoleSwap,
  hasHardSemanticConflict,
  isEarlierScheduleDelayContext,
  inferRelationFromRatingText,
  mapEvaluationsToVerifiedSources,
  resolveClaimTemporalContext,
} from "@/lib/pipeline/evidence-comparator";
import type { CandidateEvidence } from "@/lib/pipeline/evidence-retriever";
import type { ClaimExtractionResult } from "@/lib/types";
import { computeVerdictFromEvidence } from "@/lib/pipeline/verdict-engine";
import type OpenAI from "openai";

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

  it("does not treat an earlier schedule delay as a contradiction of a newer target", () => {
    expect(
      isEarlierScheduleDelayContext({
        primaryClaim:
          "Program pemerintah ditargetkan terealisasi dua bulan lagi",
        sourceText: "Jadwal awal sebelumnya tertunda.",
        claimPublicationDate: "2026-11-05",
        sourcePublicationDate: "2026-10-20",
      })
    ).toBe(true);

    expect(
      isEarlierScheduleDelayContext({
        primaryClaim:
          "Program pemerintah ditargetkan terealisasi dua bulan lagi",
        sourceText:
          "Target dua bulan lagi dibatalkan dan program tidak akan terealisasi.",
        claimPublicationDate: "2026-11-05",
        sourcePublicationDate: "2026-10-20",
      })
    ).toBe(false);

    const mapped = mapEvaluationsToVerifiedSources({
      candidates: [
        {
          id: "SRC-OLD-SCHEDULE",
          title: "Jadwal awal program sempat tertunda",
          url: "https://bakom.go.id/berita/jadwal-awal",
          domain: "bakom.go.id",
          publisher: "Bakom",
          publishedAt: "2026-10-20",
          publicationDateBasis: "verified",
          snippet: "Jadwal awal sebelumnya tertunda.",
          origin: "openai_web_search",
          sourceTier: "official_government",
        },
      ],
      primaryClaim:
        "Program pemerintah ditargetkan terealisasi dua bulan lagi",
      visibleTimestamp: "5 November 2026",
      evaluations: [
        {
          id: "SRC-OLD-SCHEDULE",
          addressesSameProposition: true,
          matchesTimeContext: true,
          temporalCompatibility: "current_match",
          sourceEventDate: "2026-10-20",
          sourceEventDateBasis: "reported",
          targetAspect: "plan_or_target",
          relation: "contradicting",
          claimEvaluated: "Jadwal awal program sempat tertunda",
          rationale: "Sumber membahas penundaan jadwal awal.",
          mentionsOutdatedContext: false,
        },
      ],
    });

    expect(mapped.sources[0].relation).toBe("partial_context");
    expect(mapped.sources[0].rationale).toContain("target baru");
  });

  it("does not confirm publication dates from search summaries", () => {
    const mapped = mapEvaluationsToVerifiedSources({
      candidates: [
        {
          id: "SRC-DATE",
          title: "Pengumuman program",
          url: "https://bakom.go.id/siaran/pengumuman",
          domain: "bakom.go.id",
          publisher: "Bakom",
          publishedAt: null,
          publicationDateBasis: "unknown",
          snippet: "[2026-11-05] Pemerintah mengumumkan target program.",
          origin: "openai_web_search",
          sourceTier: "official_government",
        },
      ],
      primaryClaim: "Pemerintah mengumumkan target program dua bulan lagi",
      evaluations: [
        {
          id: "SRC-DATE",
          addressesSameProposition: true,
          matchesTimeContext: true,
          temporalCompatibility: "current_match",
          sourceEventDate: "2026-11-05",
          sourceEventDateBasis: "reported",
          targetAspect: "plan_or_target",
          relation: "supporting",
          claimEvaluated: "Pemerintah mengumumkan target program",
          rationale: "Tanggal 5 November disebut sebagai tanggal kejadian.",
          mentionsOutdatedContext: false,
        },
      ],
    });

    expect(mapped.sources[0].publishedAt).toBeNull();
    expect(mapped.sources[0].publicationDateBasis).toBe("unknown");
    expect(mapped.sources[0].sourceEventDate).toBe("2026-11-05");
    expect(mapped.sources[0].sourceEventDateBasis).toBe("reported");
  });

  it("rejects unrelated fact-check text even when the official domain and rating look authoritative", () => {
    const output = mapEvaluationsToVerifiedSources({
      candidates: [
        {
          id: "SRC-UNRELATED",
          title: "Klarifikasi resmi",
          url: "https://bakom.go.id/berita/bantuan-pangan",
          domain: "bakom.go.id",
          publisher: "Bakom",
          publishedAt: "2026-11-05",
          publicationDateBasis: "verified",
          snippet: "Klaim mengenai bantuan pangan diperiksa.",
          claimedText: "Bantuan pangan disalurkan di wilayah timur",
          origin: "google_fact_check",
          sourceTier: "official_government",
          ratingText: "Benar",
        },
      ],
      primaryClaim:
        "Program Satu Orang Satu Rekening ditargetkan berjalan dua bulan lagi",
      evaluations: [
        {
          id: "SRC-UNRELATED",
          addressesSameProposition: true,
          matchesTimeContext: true,
          temporalCompatibility: "current_match",
          sourceEventDate: null,
          sourceEventDateBasis: "unknown",
          targetAspect: "plan_or_target",
          relation: "supporting",
          claimEvaluated: "Program rekening ditargetkan berjalan.",
          rationale: "Domain sumber merupakan situs pemerintah.",
          mentionsOutdatedContext: false,
        },
      ],
    });

    expect(output.sources[0].relation).toBe("irrelevant");
    expect(output.sources[0].rationale).toContain("berbeda dari klaim utama");
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
    expect(output.sources[0].relation).toBe("insufficient");
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

    expect(
      doesCandidateMatchProposition(
        SAMPLE_CANDIDATES[0],
        "SIM berlaku seumur hidup gratis tanpa perpanjangan"
      )
    ).toBe(true);

    // When AI comparison fails, a matching source is unassessed (insufficient), not irrelevant or decisive.
    const matchingFallback = mapEvaluationsToVerifiedSources({
      candidates: SAMPLE_CANDIDATES,
      primaryClaim: "SIM berlaku seumur hidup gratis tanpa perpanjangan",
      evaluations: [],
    });
    expect(matchingFallback.sources[0].relation).toBe("insufficient");

    const fallbackVerdict = computeVerdictFromEvidence({
      primaryClaim: "SIM berlaku seumur hidup gratis tanpa perpanjangan",
      postStance: "asserting_claim",
      postStanceSummary: "Postingan mengklaim SIM seumur hidup.",
      sources: matchingFallback.sources,
    });
    expect(fallbackVerdict.claimVerdict).toBe("UNVERIFIED");
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
          targetAspect: "status_or_stage",
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

  it("detects subject-object role swaps and defaults failed compareEvidenceAgainstClaim calls to UNVERIFIED", async () => {
    const claim = "Andi menuduh Budi melakukan penipuan.";
    const reversedClaim = "Budi menuduh Andi melakukan penipuan.";
    const validPassiveEquivalent = "Budi dituduh oleh Andi melakukan penipuan.";

    expect(hasDirectionalRoleSwap(claim, reversedClaim)).toBe(true);
    expect(hasHardSemanticConflict(claim, reversedClaim)).toBe(true);
    expect(
      doesCandidateMatchProposition(
        {
          title: "Klarifikasi Kasus",
          snippet: "Klarifikasi penipuan.",
          claimedText: reversedClaim,
          publishedAt: "2026-11-10",
        },
        claim
      )
    ).toBe(false);

    // Active vs passive preserving identical actor/target MUST remain compatible
    expect(hasDirectionalRoleSwap(claim, validPassiveEquivalent)).toBe(false);
    expect(hasHardSemanticConflict(claim, validPassiveEquivalent)).toBe(false);
    expect(
      doesCandidateMatchProposition(
        {
          title: "Klarifikasi Kasus",
          snippet: "Klarifikasi penipuan.",
          claimedText: validPassiveEquivalent,
          publishedAt: "2026-11-10",
        },
        claim
      )
    ).toBe(true);

    // English passive equivalence & swap protection
    expect(
      hasDirectionalRoleSwap(
        "Andi accused Budi of fraud.",
        "Andi was accused by Budi of fraud."
      )
    ).toBe(true);
    expect(
      hasDirectionalRoleSwap(
        "Andi accused Budi of fraud.",
        "Budi was accused by Andi of fraud."
      )
    ).toBe(false);

    // Defense-in-depth: even if AI comparator erroneously sets addressesSameProposition=true on reversed role
    const roleSwappedEvalResult = mapEvaluationsToVerifiedSources({
      candidates: [
        {
          id: "SRC-SWAP",
          title: "Cek Fakta Tuduhan Penipuan",
          url: "https://turnbackhoax.id/2026/11/10/swap",
          domain: "turnbackhoax.id",
          publisher: "TurnBackHoax",
          publishedAt: "2026-11-10",
          snippet: "Budi menuduh Andi melakukan penipuan adalah salah.",
          claimedText: reversedClaim,
          origin: "google_fact_check",
          sourceTier: "fact_checker",
          ratingText: "Salah",
        },
      ],
      primaryClaim: claim,
      evaluations: [
        {
          id: "SRC-SWAP",
          addressesSameProposition: true,
          matchesTimeContext: true,
          temporalCompatibility: "current_match",
          sourceEventDate: "2026-11-10",
          targetAspect: "text_claim",
          relation: "contradicting",
          claimEvaluated: reversedClaim,
          rationale: "Membantah Budi menuduh Andi.",
          mentionsOutdatedContext: false,
        },
      ],
    });
    expect(roleSwappedEvalResult.sources[0].relation).toBe("irrelevant");

    // Failed / timed-out compareEvidenceAgainstClaim MUST return UNVERIFIED instead of heuristic TRUE/FALSE
    const failingClient = {
      responses: {
        parse: async () => {
          throw new Error("Simulated OpenAI comparator outage");
        },
      },
    } as unknown as OpenAI;

    const extraction: ClaimExtractionResult = {
      extractedText: claim,
      primaryClaim: claim,
      secondaryClaims: [],
      topicCategory: "Hukum",
      claimDateMentioned: "10 November 2026",
      language: "id",
      platform: "X",
      visibleAccountHandle: "@contoh",
      visibleAccountName: "Contoh",
      visiblePostUrl: null,
      visibleTimestamp: "10 November 2026",
      postStance: "asserting_claim",
      postStanceSummary: "Postingan mengklaim tuduhan.",
      containsCheckableClaim: true,
      searchQueries: ["Andi menuduh Budi penipuan"],
    };

    const failedOut = await compareEvidenceAgainstClaim({
      client: failingClient,
      model: "gpt-5.4-mini",
      extraction,
      candidates: SAMPLE_CANDIDATES.map((c) => ({
        ...c,
        claimedText: claim,
      })),
    });

    expect(failedOut.warning).toContain("UNVERIFIED");
    expect(failedOut.sources.every((s) => s.relation === "irrelevant")).toBe(true);
    const failedVerdict = computeVerdictFromEvidence({
      primaryClaim: extraction.primaryClaim,
      postStance: extraction.postStance,
      postStanceSummary: extraction.postStanceSummary,
      sources: failedOut.sources,
      unresolvedTimeContext: failedOut.unresolvedTimeContext,
    });
    expect(failedVerdict.claimVerdict).toBe("UNVERIFIED");
  });

  it("anchors 'hari ini' on old screenshots to visibleTimestamp and flags unanchored relative claims cleanly", () => {
    const uploadDateNow = new Date("2026-11-11T05:00:00.000Z");

    // Sub-case 1: Old screenshot posted on 15 Oktober 2024 saying "hari ini", uploaded on 2026-11-11
    const anchoredCtx = resolveClaimTemporalContext({
      primaryClaim: "Demonstrasi besar terjadi hari ini di Balai Kota",
      claimDateMentioned: "hari ini",
      visibleTimestamp: "15 Oktober 2024",
      referenceDateIso: "2026-11-11",
      referenceNow: uploadDateNow,
    });
    expect(anchoredCtx.temporalAnchorStatus).toBe("anchored_to_post_date");
    expect(anchoredCtx.publicationAnchorIso).toBe("2024-10-15");
    expect(anchoredCtx.unresolvedRelativeTime).toBe(false);
    expect(
      anchoredCtx.exactClaimDateMs
        ? new Date(anchoredCtx.exactClaimDateMs).toISOString().slice(0, 10)
        : null
    ).toBe("2024-10-15");

    const newsOct2024: CandidateEvidence = {
      id: "SRC-2024",
      title: "Demonstrasi Besar Balai Kota 15 Oktober 2024",
      url: "https://www.antaranews.com/berita/2024/10/15/demo",
      domain: "antaranews.com",
      publisher: "ANTARA News",
      publishedAt: "2024-10-15",
      snippet: "Aksi berlangsung pada 15 Oktober 2024.",
      claimedText: "Demonstrasi besar terjadi pada 15 Oktober 2024 di Balai Kota",
      origin: "openai_web_search",
      sourceTier: "official_government",
    };
    const newsNov2026: CandidateEvidence = {
      id: "SRC-2026",
      title: "Hoaks Demonstrasi 11 November 2026",
      url: "https://turnbackhoax.id/2026/11/11/demo",
      domain: "turnbackhoax.id",
      publisher: "TurnBackHoax",
      publishedAt: "2026-11-11",
      snippet: "Klarifikasi kejadian 11 November 2026.",
      claimedText: "Demonstrasi besar terjadi pada 11 November 2026 di Balai Kota",
      origin: "google_fact_check",
      sourceTier: "fact_checker",
      ratingText: "Salah",
    };

    // Must match 2024-10-15 and REJECT 2026-11-11 even though upload date is 2026-11-11
    expect(
      doesCandidateMatchProposition(
        newsOct2024,
        "Demonstrasi besar terjadi hari ini di Balai Kota",
        {
          claimDateMentioned: "hari ini",
          visibleTimestamp: "15 Oktober 2024",
          referenceDateIso: "2026-11-11",
          referenceNow: uploadDateNow,
        }
      )
    ).toBe(true);
    expect(
      doesCandidateMatchProposition(
        newsNov2026,
        "Demonstrasi besar terjadi hari ini di Balai Kota",
        {
          claimDateMentioned: "hari ini",
          visibleTimestamp: "15 Oktober 2024",
          referenceDateIso: "2026-11-11",
          referenceNow: uploadDateNow,
        }
      )
    ).toBe(false);

    // Sub-case 2: Old screenshot saying "hari ini" WITHOUT a calendar visibleTimestamp (null or "3 jam lalu")
    const unanchoredCtx = resolveClaimTemporalContext({
      primaryClaim: "Banjir besar terjadi hari ini di pusat kota",
      claimDateMentioned: "hari ini",
      visibleTimestamp: "3 jam lalu",
      referenceDateIso: "2026-11-11",
      referenceNow: uploadDateNow,
    });
    expect(unanchoredCtx.temporalAnchorStatus).toBe("unanchored_relative_time");
    expect(unanchoredCtx.unresolvedRelativeTime).toBe(true);
    expect(unanchoredCtx.exactClaimDateMs).toBeNull();

    const mappedUnanchored = mapEvaluationsToVerifiedSources({
      candidates: [
        {
          id: "SRC-BANJIR-2024",
          title: "Banjir Pusat Kota Tahun 2024",
          url: "https://kompas.com/read/2024/01/05/banjir",
          domain: "kompas.com",
          publisher: "Kompas",
          publishedAt: "2024-01-05",
          snippet: "Banjir terjadi di pusat kota.",
          origin: "openai_web_search",
          sourceTier: "credible_media",
        },
        {
          id: "SRC-BANJIR-2024-RESMI",
          title: "BPBD Laporan Banjir Pusat Kota",
          url: "https://bnpb.go.id/berita/banjir-pusat-kota",
          domain: "bnpb.go.id",
          publisher: "BNPB",
          publishedAt: "2024-01-05",
          snippet: "BNPB melaporkan banjir terjadi di pusat kota.",
          origin: "openai_web_search",
          sourceTier: "official_government",
        },
      ],
      primaryClaim: "Banjir besar terjadi hari ini di pusat kota",
      claimDateMentioned: "hari ini",
      visibleTimestamp: null,
      referenceDateIso: "2026-11-11",
      referenceNow: uploadDateNow,
      evaluations: [
        {
          id: "SRC-BANJIR-2024-RESMI",
          addressesSameProposition: true,
          matchesTimeContext: true,
          temporalCompatibility: "current_match",
          sourceEventDate: "2024-01-05",
          targetAspect: "event_occurrence",
          relation: "supporting",
          claimEvaluated: "Banjir besar di pusat kota",
          rationale: "BNPB melaporkan banjir memang terjadi.",
          mentionsOutdatedContext: false,
        },
      ],
    });

    expect(mappedUnanchored.unresolvedTimeContext).toBe(true);
    expect(mappedUnanchored.sources[0].temporalStatus).toBe("unclear");
    expect(mappedUnanchored.sources[1].temporalStatus).toBe("unclear");

    // Must hold TRUE -> UNVERIFIED and explain temporal uncertainty clearly
    const heldVerdict = computeVerdictFromEvidence({
      primaryClaim: "Banjir besar terjadi hari ini di pusat kota",
      postStance: "asserting_claim",
      postStanceSummary: "Akun menyebut banjir terjadi hari ini.",
      sources: mappedUnanchored.sources,
      unresolvedTimeContext: mappedUnanchored.unresolvedTimeContext,
    });
    expect(heldVerdict.claimVerdict).toBe("UNVERIFIED");
    expect(heldVerdict.explanation).toContain("belum dapat dipastikan");

    // Sub-case 3: Recycled old event confirmed as OUTDATED keeps OUTDATED + temporal caveat
    const outdatedUnanchored = computeVerdictFromEvidence({
      primaryClaim: "Banjir besar terjadi hari ini di pusat kota",
      postStance: "asserting_claim",
      postStanceSummary: "Akun mengunggah ulang video lama bertuliskan hari ini.",
      sources: [
        {
          id: "SRC-OLD",
          title: "Cek Fakta Video Banjir Lama Diunggah Ulang",
          url: "https://turnbackhoax.id/banjir-lama",
          domain: "turnbackhoax.id",
          publisher: "TurnBackHoax",
          publishedAt: "2026-11-10",
          snippet: "Video banjir tahun 2024 diunggah ulang dengan keterangan hari ini.",
          relation: "partial_context",
          targetAspect: "event_occurrence",
          temporalStatus: "date_mismatch",
          claimEvaluated: "Banjir besar terjadi hari ini di pusat kota",
          sourceTier: "fact_checker",
          origin: "google_fact_check",
          rationale: "Konten lama didaur ulang.",
        },
      ],
      outdatedSignalDetected: true,
      unresolvedTimeContext: true,
    });
    expect(outdatedUnanchored.claimVerdict).toBe("OUTDATED");
    expect(outdatedUnanchored.explanation).toContain("belum dapat dipastikan");
  });
});
