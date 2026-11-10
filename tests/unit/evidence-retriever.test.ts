import { describe, expect, it } from "vitest";
import {
  classifySourceTier,
  deduplicateEvidence,
  queryGoogleFactCheckApi,
} from "@/lib/pipeline/evidence-retriever";

describe("evidence-retriever & Fact Check API integration", () => {
  it("classifies government and fact-check domains accurately", () => {
    expect(
      classifySourceTier(
        "korlantas.polri.go.id",
        "https://korlantas.polri.go.id/"
      )
    ).toBe("official_government");
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
  });

  it("deduplicates URLs, drops SSRF private URLs, and prefers richer fact-check sources", () => {
    const deduped = deduplicateEvidence([
      {
        id: "1",
        title: "Artikel A",
        url: "https://turnbackhoax.id/artikel-1?utm_source=ig",
        domain: "turnbackhoax.id",
        publisher: "TurnBackHoax",
        publishedAt: null,
        snippet: "Pendek",
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
  });

  it("handles Google Fact Check API HTTP failures gracefully with warning", async () => {
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
});
