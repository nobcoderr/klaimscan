import OpenAI from "openai";
import type { ClaimExtractionResult, SourceTier } from "@/lib/types";
import { extractDomain, isValidHttpUrl, normalizeUrl } from "@/lib/utils";

export interface CandidateEvidence {
  id: string;
  title: string;
  url: string;
  domain: string;
  publisher: string;
  publishedAt: string | null;
  snippet: string;
  origin: "google_fact_check" | "openai_web_search";
  sourceTier: SourceTier;
  ratingText?: string | null;
}

const OFFICIAL_DOMAIN_HINTS = [
  ".go.id",
  ".gov",
  ".mil.id",
  ".ac.id",
  "kominfo.go.id",
  "komdigi.go.id",
  "polri.go.id",
  "korlantas.polri.go.id",
  "kemkes.go.id",
  "bi.go.id",
  "ojk.go.id",
  "bmkg.go.id",
  "bkn.go.id",
  "bpom.go.id",
  "kemensos.go.id",
  "who.int",
  "un.org",
];

const FACT_CHECK_DOMAIN_HINTS = [
  "turnbackhoax.id",
  "cekfakta.com",
  "mafindo.or.id",
  "cekfakta.tempo.co",
  "kompas.com",
  "liputan6.com",
  "antaranews.com",
  "tempo.co",
  "detik.com",
  "reuters.com",
  "afp.com",
  "apnews.com",
  "snopes.com",
  "politifact.com",
  "factcheck.org",
  "fullfact.org",
];

const CREDIBLE_MEDIA_HINTS = [
  "kompas.id",
  "cnbcindonesia.com",
  "cnnindonesia.com",
  "bbc.com",
  "bbc.co.uk",
  "tirto.id",
  "bisnis.com",
  "katadata.co.id",
  "republika.co.id",
  "theguardian.com",
];

export function classifySourceTier(domain: string, url: string): SourceTier {
  const lowerDomain = domain.toLowerCase();
  const lowerUrl = url.toLowerCase();

  if (
    OFFICIAL_DOMAIN_HINTS.some(
      (hint) => lowerDomain.endsWith(hint) || lowerDomain.includes(hint)
    )
  ) {
    return "official_government";
  }

  if (
    lowerUrl.includes("cek-fakta") ||
    lowerUrl.includes("cekfakta") ||
    lowerUrl.includes("fact-check") ||
    lowerUrl.includes("hoaks") ||
    lowerDomain.includes("turnbackhoax") ||
    lowerDomain.includes("cekfakta") ||
    FACT_CHECK_DOMAIN_HINTS.some((hint) => lowerDomain.includes(hint))
  ) {
    return "fact_checker";
  }

  if (CREDIBLE_MEDIA_HINTS.some((hint) => lowerDomain.includes(hint))) {
    return "credible_media";
  }

  return "public_source";
}

interface GoogleFactCheckApiResponse {
  claims?: Array<{
    text?: string;
    claimant?: string;
    claimDate?: string;
    claimReview?: Array<{
      publisher?: {
        name?: string;
        site?: string;
      };
      url?: string;
      title?: string;
      reviewDate?: string;
      textualRating?: string;
      languageCode?: string;
    }>;
  }>;
}

export async function queryGoogleFactCheckApi(params: {
  queries: string[];
  apiKey?: string;
}): Promise<{ candidates: CandidateEvidence[]; warning?: string }> {
  const { queries, apiKey } = params;
  if (!apiKey) {
    return {
      candidates: [],
      warning:
        "FACTCHECK_API_KEY belum aktif; penelusuran dialihkan ke web_search.",
    };
  }

  const collected: CandidateEvidence[] = [];

  for (const query of queries.slice(0, 2)) {
    const endpoint = new URL(
      "https://factchecktools.googleapis.com/v1alpha1/claims:search"
    );
    endpoint.searchParams.set("query", query);
    endpoint.searchParams.set("pageSize", "6");
    endpoint.searchParams.set("key", apiKey);

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(endpoint.toString(), {
        method: "GET",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      clearTimeout(timeout);

      if (!res.ok) {
        continue;
      }

      const data = (await res.json()) as GoogleFactCheckApiResponse;
      for (const claim of data.claims ?? []) {
        for (const review of claim.claimReview ?? []) {
          if (!isValidHttpUrl(review.url)) continue;
          const url = normalizeUrl(review.url!);
          const domain = extractDomain(url);
          const publisherName =
            review.publisher?.name || review.publisher?.site || domain;
          collected.push({
            id: `fc-${collected.length + 1}`,
            title: review.title || claim.text || `Fact Check (${publisherName})`,
            url,
            domain,
            publisher: publisherName,
            publishedAt: review.reviewDate || claim.claimDate || null,
            snippet: [
              claim.text ? `Klaim diperiksa: ${claim.text}` : null,
              review.textualRating
                ? `Penilaian penerbit: ${review.textualRating}`
                : null,
            ]
              .filter(Boolean)
              .join(" · "),
            origin: "google_fact_check",
            sourceTier: classifySourceTier(domain, url),
            ratingText: review.textualRating ?? null,
          });
        }
      }
    } catch {
      // Non-fatal: web_search still runs
    }
  }

  return { candidates: collected };
}

interface WebSearchSourceEntry {
  url?: string;
  title?: string;
}

export async function queryOpenAiWebSearch(params: {
  client: OpenAI;
  model: string;
  extraction: ClaimExtractionResult;
}): Promise<{ candidates: CandidateEvidence[]; searchSummary: string }> {
  const { client, model, extraction } = params;

  const queryBlock = [
    `Klaim utama untuk diverifikasi: "${extraction.primaryClaim}"`,
    `Kueri referensi: ${extraction.searchQueries.join(" | ")}`,
    extraction.claimDateMentioned
      ? `Tanggal/konteks yang disebut dalam klaim: ${extraction.claimDateMentioned}`
      : null,
    "Tugas: Cari klarifikasi resmi lembaga terkait, siaran pers pemerintah (.go.id / instansi resmi), atau artikel pemeriksa fakta dan media kredibel yang membahas klaim tersebut. Jangan mengarang URL.",
  ]
    .filter(Boolean)
    .join("\n");

  const response = await client.responses.create({
    model,
    input: queryBlock,
    tools: [
      {
        type: "web_search",
      },
    ],
    include: ["web_search_call.action.sources"],
  });

  const candidates: CandidateEvidence[] = [];
  const rawOutputs = (response.output ?? []) as unknown as Array<
    Record<string, unknown>
  >;

  for (const item of rawOutputs) {
    if (item.type === "web_search_call") {
      const action = item.action as
        | { sources?: WebSearchSourceEntry[]; query?: string }
        | undefined;
      for (const src of action?.sources ?? []) {
        if (!isValidHttpUrl(src.url)) continue;
        const url = normalizeUrl(src.url!);
        const domain = extractDomain(url);
        candidates.push({
          id: `ws-${candidates.length + 1}`,
          title: src.title || domain,
          url,
          domain,
          publisher: domain,
          publishedAt: null,
          snippet:
            action?.query
              ? `Ditemukan dari penelusuran web: "${action.query}"`
              : "Ditemukan melalui penelusuran web langsung.",
          origin: "openai_web_search",
          sourceTier: classifySourceTier(domain, url),
          ratingText: null,
        });
      }
    }

    if (item.type === "message" && Array.isArray(item.content)) {
      for (const part of item.content as Array<Record<string, unknown>>) {
        const partText = typeof part.text === "string" ? part.text : "";
        const annotations = Array.isArray(part.annotations)
          ? (part.annotations as Array<Record<string, unknown>>)
          : [];

        for (const ann of annotations) {
          if (ann.type === "url_citation" && isValidHttpUrl(String(ann.url ?? ""))) {
            const url = normalizeUrl(String(ann.url));
            const domain = extractDomain(url);
            const title =
              typeof ann.title === "string" && ann.title.trim()
                ? ann.title.trim()
                : domain;
            const startIdx =
              typeof ann.start_index === "number" ? Math.max(0, ann.start_index - 120) : 0;
            const endIdx =
              typeof ann.end_index === "number"
                ? Math.min(partText.length, ann.end_index + 160)
                : Math.min(partText.length, 240);
            const contextSnippet = partText
              .slice(startIdx, endIdx)
              .replace(/\s+/g, " ")
              .trim();

            candidates.push({
              id: `cite-${candidates.length + 1}`,
              title,
              url,
              domain,
              publisher: domain,
              publishedAt: null,
              snippet: contextSnippet || "Sumber dikutip oleh mesin penelusuran.",
              origin: "openai_web_search",
              sourceTier: classifySourceTier(domain, url),
              ratingText: null,
            });
          }
        }
      }
    }
  }

  return {
    candidates,
    searchSummary: response.output_text || "",
  };
}

export function deduplicateEvidence(
  list: CandidateEvidence[]
): CandidateEvidence[] {
  const byUrl = new Map<string, CandidateEvidence>();

  for (const item of list) {
    if (!isValidHttpUrl(item.url)) continue;
    const key = normalizeUrl(item.url);
    const existing = byUrl.get(key);
    if (!existing) {
      byUrl.set(key, { ...item, url: key });
      continue;
    }

    // Prefer Google Fact Check or richer snippet/title when merging duplicates
    const preferIncoming =
      (item.origin === "google_fact_check" &&
        existing.origin !== "google_fact_check") ||
      item.snippet.length > existing.snippet.length;

    if (preferIncoming) {
      byUrl.set(key, {
        ...existing,
        ...item,
        url: key,
        ratingText: item.ratingText || existing.ratingText,
        publishedAt: item.publishedAt || existing.publishedAt,
      });
    }
  }

  return Array.from(byUrl.values()).slice(0, 12);
}

export async function retrieveEvidence(params: {
  client: OpenAI;
  searchModel: string;
  factCheckApiKey?: string;
  extraction: ClaimExtractionResult;
}): Promise<{
  candidates: CandidateEvidence[];
  searchSummary: string;
  warnings: string[];
}> {
  const { client, searchModel, factCheckApiKey, extraction } = params;
  const warnings: string[] = [];

  const [factCheckRes, webSearchRes] = await Promise.allSettled([
    queryGoogleFactCheckApi({
      queries: extraction.searchQueries,
      apiKey: factCheckApiKey,
    }),
    queryOpenAiWebSearch({
      client,
      model: searchModel,
      extraction,
    }),
  ]);

  const combined: CandidateEvidence[] = [];
  let searchSummary = "";

  if (factCheckRes.status === "fulfilled") {
    combined.push(...factCheckRes.value.candidates);
    if (factCheckRes.value.warning) {
      warnings.push(factCheckRes.value.warning);
    }
  } else {
    warnings.push("Google Fact Check API gagal diakses; menggunakan hasil web_search.");
  }

  if (webSearchRes.status === "fulfilled") {
    combined.push(...webSearchRes.value.candidates);
    searchSummary = webSearchRes.value.searchSummary;
  } else {
    warnings.push(
      `Penelusuran web_search gagal: ${
        webSearchRes.reason instanceof Error
          ? webSearchRes.reason.message
          : "kesalahan tidak diketahui"
      }`
    );
  }

  const deduped = deduplicateEvidence(combined).map((item, idx) => ({
    ...item,
    id: `SRC-${String(idx + 1).padStart(2, "0")}`,
  }));

  return {
    candidates: deduped,
    searchSummary,
    warnings,
  };
}
