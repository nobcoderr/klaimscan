import { isIP } from "node:net";

const TRACKING_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
  "fbclid",
  "gclid",
  "igsh",
];

function isPrivateOrReservedIpv4(ip: string): boolean {
  const parts = ip.split(".").map((p) => Number.parseInt(p, 10));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n) || n < 0 || n > 255)) {
    return true;
  }

  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127) return true;
  if (a === 169 && b === 254) return true; // Link-local & cloud metadata 169.254.169.254
  if (a === 172 && b >= 16 && b <= 31) return true;
  if (a === 192 && b === 168) return true;
  if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT
  if (a >= 224) return true; // Multicast & reserved
  return false;
}

function isPrivateOrReservedIpv6(ip: string): boolean {
  const normalized = ip.toLowerCase().replace(/^\[|\]$/g, "");
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // Unique local
  if (normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) {
    return true; // Link-local fe80::/10
  }
  if (normalized.startsWith("::ffff:")) {
    const mappedV4 = normalized.slice("::ffff:".length);
    if (isIP(mappedV4) === 4) {
      return isPrivateOrReservedIpv4(mappedV4);
    }
  }
  return false;
}

export function isPrivateOrInternalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host) return true;

  if (
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host.endsWith(".home.arpa")
  ) {
    return true;
  }

  const ipVersion = isIP(host);
  if (ipVersion === 4) {
    return isPrivateOrReservedIpv4(host);
  }
  if (ipVersion === 6) {
    return isPrivateOrReservedIpv6(host);
  }

  // Require at least one dot in public DNS hostnames
  if (!host.includes(".")) {
    return true;
  }

  return false;
}

export function sanitizePublicEvidenceUrl(rawUrl: string | null | undefined): string | null {
  if (!rawUrl || typeof rawUrl !== "string") return null;
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 2048) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    return null;
  }

  // Block embedded credentials (user:pass@host)
  if (parsed.username || parsed.password) {
    return null;
  }

  if (isPrivateOrInternalHostname(parsed.hostname)) {
    return null;
  }

  parsed.hash = "";
  for (const param of TRACKING_PARAMS) {
    parsed.searchParams.delete(param);
  }

  return parsed.toString().replace(/\/$/, "");
}
