import { sanitizePublicEvidenceUrl } from "@/lib/security/url-guard";
import { extractDomain } from "@/lib/utils";
import { sanitizeUntrustedText } from "./claim-extractor";
import {
  classifySourceTier,
  extractDateFromText,
  type CandidateEvidence,
} from "./evidence-retriever";

export const YUDISTIRA_SEARCH_URL =
  "https://yudistira.turnbackhoax.id/api/antihoax/search/";

const FACT_CHECK_HOSTS = [
  "turnbackhoax.id",
  "cekfakta.com",
  "mafindo.or.id",
  "cekfakta.tempo.co",
];

interface YudistiraRecord {
  id?: unknown;
  status?: unknown;
  classification?: unknown;
  title?: unknown;
  content?: unknown;
  fact?: unknown;
  references?: unknown;
  source_issue?: unknown;
  source_link?: unknown;
  tanggal?: unknown;
  conclusion?: unknown;
}

function asRecord(value: unknown): YudistiraRecord | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as YudistiraRecord;
}

export function extractYudistiraItems(payload: unknown): YudistiraRecord[] {
  if (Array.isArray(payload)) {
    return payload.map(asRecord).filter((item): item is YudistiraRecord => item !== null);
  }
  if (!payload || typeof payload !== "object") return [];
  const record = payload as Record<string, unknown>;
  for (const key of ["data", "result", "results", "news"]) {
    const value = record[key];
    if (Array.isArray(value)) {
      return value.map(asRecord).filter((item): item is YudistiraRecord => item !== null);
    }
  }
  return [];
}

export function describeYudistiraStatus(status: unknown): string | null {
  const value = typeof status === "string" || typeof status === "number"
    ? String(status).trim()
    : "";
  if (!value) return null;
  if (value === "1") {
    return "Status Yudistira 1: basis data menulisnya sebagai benar. Ini bukan verdict Klaimscan.";
  }
  if (value === "2") {
    return "Status Yudistira 2: basis data menulisnya sebagai palsu. Ini bukan verdict Klaimscan.";
  }
  return `Status Yudistira ${sanitizeUntrustedText(value, 40)} tercatat, tetapi bukan verdict Klaimscan.`;
}

function textOf(value: unknown, max: number): string {
  if (typeof value !== "string" && typeof value !== "number") return "";
  return sanitizeUntrustedText(String(value), max);
}

export function extractReferenceUrls(raw: unknown): string[] {
  if (typeof raw !== "string") return [];
  const matches = raw.match(/https?:\/\/[^\s,<>"')]+/g) ?? [];
  const urls: string[] = [];
  for (const match of matches) {
    const safe = sanitizePublicEvidenceUrl(match.replace(/[.,;]+$/, ""));
    if (safe && !urls.includes(safe)) urls.push(safe);
  }
  return urls;
}

function prefersFactCheckHost(url: string): boolean {
  const host = extractDomain(url);
  return FACT_CHECK_HOSTS.some(
    (domain) => host === domain || host.endsWith(`.${domain}`)
  );
}

function chooseEvidenceUrl(record: YudistiraRecord): {
  url: string;
  references: string[];
} | null {
  const references = extractReferenceUrls(record.references);
  const source = sanitizePublicEvidenceUrl(
    typeof record.source_link === "string" ? record.source_link : null
  );
  const pool = [...references, ...(source ? [source] : [])];
  const url = pool.find(prefersFactCheckHost) ?? pool[0];
  if (!url) return null;
  return { url, references: pool.filter((item) => item !== url).slice(0, 3) };
}

export function normalizeYudistiraRecord(
  record: YudistiraRecord,
  index: number
): CandidateEvidence | null {
  const chosen = chooseEvidenceUrl(record);
  if (!chosen) return null;

  const claim = textOf(record.content, 280);
  const fact = textOf(record.fact, 500);
  const conclusion = textOf(record.conclusion, 320);
  const classification = textOf(record.classification, 80);
  const statusNote = describeYudistiraStatus(record.status);
  const publishedAt = extractDateFromText(textOf(record.tanggal, 40));
  const publisherName = textOf(record.source_issue, 80) || "MAFINDO Yudistira";
  const domain = extractDomain(chosen.url);

  const snippet = [
    claim ? `Klaim yang tersimpan: ${claim}` : null,
    fact ? `Uraian fakta: ${fact}` : null,
    conclusion ? `Kesimpulan arsip: ${conclusion}` : null,
    classification ? `Klasifikasi arsip: ${classification}` : null,
    statusNote,
    chosen.references.length > 0
      ? `Rujukan: ${chosen.references.join(" ")}`
      : null,
    "Label arsip tidak menetapkan TRUE, FALSE, MISLEADING, OUTDATED, atau UNVERIFIED.",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    id: `mafindo-${textOf(record.id, 40) || index + 1}`,
    title: textOf(record.title, 180) || `Arsip Yudistira (${publisherName})`,
    url: chosen.url,
    domain,
    publisher: publisherName,
    publishedAt,
    publicationDateBasis: publishedAt ? "reported" : "unknown",
    claimDate: null,
    snippet: snippet || "Arsip Yudistira tidak memuat uraian fakta yang cukup.",
    claimedText: claim || null,
    origin: "mafindo_yudistira",
    sourceTier: prefersFactCheckHost(chosen.url)
      ? "fact_checker"
      : classifySourceTier(domain, chosen.url),
    ratingText: [classification, statusNote].filter(Boolean).join(" · ") || null,
    evidenceNature: "fact_check",
    independence: "unknown",
    excerptBasis: "fact_check_api_metadata",
  };
}

export async function queryMafindoYudistira(params: {
  queries: string[];
  apiKey?: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<{ candidates: CandidateEvidence[]; warning?: string }> {
  const { queries, apiKey, fetchImpl = fetch, timeoutMs = 6_000, signal } = params;
  if (!apiKey) {
    return {
      candidates: [],
      warning:
        "MAFINDO_API_KEY belum aktif; pencarian Yudistira dilewati. Google Fact Check dan web_search tetap berjalan.",
    };
  }

  const query = queries.map((item) => item.trim()).find(Boolean);
  if (!query) return { candidates: [] };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Math.max(500, timeoutMs));
  const onParentAbort = () => controller.abort();
  signal?.addEventListener("abort", onParentAbort, { once: true });

  const body = new URLSearchParams();
  body.set("key", apiKey);
  body.set("method", "content");
  body.set("value", query.slice(0, 180));
  body.set("limit", "4");

  try {
    const response = await fetchImpl(YUDISTIRA_SEARCH_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body,
    });
    if (!response.ok) {
      return {
        candidates: [],
        warning:
          "MAFINDO Yudistira tidak merespons; penelusuran Google Fact Check dan web tetap dilanjutkan.",
      };
    }
    const payload = (await response.json()) as unknown;
    const candidates = extractYudistiraItems(payload)
      .map((item, index) => normalizeYudistiraRecord(item, index))
      .filter((item): item is CandidateEvidence => item !== null)
      .slice(0, 4);
    return { candidates };
  } catch {
    return {
      candidates: [],
      warning:
        "MAFINDO Yudistira tidak merespons; penelusuran Google Fact Check dan web tetap dilanjutkan.",
    };
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener("abort", onParentAbort);
  }
}
