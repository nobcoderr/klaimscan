import type OpenAI from "openai";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as envModule from "@/lib/env";
import * as extractorModule from "@/lib/pipeline/claim-extractor";
import {
  extractClaimFromScreenshot,
  extractClaimsFromOcrText,
  TEXT_VERIFICATION_NOTICE,
} from "@/lib/pipeline/claim-extractor";
import { mapEvaluationsToVerifiedSources } from "@/lib/pipeline/evidence-comparator";
import type { CandidateEvidence } from "@/lib/pipeline/evidence-retriever";
import { runAnalysisPipeline } from "@/lib/pipeline/orchestrator";
import { computeVerdictFromEvidence } from "@/lib/pipeline/verdict-engine";
import type { AtomicClaimItem, ScreenshotOcrResult } from "@/lib/types";
import { makeMinimalPngBuffer } from "../fixtures/images";

function makeOpenAiMockClient(parseImpl: ReturnType<typeof vi.fn>): OpenAI {
  return {
    responses: {
      parse: parseImpl,
    },
  } as unknown as OpenAI;
}

describe("Text-First News Verification Regression Suite (Tests A–G)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("Test A: two screenshots with different cover photos/layouts but identical headlines yield identical normalized claims", async () => {
    const headline =
      "Eks Kapolri Listyo Sigit jadi tersangka penyadapan ilegal Presiden Prabowo";

    const ocrScreenshotA: ScreenshotOcrResult = {
      extractedHeadline: headline,
      graphicOverlayTexts: ["BBC NEWS INDONESIA"],
      extractedCaption: null,
      captionTruncated: false,
      publisherOrAccountName: "BBC News Indonesia",
      visibleAccountHandle: "@bbcindonesia",
      visiblePostUrl: null,
      visiblePublicationDate: "10 November 2026",
      clarificationOrDebunkText: null,
      rawTranscript: headline,
      language: "id",
      platform: "Instagram",
      ocrRegions: [
        {
          id: "OCR-01",
          role: "headline",
          text: headline,
          bbox: { x: 80, y: 510, width: 840, height: 140 },
        },
      ],
    };

    const ocrScreenshotB: ScreenshotOcrResult = {
      extractedHeadline: headline,
      graphicOverlayTexts: ["BERITA HUKUM HARI INI"],
      extractedCaption: null,
      captionTruncated: false,
      publisherOrAccountName: "Portal Berita X",
      visibleAccountHandle: "@portalx",
      visiblePostUrl: null,
      visiblePublicationDate: "10 November 2026",
      clarificationOrDebunkText: null,
      rawTranscript: headline,
      language: "id",
      platform: "X",
      ocrRegions: [
        {
          id: "OCR-01",
          role: "headline",
          text: headline,
          bbox: { x: 120, y: 180, width: 760, height: 120 },
        },
      ],
    };

    // Stage B receives text only and ignores bounding boxes / cover layout / publisher differences
    const parseSpy = vi.fn().mockImplementation(async (req: { input: Array<{ content: unknown }> }) => {
      const serialized = JSON.stringify(req);
      expect(serialized).not.toContain("input_image");
      expect(serialized).not.toContain("bbox");
      expect(serialized).toContain(headline);

      return {
        output_parsed: {
          primaryClaim:
            "Eks Kapolri Listyo Sigit menjadi tersangka penyadapan ilegal Presiden Prabowo",
          secondaryClaims: [],
          normalizedClaims: [
            {
              id: "NC-01",
              subject: "Listyo Sigit Prabowo",
              predicateAction: "ditetapkan sebagai tersangka penyadapan ilegal",
              objectTarget: "Presiden Prabowo",
              proposition:
                "Eks Kapolri Listyo Sigit ditetapkan sebagai tersangka kasus dugaan penyadapan ilegal terhadap Presiden Prabowo",
              eventDate: "November 2026",
              legalOrAdministrativeStatus: "Penetapan tersangka",
              sourceRole: "headline",
              semanticNote: null,
              requiredForFullConfirmation: true,
            },
          ],
          atomicClaims: [
            {
              id: "AC-01",
              category: "main_event",
              label: "Peristiwa Utama",
              proposition:
                "Eks Kapolri Listyo Sigit ditetapkan sebagai tersangka kasus dugaan penyadapan ilegal terhadap Presiden Prabowo",
              requiredForFullConfirmation: true,
            },
            {
              id: "AC-02",
              category: "status_or_stage",
              label: "Status Hukum Resmi",
              proposition:
                "Polri menetapkan Listyo Sigit Prabowo sebagai tersangka",
              requiredForFullConfirmation: true,
            },
          ],
          topicCategory: "Hukum",
          claimDateMentioned: "November 2026",
          postStance: "asserting_claim",
          postStanceSummary:
            "Postingan menyajikan headline berita sebagai fakta.",
          containsCheckableClaim: true,
          searchQueries: [
            "Eks Kapolri Listyo Sigit tersangka penyadapan ilegal Presiden Prabowo",
            "klarifikasi Polri Listyo Sigit penyadapan Prabowo",
          ],
        },
      };
    });

    const fakeClient = makeOpenAiMockClient(parseSpy);

    const resA = await extractClaimsFromOcrText({
      client: fakeClient,
      model: "gpt-5.4-mini",
      ocr: ocrScreenshotA,
    });
    const resB = await extractClaimsFromOcrText({
      client: fakeClient,
      model: "gpt-5.4-mini",
      ocr: ocrScreenshotB,
    });

    expect(resA.primaryClaim).toBe(resB.primaryClaim);
    expect(resA.normalizedClaims).toEqual(resB.normalizedClaims);
    expect(resA.atomicClaims).toEqual(resB.atomicClaims);
    expect(resA.textVerificationNotice).toBe(TEXT_VERIFICATION_NOTICE);
  });

  it("Test B: extracts large headline rendered directly ON TOP OF a cover image accurately via Stage A -> Stage B", async () => {
    const parseSpy = vi
      .fn()
      // Stage A response (Vision OCR)
      .mockResolvedValueOnce({
        output_parsed: {
          extractedHeadline:
            "Eks Kapolri Listyo Sigit jadi tersangka penyadapan ilegal Presiden Prabowo",
          graphicOverlayTexts: [
            "BBC NEWS INDONESIA",
            "Apa yang diketahui sejauh ini?",
          ],
          extractedCaption: null,
          captionTruncated: false,
          publisherOrAccountName: "BBC News Indonesia",
          visibleAccountHandle: "@bbcindonesia",
          visiblePostUrl: null,
          visiblePublicationDate: "10 November 2026",
          clarificationOrDebunkText: null,
          rawTranscript:
            "BBC NEWS INDONESIA\nEks Kapolri Listyo Sigit jadi tersangka penyadapan ilegal Presiden Prabowo\nApa yang diketahui sejauh ini?",
          language: "id",
          platform: "Instagram",
          ocrRegions: [
            {
              id: "OCR-01",
              role: "headline",
              text: "Eks Kapolri Listyo Sigit jadi tersangka penyadapan ilegal Presiden Prabowo",
              bbox: { x: 60, y: 495, width: 880, height: 145 },
            },
            {
              id: "OCR-02",
              role: "graphic_overlay",
              text: "BBC NEWS INDONESIA",
              bbox: { x: 60, y: 430, width: 410, height: 48 },
            },
          ],
        },
      })
      // Stage B response (Text-Only Claim Normalization)
      .mockResolvedValueOnce({
        output_parsed: {
          primaryClaim:
            "Eks Kapolri Listyo Sigit menjadi tersangka penyadapan ilegal Presiden Prabowo",
          secondaryClaims: [],
          normalizedClaims: [
            {
              id: "NC-01",
              subject: "Eks Kapolri Listyo Sigit",
              predicateAction: "ditetapkan sebagai tersangka penyadapan ilegal",
              objectTarget: "Presiden Prabowo",
              proposition:
                "Eks Kapolri Listyo Sigit menjadi tersangka penyadapan ilegal Presiden Prabowo",
              eventDate: "November 2026",
              legalOrAdministrativeStatus: "Tersangka",
              sourceRole: "headline",
              semanticNote: null,
              requiredForFullConfirmation: true,
            },
          ],
          atomicClaims: [
            {
              id: "AC-01",
              category: "main_event",
              label: "Peristiwa Utama",
              proposition:
                "Eks Kapolri Listyo Sigit menjadi tersangka penyadapan ilegal Presiden Prabowo",
              requiredForFullConfirmation: true,
            },
          ],
          topicCategory: "Hukum",
          claimDateMentioned: "November 2026",
          postStance: "asserting_claim",
          postStanceSummary: "Headline berita menyatakan penetapan tersangka.",
          containsCheckableClaim: true,
          searchQueries: ["Listyo Sigit tersangka penyadapan Prabowo"],
        },
      });

    const result = await extractClaimFromScreenshot({
      client: makeOpenAiMockClient(parseSpy),
      model: "gpt-5.4-mini",
      textModel: "gpt-5.4-mini",
      base64DataUrl: "data:image/png;base64,iVBORw0KGgo=",
    });

    expect(parseSpy).toHaveBeenCalledTimes(2);
    // Stage 1 has input_image, Stage 2 strictly has NO input_image
    expect(JSON.stringify(parseSpy.mock.calls[0]?.[0])).toContain(
      "input_image"
    );
    expect(JSON.stringify(parseSpy.mock.calls[1]?.[0])).not.toContain(
      "input_image"
    );

    expect(result.extractedHeadline).toBe(
      "Eks Kapolri Listyo Sigit jadi tersangka penyadapan ilegal Presiden Prabowo"
    );
    expect(result.graphicOverlayTexts).toContain("BBC NEWS INDONESIA");
    expect(result.ocr?.ocrRegions[0].role).toBe("headline");
    expect(result.primaryClaim).toContain("Listyo Sigit");
  });

  it("Test C: extracts screenshot headline and social media caption as separate structured fields", async () => {
    const parseSpy = vi
      .fn()
      .mockResolvedValueOnce({
        output_parsed: {
          extractedHeadline:
            "Gibran resmi ajukan pengunduran diri sebagai Wapres hari ini di Istana Negara",
          graphicOverlayTexts: ["KABAR ISTANA"],
          extractedCaption:
            "Mensesneg Prasetyo Hadi membenarkan Gibran telah menyampaikan niat mengundurkan diri dalam pertemuan tertutup hari ini...",
          captionTruncated: true,
          publisherOrAccountName: "Berita Nasional",
          visibleAccountHandle: "@beritanasional_id",
          visiblePostUrl: null,
          visiblePublicationDate: "10 November 2026",
          clarificationOrDebunkText: null,
          rawTranscript:
            "Headline: Gibran resmi ajukan pengunduran diri sebagai Wapres hari ini di Istana Negara\nCaption: Mensesneg Prasetyo Hadi membenarkan Gibran telah menyampaikan niat mengundurkan diri...",
          language: "id",
          platform: "Instagram",
          ocrRegions: [
            {
              id: "OCR-01",
              role: "headline",
              text: "Gibran resmi ajukan pengunduran diri sebagai Wapres hari ini di Istana Negara",
              bbox: { x: 80, y: 420, width: 840, height: 140 },
            },
            {
              id: "OCR-02",
              role: "caption",
              text: "Mensesneg Prasetyo Hadi membenarkan Gibran telah menyampaikan niat mengundurkan diri dalam pertemuan tertutup hari ini...",
              bbox: { x: 80, y: 740, width: 840, height: 160 },
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        output_parsed: {
          primaryClaim:
            "Gibran resmi mengajukan pengunduran diri sebagai Wakil Presiden pada 10 November 2026",
          secondaryClaims: [
            "Gibran menyampaikan niat mengundurkan diri kepada Presiden Prabowo",
          ],
          normalizedClaims: [
            {
              id: "NC-01",
              subject: "Gibran Rakabuming Raka",
              predicateAction: "resmi mengajukan pengunduran diri",
              objectTarget: "Jabatan Wakil Presiden RI",
              proposition:
                "Gibran resmi mengajukan pengunduran diri sebagai Wakil Presiden pada 10 November 2026",
              eventDate: "10 November 2026",
              legalOrAdministrativeStatus: "Pengajuan formal pengunduran diri",
              sourceRole: "headline",
              semanticNote:
                "Headline menyatakan pengajuan resmi, lebih kuat daripada keterangan niat pada caption.",
              requiredForFullConfirmation: true,
            },
            {
              id: "NC-02",
              subject: "Gibran Rakabuming Raka",
              predicateAction: "menyampaikan niat mengundurkan diri",
              objectTarget: "Presiden Prabowo Subianto",
              proposition:
                "Gibran menyampaikan niat mengundurkan diri kepada Presiden Prabowo pada 10 November 2026",
              eventDate: "10 November 2026",
              legalOrAdministrativeStatus: "Penyampaian niat (belum surat resmi)",
              sourceRole: "caption",
              semanticNote:
                "Caption hanya menyebut penyampaian niat, bukan penyerahan surat pengunduran diri resmi.",
              requiredForFullConfirmation: true,
            },
          ],
          atomicClaims: [
            {
              id: "AC-01",
              category: "main_event",
              label: "Niat / Pertemuan Disampaikan",
              proposition:
                "Gibran menyampaikan niat mengundurkan diri kepada Presiden Prabowo pada 10 November 2026",
              requiredForFullConfirmation: true,
            },
            {
              id: "AC-02",
              category: "status_or_stage",
              label: "Pengajuan Resmi / Status Jabatan",
              proposition:
                "Gibran telah menyerahkan surat pengunduran diri resmi sebagai Wapres",
              requiredForFullConfirmation: true,
            },
          ],
          topicCategory: "Pemerintahan & Politik",
          claimDateMentioned: "10 November 2026",
          postStance: "asserting_claim",
          postStanceSummary:
            "Unggahan menyertakan headline pengajuan resmi bersama caption mengenai penyampaian niat.",
          containsCheckableClaim: true,
          searchQueries: [
            "Gibran mundur Wapres 10 November 2026 Mensesneg",
            "Gibran resmi mengajukan pengunduran diri Istana",
          ],
        },
      });

    const result = await extractClaimFromScreenshot({
      client: makeOpenAiMockClient(parseSpy),
      model: "gpt-5.4-mini",
      base64DataUrl: "data:image/png;base64,iVBORw0KGgo=",
    });

    expect(result.extractedHeadline).toContain("resmi ajukan pengunduran diri");
    expect(result.extractedCaption).toContain("menyampaikan niat mengundurkan diri");
    expect(result.extractedHeadline).not.toBe(result.extractedCaption);
    expect(result.captionTruncated).toBe(true);
    expect(result.normalizedClaims).toHaveLength(2);
  });

  it("Test D: preserves headline ('resmi mengajukan') vs caption ('menyampaikan niat') distinction during verification", () => {
    const primaryClaim =
      "Gibran resmi mengajukan pengunduran diri sebagai Wakil Presiden pada 10 November 2026";

    const atomicClaims: AtomicClaimItem[] = [
      {
        id: "AC-01",
        category: "main_event",
        label: "Niat / Pertemuan Disampaikan",
        proposition:
          "Gibran menyampaikan niat mengundurkan diri kepada Presiden Prabowo pada 10 November 2026",
        requiredForFullConfirmation: true,
      },
      {
        id: "AC-02",
        category: "status_or_stage",
        label: "Pengajuan Resmi / Status Jabatan",
        proposition:
          "Gibran telah menyerahkan surat pengunduran diri resmi dan berhenti menjabat sebagai Wapres",
        requiredForFullConfirmation: true,
      },
    ];

    const candidates: CandidateEvidence[] = [
      {
        id: "SRC-01",
        title:
          "Mensesneg: Gibran Sampaikan Niat Mengundurkan Diri ke Prabowo dalam Pertemuan 2,5 Jam",
        url: "https://www.cnnindonesia.com/nasional/20261110181500-32-1299001/mensesneg-gibran-sampaikan-niat-mundur-ke-prabowo",
        domain: "cnnindonesia.com",
        publisher: "CNN Indonesia",
        publishedAt: "2026-11-10",
        snippet:
          "Pada 10 November 2026, Menteri Sekretaris Negara Prasetyo Hadi mengonfirmasi bahwa Gibran menyampaikan niat mengundurkan diri kepada Presiden Prabowo.",
        origin: "openai_web_search",
        sourceTier: "credible_media",
      },
      {
        id: "SRC-02",
        title: "Istana Benarkan Pertemuan Prabowo-Gibran Bahas Niat Mundur",
        url: "https://www.cnbcindonesia.com/news/20261110190011-4-688101/istana-benarkan-gibran-sampaikan-niat-mundur",
        domain: "cnbcindonesia.com",
        publisher: "CNBC Indonesia",
        publishedAt: "2026-11-10",
        snippet:
          "CNBC Indonesia mengutip keterangan resmi Mensesneg mengenai penyampaian niat mundur pada 10 November 2026, namun belum ada konfirmasi penyerahan surat resmi.",
        origin: "openai_web_search",
        sourceTier: "credible_media",
      },
    ];

    const compared = mapEvaluationsToVerifiedSources({
      candidates,
      primaryClaim,
      atomicClaims,
      claimDateMentioned: "10 November 2026",
      referenceDateIso: "2026-11-10",
      evaluations: [
        {
          id: "SRC-01",
          addressesSameProposition: true,
          matchesTimeContext: true,
          temporalCompatibility: "current_match",
          sourceEventDate: "2026-11-10",
          targetAspect: "event_occurrence",
          evaluatedAtomicClaimId: "AC-01",
          evidenceNature: "independent_reporting",
          independence: "independent",
          relation: "supporting",
          claimEvaluated: atomicClaims[0].proposition,
          rationale: "CNN Indonesia mengonfirmasi Gibran menyampaikan niat mundur.",
          mentionsOutdatedContext: false,
        },
        {
          id: "SRC-02",
          addressesSameProposition: true,
          matchesTimeContext: true,
          temporalCompatibility: "current_match",
          sourceEventDate: "2026-11-10",
          targetAspect: "event_occurrence",
          evaluatedAtomicClaimId: "AC-01",
          evidenceNature: "independent_reporting",
          independence: "independent",
          relation: "supporting",
          claimEvaluated: atomicClaims[0].proposition,
          rationale: "CNBC Indonesia menegaskan baru tahap niat, belum surat resmi.",
          mentionsOutdatedContext: false,
        },
      ],
    });

    const verdict = computeVerdictFromEvidence({
      primaryClaim,
      postStance: "asserting_claim",
      postStanceSummary: "Headline menyebut pengajuan resmi, caption menyebut niat.",
      sources: compared.sources,
      atomicClaims,
      outdatedSignalDetected: compared.outdatedSignalDetected,
    });

    expect(
      verdict.qualifiedStatusLabels?.some((label) =>
        label.startsWith("NIAT / PERTEMUAN DISAMPAIKAN: TERKONFIRMASI")
      )
    ).toBe(true);
    expect(
      verdict.qualifiedStatusLabels?.some((label) =>
        label.startsWith("PENGAJUAN RESMI / STATUS JABATAN: BELUM TERVERIFIKASI")
      )
    ).toBe(true);
    expect(verdict.claimVerdict).toBe("UNVERIFIED");
    expect(verdict.claimVerdict).not.toBe("FALSE");
  });

  it("Test E: excludes older fact-checks (2026-10-12) and cover-photo-only debunks (Komdigi hoaks-foto) without emitting VIRAL PHOTO FALSE", () => {
    const gibranCandidates: CandidateEvidence[] = [
      {
        id: "SRC-01",
        title: "Mensesneg Konfirmasi Gibran Sampaikan Niat Mundur 10 Nov 2026",
        url: "https://www.antaranews.com/berita/4500123/mensesneg-konfirmasi-niat-mundur-gibran",
        domain: "antaranews.com",
        publisher: "ANTARA News",
        publishedAt: "2026-11-10",
        snippet:
          "ANTARA melaporkan keterangan Mensesneg atas penyampaian niat mundur pada 10 November 2026.",
        origin: "openai_web_search",
        sourceTier: "credible_media",
      },
      {
        id: "SRC-02",
        title:
          "HOAKS Video Gibran Rakabuming Raka Mengundurkan Diri sebagai Wakil Presiden",
        url: "https://www.komdigi.go.id/berita/berita-hoaks/detail/hoaks-video-gibran-mengundurkan-diri-sebagai-wapres",
        domain: "komdigi.go.id",
        publisher: "Komdigi RI",
        publishedAt: "2026-10-12",
        snippet:
          "Klarifikasi 12 Oktober 2026: video tersebut merupakan momen pengunduran diri Gibran sebagai Wali Kota Solo pada Juli 2024.",
        claimedText: "Video Gibran mundur sebagai Wapres pada Oktober 2026",
        origin: "google_fact_check",
        sourceTier: "official_government",
        ratingText: "Salah",
      },
    ];

    const gibranCompared = mapEvaluationsToVerifiedSources({
      candidates: gibranCandidates,
      primaryClaim:
        "Gibran resmi mengajukan pengunduran diri sebagai Wakil Presiden pada 10 November 2026",
      claimDateMentioned: "10 November 2026",
      referenceDateIso: "2026-11-10",
      evaluations: [
        {
          id: "SRC-01",
          addressesSameProposition: true,
          matchesTimeContext: true,
          temporalCompatibility: "current_match",
          sourceEventDate: "2026-11-10",
          targetAspect: "event_occurrence",
          evaluatedAtomicClaimId: null,
          relation: "supporting",
          claimEvaluated: "Penyampaian niat mundur",
          rationale: "Laporan ANTARA 10 Nov 2026.",
          mentionsOutdatedContext: false,
        },
        {
          id: "SRC-02",
          addressesSameProposition: true,
          matchesTimeContext: true,
          temporalCompatibility: "unclear",
          sourceEventDate: "2024",
          targetAspect: "text_claim",
          evaluatedAtomicClaimId: null,
          relation: "contradicting",
          claimEvaluated: "Video 2024",
          rationale: "Membantah video lama.",
          mentionsOutdatedContext: false,
        },
      ],
    });

    const oldFactCheck = gibranCompared.sources.find((s) => s.id === "SRC-02");
    expect(oldFactCheck?.temporalStatus).toBe("historical_debunk");
    expect(oldFactCheck?.relation).toBe("irrelevant");

    // Also test Listyo Sigit Text-First isolation of Komdigi cover-photo debunk (no VIRAL PHOTO FALSE!)
    const listyoAtomic: AtomicClaimItem[] = [
      {
        id: "AC-01",
        category: "main_event",
        label: "Peristiwa Utama",
        proposition:
          "Eks Kapolri Listyo Sigit ditetapkan sebagai tersangka kasus dugaan penyadapan ilegal Presiden Prabowo",
        requiredForFullConfirmation: true,
      },
      {
        id: "AC-02",
        category: "status_or_stage",
        label: "Status Hukum Resmi",
        proposition: "Bareskrim Polri menetapkan Listyo Sigit Prabowo sebagai tersangka",
        requiredForFullConfirmation: true,
      },
    ];

    const listyoCompared = mapEvaluationsToVerifiedSources({
      candidates: [
        {
          id: "SRC-10",
          title:
            "Polri Tetapkan Eks Kapolri Listyo Sigit Tersangka Penyadapan Ilegal",
          url: "https://news.detik.com/berita/d-888111/polri-tetapkan-listyo-sigit-tersangka",
          domain: "news.detik.com",
          publisher: "Detiknews",
          publishedAt: "2026-11-03",
          snippet:
            "Polri resmi mengumumkan penetapan Listyo Sigit sebagai tersangka pada 3 November 2026.",
          origin: "openai_web_search",
          sourceTier: "credible_media",
        },
        {
          id: "SRC-11",
          title:
            "Bakom RI Konfirmasi Proses Hukum Penetapan Tersangka Listyo Sigit",
          url: "https://bakom.go.id/rilis/penetapan-tersangka-listyo-sigit",
          domain: "bakom.go.id",
          publisher: "Bakom RI",
          publishedAt: "2026-11-04",
          snippet: "Badan Komunikasi Pemerintah mengonfirmasi penetapan tersangka berjalan.",
          origin: "openai_web_search",
          sourceTier: "official_government",
        },
        {
          id: "SRC-12",
          title: "Hoaks Foto Bareskrim Tangkap Listyo Sigit Tersangka Penyadapan",
          url: "https://www.komdigi.go.id/berita/berita-hoaks/detail/hoaks-foto-bareskrim-tangkap-listyo-sigit-tersangka-penyadapan",
          domain: "komdigi.go.id",
          publisher: "Komdigi RI",
          publishedAt: "2026-11-09",
          snippet:
            "Komdigi meluruskan foto penangkapan manipulasi AI, bukan membantah adanya kasus penetapan tersangka yang memang terjadi.",
          claimedText: "Foto penangkapan Listyo Sigit oleh Bareskrim adalah asli",
          origin: "google_fact_check",
          sourceTier: "official_government",
          ratingText: "Salah",
        },
      ],
      primaryClaim:
        "Eks Kapolri Listyo Sigit menjadi tersangka penyadapan ilegal Presiden Prabowo",
      atomicClaims: listyoAtomic,
      claimDateMentioned: "November 2026",
      referenceDateIso: "2026-11-10",
      evaluations: [
        {
          id: "SRC-10",
          addressesSameProposition: true,
          matchesTimeContext: true,
          temporalCompatibility: "current_match",
          sourceEventDate: "2026-11-03",
          targetAspect: "status_or_stage",
          evaluatedAtomicClaimId: "AC-02",
          evaluatedAtomicClaimIds: ["AC-01", "AC-02"],
          evidenceNature: "independent_reporting",
          independence: "independent",
          relation: "supporting",
          claimEvaluated: listyoAtomic[1].proposition,
          rationale: "Detik mengonfirmasi.",
          mentionsOutdatedContext: false,
        },
        {
          id: "SRC-11",
          addressesSameProposition: true,
          matchesTimeContext: true,
          temporalCompatibility: "current_match",
          sourceEventDate: "2026-11-04",
          targetAspect: "status_or_stage",
          evaluatedAtomicClaimId: "AC-02",
          evaluatedAtomicClaimIds: ["AC-01", "AC-02"],
          evidenceNature: "direct_statement",
          independence: "independent",
          relation: "supporting",
          claimEvaluated: listyoAtomic[1].proposition,
          rationale: "Bakom RI mengonfirmasi.",
          mentionsOutdatedContext: false,
        },
        {
          id: "SRC-12",
          addressesSameProposition: true,
          matchesTimeContext: true,
          temporalCompatibility: "current_match",
          sourceEventDate: "2026-11-09",
          targetAspect: "text_claim",
          evaluatedAtomicClaimId: "AC-01",
          relation: "contradicting",
          claimEvaluated: "Foto penangkapan",
          rationale: "Membantah foto penangkapan AI.",
          mentionsOutdatedContext: false,
        },
      ],
    });

    const photoSource = listyoCompared.sources.find((s) => s.id === "SRC-12");
    expect(photoSource?.targetAspect).toBe("image_authenticity");
    expect(photoSource?.relation).toBe("irrelevant");

    const listyoVerdict = computeVerdictFromEvidence({
      primaryClaim:
        "Eks Kapolri Listyo Sigit menjadi tersangka penyadapan ilegal Presiden Prabowo",
      postStance: "asserting_claim",
      postStanceSummary: "Unggahan menyampaikan headline berita.",
      sources: listyoCompared.sources,
      atomicClaims: listyoAtomic,
      outdatedSignalDetected: listyoCompared.outdatedSignalDetected,
    });

    expect(listyoVerdict.claimVerdict).toBe("TRUE");
    expect(
      listyoVerdict.qualifiedStatusLabels?.some((label) =>
        label.startsWith("PERISTIWA UTAMA: TERKONFIRMASI")
      )
    ).toBe(true);
    expect(
      listyoVerdict.qualifiedStatusLabels?.some((label) =>
        label.startsWith("STATUS HUKUM RESMI: TERKONFIRMASI")
      )
    ).toBe(true);
    expect(listyoVerdict.qualifiedStatusLabels).not.toContain(
      "VIRAL PHOTO FALSE"
    );
  });

  it("Test F: returns UNVERIFIED and skips web guessing when screenshot contains no readable factual text", async () => {
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
      pipelineDeadlineMs: 25_000,
      trustedProxyMode: "none",
      upstashRedisRestUrl: undefined,
      upstashRedisRestToken: undefined,
      requireDistributedQuota: false,
    });

    vi.spyOn(extractorModule, "extractClaimFromScreenshot").mockResolvedValue({
      extractedText: "Ikuti · Suka · Bagikan",
      extractedHeadline: null,
      graphicOverlayTexts: [],
      extractedCaption: null,
      captionTruncated: false,
      primaryClaim:
        "Tidak terdapat teks klaim faktual yang terbaca jelas pada screenshot",
      secondaryClaims: [],
      normalizedClaims: [],
      atomicClaims: [
        {
          id: "AC-01",
          category: "main_event",
          label: "Ketersediaan Teks Faktual",
          proposition:
            "Tidak terdapat teks klaim faktual yang terbaca jelas pada screenshot",
          requiredForFullConfirmation: false,
        },
      ],
      textVerificationNotice: TEXT_VERIFICATION_NOTICE,
      topicCategory: "Tidak Terklasifikasi",
      claimDateMentioned: null,
      language: "id",
      platform: "Instagram",
      visibleAccountHandle: null,
      visibleAccountName: null,
      visiblePostUrl: null,
      visibleTimestamp: null,
      postStance: "unclear_context",
      postStanceSummary: "Tidak ada teks klaim berita.",
      containsCheckableClaim: false,
      searchQueries: ["klaim tidak terbaca"],
    });

    const report = await runAnalysisPipeline({
      rawBuffer: makeMinimalPngBuffer(),
      fileName: "blank-photo.png",
      declaredMimeType: "image/png",
    });

    expect(report.claimExtraction.containsCheckableClaim).toBe(false);
    expect(report.verdict.claimVerdict).toBe("UNVERIFIED");
    expect(report.evidenceSources).toHaveLength(0);
    expect(
      report.pipelineSteps.find((s) => s.id === "evidence_retrieval")?.status
    ).toBe("skipped");
  });

  it("Test G: marks @vereditum debunked claim FALSE while classifying post stance as debunking_claim", async () => {
    const parseSpy = vi
      .fn()
      .mockResolvedValueOnce({
        output_parsed: {
          extractedHeadline: "SIM Seumur Hidup Gratis Tanpa Perpanjangan",
          graphicOverlayTexts: ["HOAKS / KLARIFIKASI"],
          extractedCaption:
            "TIDAK BENAR. Korlantas Polri menegaskan masa berlaku SIM tetap 5 tahun sesuai UU No. 22 Tahun 2009.",
          captionTruncated: false,
          publisherOrAccountName: "Vereditum Fact Check",
          visibleAccountHandle: "@vereditum",
          visiblePostUrl: "https://instagram.com/vereditum",
          visiblePublicationDate: "3 jam lalu",
          clarificationOrDebunkText: "HOAKS / KLARIFIKASI · TIDAK BENAR",
          rawTranscript:
            "@vereditum HOAKS SIM Seumur Hidup Gratis Tanpa Perpanjangan TIDAK BENAR Korlantas Polri menegaskan masa berlaku SIM tetap 5 tahun.",
          language: "id",
          platform: "Instagram",
          ocrRegions: [
            {
              id: "OCR-01",
              role: "debunk_note",
              text: "HOAKS / KLARIFIKASI",
              bbox: { x: 80, y: 310, width: 250, height: 80 },
            },
            {
              id: "OCR-02",
              role: "headline",
              text: "SIM Seumur Hidup Gratis Tanpa Perpanjangan",
              bbox: { x: 80, y: 440, width: 760, height: 95 },
            },
          ],
        },
      })
      .mockResolvedValueOnce({
        output_parsed: {
          primaryClaim: "SIM berlaku seumur hidup gratis tanpa perpanjangan",
          secondaryClaims: [],
          normalizedClaims: [
            {
              id: "NC-01",
              subject: "Surat Izin Mengemudi (SIM)",
              predicateAction: "berlaku seumur hidup gratis tanpa perpanjangan",
              objectTarget: "Pemegang SIM Indonesia",
              proposition: "SIM berlaku seumur hidup gratis tanpa perpanjangan",
              eventDate: null,
              legalOrAdministrativeStatus: null,
              sourceRole: "headline",
              semanticNote:
                "Klaim yang diuji diambil dari topik yang dibantah, bukan kalimat koreksi @vereditum.",
              requiredForFullConfirmation: true,
            },
          ],
          atomicClaims: [
            {
              id: "AC-01",
              category: "main_event",
              label: "Klaim Kebijakan yang Diuji",
              proposition: "SIM berlaku seumur hidup gratis tanpa perpanjangan",
              requiredForFullConfirmation: true,
            },
          ],
          topicCategory: "Kebijakan Publik",
          claimDateMentioned: null,
          postStance: "debunking_claim",
          postStanceSummary:
            "Akun @vereditum sedang membantah klaim SIM seumur hidup.",
          containsCheckableClaim: true,
          searchQueries: ["Korlantas Polri SIM seumur hidup 5 tahun"],
        },
      });

    const extracted = await extractClaimFromScreenshot({
      client: makeOpenAiMockClient(parseSpy),
      model: "gpt-5.4-mini",
      base64DataUrl: "data:image/png;base64,iVBORw0KGgo=",
    });

    const verdict = computeVerdictFromEvidence({
      primaryClaim: extracted.primaryClaim,
      postStance: extracted.postStance,
      postStanceSummary: extracted.postStanceSummary,
      atomicClaims: extracted.atomicClaims,
      containsCheckableClaim: extracted.containsCheckableClaim,
      sources: [
        {
          id: "SRC-01",
          title: "Korlantas Tegaskan SIM Tetap Berlaku 5 Tahun",
          url: "https://korlantas.polri.go.id/sim-5-tahun",
          domain: "korlantas.polri.go.id",
          publisher: "Korlantas Polri",
          publishedAt: "2026-10-14",
          snippet: "Masa berlaku SIM tetap 5 tahun sesuai UU LLAJ.",
          relation: "contradicting",
          targetAspect: "text_claim",
          evaluatedAtomicClaimId: "AC-01",
          claimEvaluated: extracted.primaryClaim,
          sourceTier: "official_government",
          evidenceNature: "primary_record",
          excerptBasis: "direct_source_content",
          origin: "openai_web_search",
          rationale: "Sumber resmi Korlantas membantah klaim seumur hidup.",
        },
      ],
    });

    expect(extracted.postStance).toBe("debunking_claim");
    expect(verdict.claimVerdict).toBe("FALSE");
    expect(verdict.postStance).toBe("debunking_claim");
    expect(verdict.postClassification).toContain("Debunking");
    expect(verdict.explanation).toContain("bukan pembuat hoaks");
  });
});
