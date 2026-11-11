import type OpenAI from "openai";
import { describe, expect, it, vi } from "vitest";
import {
  buildEvidenceSearchQueries,
  classifySourceTier,
  deduplicateEvidence,
  extractDateFromText,
  extractSentenceAwareExcerpt,
  parseCalendarDateMs,
  queryGoogleFactCheckApi,
  retrieveEvidence,
} from "@/lib/pipeline/evidence-retriever";
import type { ClaimExtractionResult } from "@/lib/types";
import {
  getJakartaIsoDate,
  resolveIndonesianRelativeIsoDate,
} from "@/lib/utils";

function makeExtraction(
  overrides: Partial<ClaimExtractionResult> = {}
): ClaimExtractionResult {
  return {
    extractedText: "Program pemerintah akan berjalan dalam dua bulan.",
    extractedHeadline:
      "Program Satu Orang Satu Rekening terealisasi dua bulan lagi",
    graphicOverlayTexts: [],
    extractedCaption: null,
    clarificationOrDebunkText: null,
    primaryClaim:
      "Pemerintah menargetkan Program Satu Orang Satu Rekening berjalan dua bulan lagi bersama Airlangga Hartarto.",
    secondaryClaims: [],
    normalizedClaims: [
      {
        id: "NC-01",
        subject: "Menteri Koordinator Airlangga Hartarto",
        predicateAction: "menargetkan",
        objectTarget: "Program Satu Orang Satu Rekening",
        proposition:
          "Airlangga Hartarto menargetkan Program Satu Orang Satu Rekening berjalan dua bulan lagi",
        eventDate: null,
        legalOrAdministrativeStatus: null,
        sourceRole: "headline",
      },
      {
        id: "NC-02",
        subject: "Badan Komunikasi Pemerintah (Bakom)",
        predicateAction: "mengumumkan",
        objectTarget: "Program Satu Orang Satu Rekening",
        proposition:
          "Bakom mengumumkan Program Satu Orang Satu Rekening",
        eventDate: null,
        legalOrAdministrativeStatus: null,
        sourceRole: "caption",
      },
    ],
    atomicClaims: [],
    topicCategory: "Kebijakan Publik",
    claimDateMentioned: "dua bulan lagi",
    language: "id",
    platform: "Instagram",
    visibleAccountHandle: null,
    visibleAccountName: null,
    visiblePostUrl: null,
    visibleTimestamp: null,
    postStance: "asserting_claim",
    postStanceSummary: "Unggahan menyampaikan target program.",
    containsCheckableClaim: true,
    searchQueries: ["Program Satu Orang Satu Rekening dua bulan lagi"],
    ...overrides,
  };
}

describe("evidence-retriever & P0 strict source trust", () => {
  it("builds diverse topic-neutral searches for exact claims, primary evidence, reporting, contradiction, and time", () => {
    const extraction = makeExtraction({
      primaryClaim:
        "Entitas A menaikkan tarif layanan dari 10 menjadi 12 unit pada periode tertentu.",
      normalizedClaims: [
        {
          id: "NC-01",
          subject: "Entitas A",
          predicateAction: "menaikkan",
          objectTarget: "tarif layanan",
          proposition:
            "Entitas A menaikkan tarif layanan dari 10 menjadi 12 unit.",
          eventDate: "periode tertentu",
          legalOrAdministrativeStatus: null,
          sourceRole: "headline",
          namedEntities: ["Entitas A"],
          numericValues: [
            { value: "10", unit: "unit", context: "tarif sebelumnya" },
            { value: "12", unit: "unit", context: "tarif baru" },
          ],
        },
      ],
    });
    const queries = buildEvidenceSearchQueries(extraction);

    expect(queries).toHaveLength(6);
    expect(queries[0]).toContain("Entitas A menaikkan tarif");
    expect(queries.some((query) => query.includes("primary source"))).toBe(true);
    expect(queries.some((query) => query.includes("independent reporting"))).toBe(
      true
    );
    expect(queries.some((query) => query.includes("disputed denied"))).toBe(true);
    expect(queries.some((query) => query.includes("date timeline"))).toBe(true);
    expect(queries.every((query) => !query.includes("site:"))).toBe(true);
  });

  it("classifies genuine official government, curated fact-checker, and media domains accurately", () => {
    expect(
      classifySourceTier(
        "korlantas.polri.go.id",
        "https://korlantas.polri.go.id/"
      )
    ).toBe("official_government");
    expect(classifySourceTier("who.int", "https://www.who.int/news")).toBe(
      "official_government"
    );
    expect(
      classifySourceTier(
        "turnbackhoax.id",
        "https://turnbackhoax.id/2026/11/sim"
      )
    ).toBe("fact_checker");
    expect(
      classifySourceTier(
        "kompas.com",
        "https://www.kompas.com/cekfakta/read/1"
      )
    ).toBe("fact_checker");
    expect(
      classifySourceTier("detik.com", "https://news.detik.com/berita/d-123")
    ).toBe("credible_media");
  });

  it("never misclassifies deceptive lookalike domains, embedded substrings, or arbitrary /hoaks paths", () => {
    // Substring/prefix/suffix spoofing
    expect(
      classifySourceTier(
        "kominfo.go.id.attacker.com",
        "https://kominfo.go.id.attacker.com/klarifikasi"
      )
    ).toBe("public_source");
    expect(
      classifySourceTier("fake-go.id", "https://fake-go.id/pengumuman")
    ).toBe("public_source");
    expect(classifySourceTier("go.id", "https://go.id/")).toBe("public_source");
    expect(
      classifySourceTier(
        "turnbackhoax.id@evil.com",
        "https://turnbackhoax.id@evil.com/hoaks"
      )
    ).toBe("public_source");
    expect(
      classifySourceTier(
        "xn--kmf-9sa.go.id",
        "https://xn--kmf-9sa.go.id/press"
      )
    ).toBe("public_source");

    // Arbitrary domains with /hoaks or /cek-fakta URL paths must stay public_source
    expect(
      classifySourceTier(
        "scamblog.example.com",
        "https://scamblog.example.com/hoaks/sim-gratis"
      )
    ).toBe("public_source");
    expect(
      classifySourceTier(
        "randomsite.org",
        "https://randomsite.org/cek-fakta/bansos"
      )
    ).toBe("public_source");
    expect(
      classifySourceTier(
        "attacker.org",
        "https://attacker.org/kominfo.go.id/cek-fakta"
      )
    ).toBe("public_source");

    // Mismatched domain parameter vs actual URL host must follow actual URL host
    expect(
      classifySourceTier("kominfo.go.id", "https://evil.example/cek-fakta")
    ).toBe("public_source");

    // UGC subdomains on curated media stay public_source; regular news path stays credible_media
    expect(
      classifySourceTier(
        "forum.detik.com",
        "https://forum.detik.com/cekfakta/thread-1"
      )
    ).toBe("public_source");
    expect(
      classifySourceTier(
        "kompas.com",
        "https://www.kompas.com/nasional/artikel-hoaks-sim"
      )
    ).toBe("credible_media");
  });

  it("deduplicates URLs, drops SSRF private URLs, and prefers concrete excerpts over query placeholders", () => {
    const deduped = deduplicateEvidence([
      {
        id: "1",
        title: "turnbackhoax.id",
        url: "https://turnbackhoax.id/artikel-1?utm_source=ig",
        domain: "turnbackhoax.id",
        publisher: "turnbackhoax.id",
        publishedAt: null,
        snippet: 'Ditemukan dari penelusuran web: "SIM seumur hidup"',
        origin: "openai_web_search",
        sourceTier: "fact_checker",
      },
      {
        id: "2",
        title: "Artikel A Lengkap",
        url: "https://turnbackhoax.id/artikel-1/",
        domain: "turnbackhoax.id",
        publisher: "MAFINDO",
        publishedAt: "2026-11-01",
        snippet: "Penjelasan lengkap fact check resmi",
        origin: "google_fact_check",
        sourceTier: "fact_checker",
      },
      {
        id: "3",
        title: "SSRF Internal",
        url: "http://169.254.169.254/latest/meta-data",
        domain: "169.254.169.254",
        publisher: "Metadata",
        publishedAt: null,
        snippet: "Internal",
        origin: "openai_web_search",
        sourceTier: "public_source",
      },
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].url).toBe("https://turnbackhoax.id/artikel-1");
    expect(deduped[0].origin).toBe("google_fact_check");
    expect(deduped[0].publishedAt).toBe("2026-11-01");
    expect(deduped[0].title).toBe("Artikel A Lengkap");
  });

  it("handles Google Fact Check API HTTP failures gracefully with safe warning", async () => {
    const failingFetch = async () =>
      new Response("Service Unavailable", { status: 503 });

    const res = await queryGoogleFactCheckApi({
      queries: ["SIM seumur hidup"],
      apiKey: "test-key",
      fetchImpl: failingFetch as typeof fetch,
    });

    expect(res.candidates).toEqual([]);
    expect(res.warning).toBeTruthy();
  });

  it("keeps Google review publication dates separate from the date a claim was made", async () => {
    const successfulFetch = async () =>
      new Response(
        JSON.stringify({
          claims: [
            {
              text: "Program akan diluncurkan.",
              claimDate: "2026-11-02",
              claimReview: [
                {
                  publisher: { name: "Fact Checker", site: "facts.example" },
                  url: "https://facts.example/review/program",
                  title: "Pemeriksaan program",
                  reviewDate: "2026-11-05",
                  textualRating: "Benar",
                },
              ],
            },
          ],
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    const result = await queryGoogleFactCheckApi({
      queries: ["program"],
      apiKey: "test-key",
      fetchImpl: successfulFetch as typeof fetch,
    });

    expect(result.candidates[0].publishedAt).toBe("2026-11-05");
    expect(result.candidates[0].publicationDateBasis).toBe("verified");
    expect(result.candidates[0].claimDate).toBe("2026-11-02");
  });

  it("falls back to available web search when no official source is returned", async () => {
    const create = vi.fn().mockResolvedValue({
      output: [
        {
          type: "web_search_call",
          action: {
            sources: [
              {
                url: "https://www.antaranews.com/berita/123",
                title: "Berita terkait program",
              },
            ],
          },
        },
      ],
      output_text: "",
    });
    const client = {
      responses: { create },
    } as unknown as OpenAI;

    const result = await retrieveEvidence({
      client,
      searchModel: "gpt-5.4-mini",
      extraction: makeExtraction(),
    });

    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0].sourceTier).toBe("credible_media");
    expect(result.candidates[0].publishedAt).toBeNull();
    expect(result.warnings.some((warning) => /FACTCHECK_API_KEY/.test(warning))).toBe(
      true
    );
    const request = create.mock.calls[0]?.[0] as { input?: string } | undefined;
    expect(request?.input).toContain("primary source");
    expect(request?.input).toContain("independent reporting");
  });

  it("retries with alternate evidence queries when the first web search returns no candidates", async () => {
    const create = vi
      .fn()
      .mockResolvedValueOnce({ output: [], output_text: "" })
      .mockResolvedValueOnce({
        output: [
          {
            type: "web_search_call",
            action: {
              sources: [
                {
                  url: "https://records.example.org/item/7",
                  title: "Primary record",
                },
              ],
            },
          },
        ],
        output_text: "",
      });
    const client = {
      responses: { create },
    } as unknown as OpenAI;

    const result = await retrieveEvidence({
      client,
      searchModel: "gpt-5.4-mini",
      extraction: makeExtraction(),
      timeoutMs: 8_000,
    });

    expect(create).toHaveBeenCalledTimes(2);
    expect(result.candidates).toHaveLength(1);
    expect(result.warnings.some((warning) => /kueri alternatif/i.test(warning))).toBe(
      true
    );
    const retryRequest = create.mock.calls[1]?.[0] as
      | { input?: string }
      | undefined;
    expect(retryRequest?.input).toContain("disputed denied contradicted");
  });

  it("extracts and parses calendar dates from ISO, URL timestamps, and Indonesian/English date strings", () => {
    expect(
      extractDateFromText(
        "https://www.cnnindonesia.com/nasional/20261110152027-32-123456/gibran-mundur"
      )
    ).toBe("2026-11-10");
    expect(extractDateFromText("Komdigi · 12 Oktober 2026 · Klarifikasi")).toBe(
      "2026-10-12"
    );
    expect(extractDateFromText("AP News · November 4, 2026")).toBe(
      "2026-11-04"
    );
    expect(extractDateFromText("2026-11-09T14:20:00Z")).toBe("2026-11-09");

    const nov10Ms = parseCalendarDateMs("10 November 2026", "2026-11-10");
    const oct12Ms = parseCalendarDateMs("2026-10-12", "2026-11-10");
    expect(nov10Ms).not.toBeNull();
    expect(oct12Ms).not.toBeNull();
    expect((oct12Ms ?? 0) < (nov10Ms ?? 0)).toBe(true);
  });

  it("extracts full preceding sentence before trailing Markdown citations and strips chatty suffix", () => {
    const summaryText =
      "1. [2026-11-03] Polri resmi menetapkan eks Kapolri Listyo Sigit sebagai tersangka kasus dugaan penyadapan Presiden Prabowo. ([news.detik.com](https://news.detik.com/berita/d-8737003)) Kalau Anda mau, saya bisa lanjutkan dengan format tabel.";
    const citeTarget = "([news.detik.com](https://news.detik.com/berita/d-8737003))";
    const startIdx = summaryText.indexOf(citeTarget);
    const endIdx = startIdx + citeTarget.length;

    const excerpt = extractSentenceAwareExcerpt(summaryText, startIdx, endIdx);
    expect(excerpt).toContain("[2026-11-03]");
    expect(excerpt).toContain("Polri resmi menetapkan eks Kapolri Listyo Sigit");
    expect(excerpt).not.toContain("Kalau Anda mau");
    expect(extractDateFromText(excerpt)).toBe("2026-11-03");
  });

  it("resolves Indonesian relative date expressions in Asia/Jakarta (WIB) across UTC midnight boundaries", () => {
    // 18:30Z on Nov 10 UTC === 01:30 WIB on Nov 11 Asia/Jakarta
    const utcEveningWibNextDay = new Date("2026-11-10T18:30:00.000Z");
    expect(getJakartaIsoDate(utcEveningWibNextDay)).toBe("2026-11-11");
    expect(resolveIndonesianRelativeIsoDate("hari ini", utcEveningWibNextDay)).toBe(
      "2026-11-11"
    );
    expect(resolveIndonesianRelativeIsoDate("kemarin", utcEveningWibNextDay)).toBe(
      "2026-11-10"
    );
    expect(resolveIndonesianRelativeIsoDate("besok", utcEveningWibNextDay)).toBe(
      "2026-11-12"
    );
    expect(
      resolveIndonesianRelativeIsoDate("3 hari lalu", utcEveningWibNextDay)
    ).toBe("2026-11-08");

    expect(parseCalendarDateMs("hari ini", undefined, utcEveningWibNextDay)).toBe(
      Date.parse("2026-11-11T00:00:00.000Z")
    );
    expect(parseCalendarDateMs("kemarin", undefined, utcEveningWibNextDay)).toBe(
      Date.parse("2026-11-10T00:00:00.000Z")
    );

    // 16:30Z on Nov 10 UTC === 23:30 WIB on Nov 10 Asia/Jakarta (same day before midnight WIB)
    const utcSameDayWib = new Date("2026-11-10T16:30:00.000Z");
    expect(getJakartaIsoDate(utcSameDayWib)).toBe("2026-11-10");
    expect(resolveIndonesianRelativeIsoDate("hari ini", utcSameDayWib)).toBe(
      "2026-11-10"
    );
    expect(resolveIndonesianRelativeIsoDate("kemarin", utcSameDayWib)).toBe(
      "2026-11-09"
    );
  });
});
