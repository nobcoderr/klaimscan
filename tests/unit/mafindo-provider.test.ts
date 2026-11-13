import { describe, expect, it, vi } from "vitest";
import { mapEvaluationsToVerifiedSources } from "@/lib/pipeline/evidence-comparator";
import { deduplicateEvidence } from "@/lib/pipeline/evidence-retriever";
import {
  describeYudistiraStatus,
  normalizeYudistiraRecord,
  queryMafindoYudistira,
  YUDISTIRA_SEARCH_URL,
} from "@/lib/pipeline/mafindo-provider";
import { computeVerdictFromEvidence } from "@/lib/pipeline/verdict-engine";

const RECORD = {
  id: "88",
  status: "2",
  classification: "Fabricated Content",
  title: "Kapolri berlakukan SIM seumur hidup",
  content: "Kapolri akan memberlakukan SIM seumur hidup.",
  fact: "Korlantas menyatakan masa berlaku SIM tetap lima tahun.",
  references: "https://korlantas.polri.go.id/sim",
  source_issue: "Cek Fakta",
  source_link: "http://127.0.0.1/admin",
  tanggal: "2026-10-14",
  conclusion: "Klaim yang beredar tidak sesuai penjelasan Korlantas.",
};

describe("MAFINDO Yudistira provider", () => {
  it("keeps a stored false status out of the Klaimscan verdict", () => {
    const candidate = normalizeYudistiraRecord(RECORD, 0);
    expect(candidate).not.toBeNull();
    expect(candidate?.origin).toBe("mafindo_yudistira");
    expect(candidate?.url).toBe("https://korlantas.polri.go.id/sim");
    expect(candidate?.ratingText).toContain("bukan verdict Klaimscan");
    expect(describeYudistiraStatus(2)).toContain("bukan verdict Klaimscan");

    const mapped = mapEvaluationsToVerifiedSources({
      candidates: [candidate!],
      primaryClaim: "Kapolri akan memberlakukan SIM seumur hidup",
      evaluations: [],
    });
    expect(mapped.sources[0].relation).toBe("insufficient");

    const verdict = computeVerdictFromEvidence({
      primaryClaim: "Kapolri akan memberlakukan SIM seumur hidup",
      postStance: "asserting_claim",
      postStanceSummary: "Unggahan menyampaikan klaim.",
      sources: mapped.sources,
    });
    expect(verdict.claimVerdict).toBe("UNVERIFIED");
  });

  it("does not let a photo-only archive cancel the textual claim", () => {
    const candidate = normalizeYudistiraRecord(
      {
        ...RECORD,
        title: "Hoaks foto Kapolri",
        content: "Foto Kapolri pada unggahan adalah editan.",
        source_link: "https://turnbackhoax.id/foto-kapolri",
        references: "",
      },
      0
    );
    const mapped = mapEvaluationsToVerifiedSources({
      candidates: [candidate!],
      primaryClaim: "Kapolri akan memberlakukan SIM seumur hidup",
      evaluations: [
        {
          id: candidate!.id,
          addressesSameProposition: true,
          matchesTimeContext: true,
          relation: "contradicting",
          claimEvaluated: "Kapolri akan memberlakukan SIM seumur hidup",
          rationale: "Arsip membahas foto.",
          mentionsOutdatedContext: false,
        },
      ],
    });
    expect(mapped.sources[0].targetAspect).toBe("image_authenticity");
    expect(mapped.sources[0].relation).toBe("irrelevant");
  });

  it("posts the key in the body and skips the call when the key is absent", async () => {
    const fetchImpl = vi.fn(async () =>
      new Response(JSON.stringify([RECORD]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );

    const missing = await queryMafindoYudistira({
      queries: ["SIM seumur hidup"],
      fetchImpl,
    });
    expect(missing.candidates).toEqual([]);
    expect(missing.warning).toMatch(/MAFINDO_API_KEY/);
    expect(fetchImpl).not.toHaveBeenCalled();

    const found = await queryMafindoYudistira({
      queries: ["SIM seumur hidup"],
      apiKey: "secret-yudistira-key",
      fetchImpl,
    });
    expect(found.candidates).toHaveLength(1);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe(YUDISTIRA_SEARCH_URL);
    expect(String(init.body)).toContain("key=secret-yudistira-key");
    expect(String(init.body)).toContain("method=content");
    expect(url).not.toContain("secret-yudistira-key");
  });

  it("collapses two copies of the same fact-check article", () => {
    const first = normalizeYudistiraRecord(RECORD, 0)!;
    const second = {
      ...first,
      id: "copy",
      url: "https://korlantas.polri.go.id/sim?utm_source=share",
      snippet: "pendek",
    };
    const deduped = deduplicateEvidence([first, second], 8);
    expect(deduped).toHaveLength(1);
    expect(deduped[0].snippet.length).toBeGreaterThan(second.snippet.length);
  });
});
