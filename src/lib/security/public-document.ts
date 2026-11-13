import { lookup } from "node:dns/promises";
import { isPrivateOrInternalHostname, sanitizePublicEvidenceUrl } from "@/lib/security/url-guard";

const MAX_BYTES = 256_000;
const MAX_REDIRECTS = 3;
const ALLOWED_TYPES = ["text/html", "text/plain", "application/xhtml+xml"];

export type PublicLookup = (
  hostname: string
) => Promise<Array<{ address: string }>>;

async function assertPublicHost(
  url: string,
  lookupImpl: PublicLookup
): Promise<string> {
  const safe = sanitizePublicEvidenceUrl(url);
  if (!safe) {
    throw new Error("URL bukti tidak lolos pemeriksaan alamat publik.");
  }
  const hostname = new URL(safe).hostname;
  const records = await lookupImpl(hostname);
  if (records.length === 0) {
    throw new Error("Nama host bukti tidak memiliki alamat.");
  }
  for (const record of records) {
    if (isPrivateOrInternalHostname(record.address)) {
      throw new Error("Alamat bukti mengarah ke jaringan internal.");
    }
  }
  return safe;
}

function htmlToText(raw: string): string {
  return raw
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export async function fetchPublicTextExcerpt(params: {
  url: string;
  timeoutMs: number;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
  lookupImpl?: PublicLookup;
}): Promise<string | null> {
  const {
    url,
    timeoutMs,
    signal: parentSignal,
    fetchImpl = fetch,
    lookupImpl = async (hostname) => lookup(hostname, { all: true, verbatim: true }),
  } = params;

  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    Math.max(500, timeoutMs)
  );
  const onParentAbort = () => controller.abort();
  parentSignal?.addEventListener("abort", onParentAbort, { once: true });

  try {
    let current = url;
    for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
      current = await assertPublicHost(current, lookupImpl);
      const response = await fetchImpl(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: { Accept: "text/html, text/plain;q=0.9" },
      });

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location || hop === MAX_REDIRECTS) return null;
        current = new URL(location, current).toString();
        continue;
      }

      if (!response.ok) return null;
      const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
      if (!ALLOWED_TYPES.some((type) => contentType.startsWith(type))) return null;
      const declaredLength = Number(response.headers.get("content-length") ?? "0");
      if (Number.isFinite(declaredLength) && declaredLength > MAX_BYTES) return null;

      const reader = response.body?.getReader();
      if (!reader) return null;
      const chunks: Uint8Array[] = [];
      let total = 0;
      while (true) {
        const step = await reader.read();
        if (step.done) break;
        total += step.value.byteLength;
        if (total > MAX_BYTES) {
          await reader.cancel();
          return null;
        }
        chunks.push(step.value);
      }
      const merged = new Uint8Array(total);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.byteLength;
      }
      const text = htmlToText(new TextDecoder().decode(merged));
      return text.length >= 80 ? text.slice(0, 900) : null;
    }
    return null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener("abort", onParentAbort);
  }
}
