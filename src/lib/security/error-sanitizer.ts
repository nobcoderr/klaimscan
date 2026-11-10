import crypto from "node:crypto";

export function sanitizeApiErrorMessage(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : "Terjadi kesalahan saat menjalankan pipeline analisis.";

  return raw
    .replace(/sk-[a-zA-Z0-9_-]{10,}/g, "[REDACTED_OPENAI_KEY]")
    .replace(/AIza[0-9A-Za-z_-]{15,}/g, "[REDACTED_API_KEY]")
    .replace(/Bearer\s+[A-Za-z0-9._~+/=-]+/gi, "Bearer [REDACTED_TOKEN]")
    .replace(/([?&](?:key|token|api_key)=)[^&\s]+/gi, "$1[REDACTED]")
    .slice(0, 400);
}

export function createErrorReferenceId(): string {
  return `ERR-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
}

export interface PublicApiErrorDescriptor {
  status: number;
  code:
    | "OPENAI_NOT_CONFIGURED"
    | "PIPELINE_TIMEOUT"
    | "PIPELINE_UPSTREAM_ERROR"
    | "PIPELINE_ERROR";
  message: string;
  errorId: string;
}

export function toPublicApiError(
  error: unknown,
  errorId = createErrorReferenceId()
): PublicApiErrorDescriptor {
  const errName = error instanceof Error ? error.name : "UnknownError";

  if (errName === "PipelineConfigurationError") {
    return {
      status: 503,
      code: "OPENAI_NOT_CONFIGURED",
      message:
        "Layanan analisis AI belum dikonfigurasi pada server. Gunakan Demo Dataset untuk pratinjau.",
      errorId,
    };
  }

  if (errName === "PipelineTimeoutError" || errName === "AbortError") {
    return {
      status: 504,
      code: "PIPELINE_TIMEOUT",
      message: `Batas waktu eksekusi pipeline analisis terlampaui. Silakan coba lagi beberapa saat lagi (Ref: ${errorId}).`,
      errorId,
    };
  }

  if (errName === "PipelineUpstreamError") {
    return {
      status: 502,
      code: "PIPELINE_UPSTREAM_ERROR",
      message: `Layanan verifikasi AI eksternal sedang sibuk atau tidak merespons sementara. Silakan coba lagi (Ref: ${errorId}).`,
      errorId,
    };
  }

  return {
    status: 500,
    code: "PIPELINE_ERROR",
    message: `Terjadi kesalahan internal saat memproses analisis. Silakan coba lagi (Ref: ${errorId}).`,
    errorId,
  };
}

export function logSafeServerError(params: {
  event: string;
  errorId: string;
  code: string;
  status: number;
  error: unknown;
}): void {
  const payload = {
    level: "error",
    timestamp: new Date().toISOString(),
    event: params.event,
    errorId: params.errorId,
    code: params.code,
    status: params.status,
    errorName: params.error instanceof Error ? params.error.name : "UnknownError",
    diagnostic: sanitizeApiErrorMessage(params.error),
  };

  console.error(JSON.stringify(payload));
}
