import fs from "node:fs";
import path from "node:path";
import type { ServerConfigStatus } from "./types";

const DEFAULT_MODEL = "gpt-5.4-mini";

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

export interface ServerEnvConfig {
  openAiApiKey: string | undefined;
  factCheckApiKey: string | undefined;
  visionModel: string;
  searchModel: string;
  usingFallbackVisionModel: boolean;
  usingFallbackSearchModel: boolean;
}

export function getServerEnvConfig(): ServerEnvConfig {
  const openAiApiKey = resolveEnvValue("OPENAI_API_KEY");
  const factCheckApiKey = resolveEnvValue("FACTCHECK_API_KEY");

  const rawVisionModel = resolveEnvValue("OPENAI_VISION_MODEL");
  const rawSearchModel = resolveEnvValue("OPENAI_SEARCH_MODEL");

  const visionModel = rawVisionModel || DEFAULT_MODEL;
  const searchModel = rawSearchModel || DEFAULT_MODEL;

  return {
    openAiApiKey,
    factCheckApiKey,
    visionModel,
    searchModel,
    usingFallbackVisionModel: !rawVisionModel,
    usingFallbackSearchModel: !rawSearchModel,
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
  };
}
