import { describe, expect, it } from "vitest";
import {
  classifySourceTier,
  deduplicateEvidence,
} from "@/lib/pipeline/evidence-retriever";

describe("evidence-retriever helpers", () => {
  it("classifies government and fact-check domains accurately", () => {
    expect(
      classifySourceTier("korlantas.polri.go.id", "https://korlantas.polri.go.id/")
    ).toBe("official_government");
    expect(
      classifySourceTier("turnbackhoax.id", "https://turnbackhoax.id/2026/11/sim")
    ).toBe("fact_checker");
    expect(
      classifySourceTier("kompas.com", "https://www.kompas.com/cekfakta/read/1")
    ).toBe("fact_checker");
  });

  it("deduplicates URLs after removing UTM tracking parameters and drops invalid URLs", () => {
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
        title: "Invalid",
        url: "javascript:alert(1)",
        domain: "invalid",
        publisher: "Bad",
        publishedAt: null,
        snippet: "Bad",
        origin: "openai_web_search",
        sourceTier: "public_source",
      },
    ]);

    expect(deduped).toHaveLength(1);
    expect(deduped[0].url).toBe("https://turnbackhoax.id/artikel-1");
    expect(deduped[0].origin).toBe("google_fact_check");
  });
});
