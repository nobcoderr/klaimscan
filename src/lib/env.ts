import fs from "node:fs";
import path from "node:path";
import type { ServerConfigStatus } from "./types";

const DEFAULT_MODEL = "gpt-5.4-mini";

export type TrustedProxyMode =
  | "none"
  | "vercel"
  | "cloudflare"
  | "forwarded-rightmost";

const PLACEHOLDER_PATTERNS = [
  /^isi_/i,
  /^nama_model_/i,
  /^your_/i,
  /^replace_/i,
  /^changeme/i,
];

function isPlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  const trimmed = value.trim();
  if (!trimmed) return true;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function readFallbackEnvFile(): Record<string, string> {
  const result: Record<string, string> = {};
  const candidates = [".env.local", "env.local"];

  for (const filename of candidates) {
    const filePath = path.join(process.cwd(), filename);
    try {
      if (!fs.existsSync(filePath)) continue;
      const raw = fs.readFileSync(filePath, "utf8");
      for (const line of raw.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith("#")) continue;
        const eqIdx = trimmed.indexOf("=");
        if (eqIdx <= 0) continue;
        const key = trimmed.slice(0, eqIdx).trim();
        let val = trimmed.slice(eqIdx + 1).trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        if (!(key in result) || !result[key]) {
          result[key] = val;
        }
      }
    } catch {
      // Ignore unreadable env files safely
    }
  }

  return result;
}

function resolveEnvValue(key: string): string | undefined {
  const fromProcess = process.env[key]?.trim();
  if (fromProcess && !isPlaceholder(fromProcess)) {
    return fromProcess;
  }

  const fileVars = readFallbackEnvFile();
  const fromFile = fileVars[key]?.trim();
  if (fromFile && !isPlaceholder(fromFile)) {
    return fromFile;
  }

  return undefined;
}

function resolveIntEnv(
  key: string,
  fallback: number,
  min: number,
  max: number
): number {
  const raw = resolveEnvValue(key);
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function resolveBooleanEnv(key: string, fallback: boolean): boolean {
  const raw = resolveEnvValue(key);
  if (!raw) return fallback;
  const normalized = raw.toLowerCase();
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  return fallback;
}

export function parseTrustedProxyMode(raw?: string): TrustedProxyMode {
  const normalized = raw?.trim().toLowerCase();
  if (
    normalized === "vercel" ||
    normalized === "cloudflare" ||
    normalized === "forwarded-rightmost" ||
    normalized === "none"
  ) {
    return normalized;
  }
  if (process.env.VERCEL === "1") {
    return "vercel";
  }
  return "none";
}

export interface ServerEnvConfig {
  openAiApiKey: string | undefined;
  factCheckApiKey: string | undefined;
  visionModel: string;
  searchModel: string;
  usingFallbackVisionModel: boolean;
  usingFallbackSearchModel: boolean;
  publicAnalyzeEnabled: boolean;
  analyzeAccessToken?: string;
  rateLimitMaxRequests: number;
  rateLimitWindowMs: number;
  globalHourlyLimit: number;
  maxConcurrentAnalyses: number;
  pipelineDeadlineMs: number;
  trustedProxyMode: TrustedProxyMode;
  upstashRedisRestUrl?: string;
  upstashRedisRestToken?: string;
  requireDistributedQuota: boolean;
}

export function getServerEnvConfig(): ServerEnvConfig {
  const openAiApiKey = resolveEnvValue("OPENAI_API_KEY");
  const factCheckApiKey = resolveEnvValue("FACTCHECK_API_KEY");

  const rawVisionModel = resolveEnvValue("OPENAI_VISION_MODEL");
  const rawSearchModel = resolveEnvValue("OPENAI_SEARCH_MODEL");

  const visionModel = rawVisionModel || DEFAULT_MODEL;
  const searchModel = rawSearchModel || DEFAULT_MODEL;

  const upstashRedisRestUrl = resolveEnvValue("UPSTASH_REDIS_REST_URL");
  const upstashRedisRestToken = resolveEnvValue("UPSTASH_REDIS_REST_TOKEN");
  const requireDistributedQuota = resolveBooleanEnv(
    "ANALYZE_REQUIRE_DISTRIBUTED_QUOTA",
    process.env.VERCEL === "1"
  );

  return {
    openAiApiKey,
    factCheckApiKey,
    visionModel,
    searchModel,
    usingFallbackVisionModel: !rawVisionModel,
    usingFallbackSearchModel: !rawSearchModel,
    publicAnalyzeEnabled: resolveBooleanEnv(
      "ANALYZE_PUBLIC_ACCESS_ENABLED",
      true
    ),
    analyzeAccessToken: resolveEnvValue("ANALYZE_ACCESS_TOKEN"),
    rateLimitMaxRequests: resolveIntEnv("ANALYZE_RATE_LIMIT_MAX", 12, 1, 120),
    rateLimitWindowMs: resolveIntEnv(
      "ANALYZE_RATE_LIMIT_WINDOW_MS",
      60_000,
      1_000,
      3_600_000
    ),
    globalHourlyLimit: resolveIntEnv(
      "ANALYZE_GLOBAL_HOURLY_LIMIT",
      60,
      1,
      10_000
    ),
    maxConcurrentAnalyses: resolveIntEnv("ANALYZE_MAX_CONCURRENT", 4, 1, 32),
    pipelineDeadlineMs: resolveIntEnv(
      "ANALYZE_PIPELINE_DEADLINE_MS",
      48_000,
      10_000,
      55_000
    ),
    trustedProxyMode: parseTrustedProxyMode(
      resolveEnvValue("TRUSTED_PROXY_MODE")
    ),
    upstashRedisRestUrl,
    upstashRedisRestToken,
    requireDistributedQuota,
  };
}

export function getServerConfigStatus(): ServerConfigStatus {
  const cfg = getServerEnvConfig();
  return {
    openAiConfigured: Boolean(cfg.openAiApiKey),
    factCheckConfigured: Boolean(cfg.factCheckApiKey),
    visionModel: cfg.visionModel,
    searchModel: cfg.searchModel,
    usingFallbackVisionModel: cfg.usingFallbackVisionModel,
    usingFallbackSearchModel: cfg.usingFallbackSearchModel,
    publicAnalyzeEnabled: cfg.publicAnalyzeEnabled,
    accessTokenRequired: Boolean(cfg.analyzeAccessToken),
    distributedRateLimitConfigured: Boolean(
      cfg.upstashRedisRestUrl && cfg.upstashRedisRestToken
    ),
    distributedQuotaRequired: cfg.requireDistributedQuota,
  };
}
