import { describe, expect, it } from "vitest";
import {
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
    snippet: "SIM tetap berlaku 5 tahun.",
    origin: "google_fact_check",
    sourceTier: "official_government",
    ratingText: "Salah",
  },
];

describe("evidence-comparator anti-hallucination & mapping", () => {
  it("maps fact-check textual ratings reliably", () => {
    expect(inferRelationFromRatingText("Salah / Hoaks")).toBe("contradicting");
    expect(inferRelationFromRatingText("Menyesatkan")).toBe("partial_context");
    expect(inferRelationFromRatingText("Benar")).toBe("supporting");
    expect(inferRelationFromRatingText("Tidak diketahui")).toBeNull();
  });

  it("ignores fabricated evaluation IDs not present in retrieved candidates", () => {
    const output = mapEvaluationsToVerifiedSources({
      candidates: SAMPLE_CANDIDATES,
      primaryClaim: "SIM berlaku seumur hidup",
      evaluations: [
        {
          id: "INVENTED-99",
          relation: "supporting",
          claimEvaluated: "Fake",
          rationale: "Hallucinated source",
          mentionsOutdatedContext: false,
        },
        {
          id: "SRC-01",
          relation: "supporting", // ratingText "Salah" overrides toward contradicting
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
});
