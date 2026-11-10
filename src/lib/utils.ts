import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isValidHttpUrl(value: string | undefined | null): boolean {
  if (!value) return false;
  try {
    const url = new URL(value.trim());
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

export function normalizeUrl(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl.trim());
    parsed.hash = "";
    const trackingParams = [
      "utm_source",
      "utm_medium",
      "utm_campaign",
      "utm_term",
      "utm_content",
      "fbclid",
      "gclid",
      "igsh",
    ];
    for (const param of trackingParams) {
      parsed.searchParams.delete(param);
    }
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return rawUrl.trim();
  }
}

export function extractDomain(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "unknown";
  }
}

export const JAKARTA_TIMEZONE = "Asia/Jakarta" as const;

export function getJakartaIsoDate(
  now: Date | string | number = new Date()
): string {
  const date = now instanceof Date ? now : new Date(now);
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: JAKARTA_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(safeDate);

  const year = parts.find((p) => p.type === "year")?.value ?? "1970";
  const month = parts.find((p) => p.type === "month")?.value ?? "01";
  const day = parts.find((p) => p.type === "day")?.value ?? "01";
  return `${year}-${month}-${day}`;
}

export function shiftIsoCalendarDate(
  isoDate: string,
  deltaDays: number
): string {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return isoDate;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const shiftedMs = Date.UTC(year, month - 1, day) + deltaDays * 86_400_000;
  return new Date(shiftedMs).toISOString().slice(0, 10);
}

export function resolveIndonesianRelativeIsoDate(
  rawText: string,
  referenceNow: Date | string | number = new Date(),
  referenceIsoOverride?: string
): string | null {
  const trimmed = rawText.trim().toLowerCase();
  if (!trimmed) return null;

  const baseIso =
    referenceIsoOverride && /^\d{4}-\d{2}-\d{2}$/.test(referenceIsoOverride)
      ? referenceIsoOverride
      : getJakartaIsoDate(referenceNow);

  const daysAgoMatch = trimmed.match(/\b(\d{1,3})\s+(?:hari\s+lalu|days?\s+ago)\b/);
  if (daysAgoMatch) {
    const days = Number.parseInt(daysAgoMatch[1], 10);
    if (Number.isFinite(days) && days >= 0 && days <= 365) {
      return shiftIsoCalendarDate(baseIso, -days);
    }
  }

  if (/\b(kemarin|yesterday)\b/.test(trimmed)) {
    return shiftIsoCalendarDate(baseIso, -1);
  }

  if (/\b(besok|tomorrow|lusa)\b/.test(trimmed)) {
    const offset = /\blusa\b/.test(trimmed) ? 2 : 1;
    return shiftIsoCalendarDate(baseIso, offset);
  }

  if (
    /\b(hari\s+ini|today|sekarang|saat\s+ini)\b/.test(trimmed) ||
    /\b\d+\s*(?:jam|menit|detik|hours?|minutes?)\s+(?:lalu|ago)\b/.test(trimmed)
  ) {
    return baseIso;
  }

  return null;
}

export function formatWibTimestamp(isoString: string): string {
  try {
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return isoString;
    return (
      new Intl.DateTimeFormat("id-ID", {
        dateStyle: "medium",
        timeStyle: "short",
        timeZone: JAKARTA_TIMEZONE,
      }).format(date) + " WIB"
    );
  } catch {
    return isoString;
  }
}
