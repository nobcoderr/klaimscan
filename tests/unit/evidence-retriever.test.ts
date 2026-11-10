import { describe, expect, it } from "vitest";
import {
  classifySourceTier,
  deduplicateEvidence,
  extractDateFromText,
  extractSentenceAwareExcerpt,
  parseCalendarDateMs,
  queryGoogleFactCheckApi,
} from "@/lib/pipeline/evidence-retriever";
import {
  getJakartaIsoDate,
  resolveIndonesianRelativeIsoDate,
} from "@/lib/utils";

describe("evidence-retriever & P0 strict source trust", () => {
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
