import { NextResponse } from "next/server";
import { getServerEnvConfig } from "@/lib/env";
import {
  ImageValidationError,
  sanitizeScreenshotBuffer,
} from "@/lib/image/sanitize";
import { runAnalysisPipeline } from "@/lib/pipeline/orchestrator";
import {
  logSafeServerError,
  toPublicApiError,
} from "@/lib/security/error-sanitizer";
import {
  consumeGlobalCreditQuota,
  enforceDistributedRateLimit,
  getClientIpFromRequest,
  tryAcquireAnalysisSlot,
  verifyAnalyzeAccessToken,
} from "@/lib/security/rate-limit";

export const runtime = "nodejs";
export const maxDuration = 60;

// Allow multipart boundary + optional OCR ruler guide + analyst notes on top of 5 MB max image
const MAX_MULTIPART_CONTENT_LENGTH = 9 * 1024 * 1024;

function buildRateLimitHeaders(rate: {
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfterSeconds: number;
  backend?: string;
}): Record<string, string> {
  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(rate.limit),
    "X-RateLimit-Remaining": String(rate.remaining),
    "X-RateLimit-Reset": String(Math.ceil(rate.resetAt / 1000)),
  };
  if (rate.retryAfterSeconds > 0) {
    headers["Retry-After"] = String(rate.retryAfterSeconds);
  }
  if (rate.backend) {
    headers["X-RateLimit-Backend"] = rate.backend;
  }
  return headers;
}

export async function POST(request: Request) {
  const env = getServerEnvConfig();

  if (!env.publicAnalyzeEnabled) {
    return NextResponse.json(
      {
        error:
          "Endpoint analisis AI langsung sedang dinonaktifkan sementara oleh operator. Mode Demo offline tetap tersedia di dashboard.",
        code: "PUBLIC_ANALYZE_DISABLED",
      },
      { status: 503 }
    );
  }

  if (!verifyAnalyzeAccessToken(request, env.analyzeAccessToken)) {
    return NextResponse.json(
      {
        error:
          "Token akses analisis tidak valid atau belum disertakan. Gunakan Mode Demo offline untuk pratinjau tanpa kredensial.",
        code: "UNAUTHORIZED_ACCESS",
      },
      { status: 401 }
    );
  }

  const clientIp = getClientIpFromRequest(request, {
    trustedProxyMode: env.trustedProxyMode,
  });

  const rate = await enforceDistributedRateLimit({
    key: clientIp,
    namespace: "analyze-client",
    maxRequests: env.rateLimitMaxRequests,
    windowMs: env.rateLimitWindowMs,
    upstashUrl: env.upstashRedisRestUrl,
    upstashToken: env.upstashRedisRestToken,
  });

  if (!rate.allowed) {
    return NextResponse.json(
      {
        error:
          "Terlalu banyak permintaan analisis. Tunggu beberapa saat lalu coba lagi.",
        code: "RATE_LIMITED",
        retryAfterSeconds: rate.retryAfterSeconds,
      },
      {
        status: 429,
        headers: buildRateLimitHeaders(rate),
      }
    );
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number.parseInt(contentLengthHeader, 10);
    if (
      Number.isFinite(contentLength) &&
      contentLength > MAX_MULTIPART_CONTENT_LENGTH
    ) {
      return NextResponse.json(
        {
          error:
            "Ukuran payload permintaan melebihi batas maksimal 5 MB per screenshot.",
          code: "INVALID_IMAGE",
        },
        { status: 400 }
      );
    }
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json(
      {
        error:
          "Permintaan harus menggunakan multipart/form-data dengan field 'file'.",
        code: "INVALID_FORM_DATA",
      },
      { status: 400 }
    );
  }

  const fileEntry = formData.get("file");
  if (!fileEntry || !(fileEntry instanceof File)) {
    return NextResponse.json(
      {
        error: "File screenshot wajib disertakan (JPG, PNG, atau WebP).",
        code: "MISSING_FILE",
      },
      { status: 400 }
    );
  }

  const rawArrayBuffer = await fileEntry.arrayBuffer();
  const rawBuffer = Buffer.from(rawArrayBuffer);
  const ocrGuideEntry = formData.get("ocrGuide");
  const ocrGuideFile =
    ocrGuideEntry instanceof File && ocrGuideEntry.size > 0
      ? ocrGuideEntry
      : undefined;
  const ocrGuideBuffer = ocrGuideFile
    ? Buffer.from(await ocrGuideFile.arrayBuffer())
    : undefined;
  const analystNotesRaw = formData.get("analystNotes");
  const analystNotes =
    typeof analystNotesRaw === "string" && analystNotesRaw.trim()
      ? analystNotesRaw.trim().slice(0, 500)
      : undefined;

  // Validate image & strip metadata synchronously first so invalid files fail fast with 400 before consuming AI credit quotas
  try {
    sanitizeScreenshotBuffer(rawBuffer, fileEntry.name, fileEntry.type);
    if (ocrGuideBuffer && ocrGuideFile) {
      sanitizeScreenshotBuffer(
        ocrGuideBuffer,
        ocrGuideFile.name,
        ocrGuideFile.type
      );
    }
  } catch (error) {
    if (error instanceof ImageValidationError) {
      return NextResponse.json(
        { error: error.message, code: "INVALID_IMAGE" },
        { status: 400 }
      );
    }
    return NextResponse.json(
      { error: "Gagal memvalidasi gambar yang diunggah.", code: "INVALID_IMAGE" },
      { status: 400 }
    );
  }

  if (!env.openAiApiKey) {
    return NextResponse.json(
      {
        error:
          "OPENAI_API_KEY belum dikonfigurasi pada .env.local atau env.local. Tambahkan kunci OpenAI di server agar analisis AI langsung dapat dijalankan, atau gunakan Demo Dataset untuk pratinjau.",
        code: "OPENAI_NOT_CONFIGURED",
      },
      { status: 503 }
    );
  }

  const globalCredit = await consumeGlobalCreditQuota({
    maxHourlyRequests: env.globalHourlyLimit,
    upstashUrl: env.upstashRedisRestUrl,
    upstashToken: env.upstashRedisRestToken,
  });

  if (!globalCredit.allowed) {
    return NextResponse.json(
      {
        error:
          "Kuota analisis AI langsung per jam telah mencapai batas perlindungan biaya. Silakan coba lagi nanti atau gunakan Demo Dataset.",
        code: "GLOBAL_CREDIT_LIMIT",
        retryAfterSeconds: globalCredit.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(globalCredit.retryAfterSeconds),
          "X-RateLimit-Limit": String(globalCredit.limit),
          "X-RateLimit-Remaining": "0",
        },
      }
    );
  }

  const concurrencySlot = tryAcquireAnalysisSlot(env.maxConcurrentAnalyses);
  if (!concurrencySlot.acquired) {
    return NextResponse.json(
      {
        error:
          "Server sedang memproses batas maksimum analisis paralel. Tunggu beberapa detik lalu coba lagi.",
        code: "TOO_MANY_CONCURRENT_REQUESTS",
        retryAfterSeconds: 5,
      },
      {
        status: 429,
        headers: {
          "Retry-After": "5",
        },
      }
    );
  }

  const wantsStream =
    new URL(request.url).searchParams.get("stream") === "true" ||
    request.headers.get("accept")?.includes("application/x-ndjson");

  const rateHeaders = buildRateLimitHeaders(rate);

  if (!wantsStream) {
    try {
      const report = await runAnalysisPipeline({
        rawBuffer,
        fileName: fileEntry.name,
        declaredMimeType: fileEntry.type,
        ocrGuideBuffer,
        ocrGuideFileName: ocrGuideFile?.name,
        ocrGuideMimeType: ocrGuideFile?.type,
        analystNotes,
        deadlineMs: env.pipelineDeadlineMs,
        signal: request.signal,
      });
      return NextResponse.json(
        { report },
        {
          headers: {
            "Cache-Control": "no-store",
            ...rateHeaders,
          },
        }
      );
    } catch (error) {
      const pubErr = toPublicApiError(error);
      logSafeServerError({
        event: "analyze_json_failed",
        errorId: pubErr.errorId,
        code: pubErr.code,
        status: pubErr.status,
        error,
      });
      return NextResponse.json(
        { error: pubErr.message, code: pubErr.code, errorId: pubErr.errorId },
        { status: pubErr.status }
      );
    } finally {
      concurrencySlot.release();
    }
  }

  const encoder = new TextEncoder();
  let streamClosed = false;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        if (streamClosed) return;
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
        } catch {
          streamClosed = true;
        }
      };

      try {
        const report = await runAnalysisPipeline({
          rawBuffer,
          fileName: fileEntry.name,
          declaredMimeType: fileEntry.type,
          ocrGuideBuffer,
          ocrGuideFileName: ocrGuideFile?.name,
          ocrGuideMimeType: ocrGuideFile?.type,
          analystNotes,
          deadlineMs: env.pipelineDeadlineMs,
          signal: request.signal,
          onProgress: (steps) => {
            send({ type: "progress", steps });
          },
        });
        send({ type: "complete", report });
      } catch (error) {
        const pubErr = toPublicApiError(error);
        logSafeServerError({
          event: "analyze_stream_failed",
          errorId: pubErr.errorId,
          code: pubErr.code,
          status: pubErr.status,
          error,
        });
        send({
          type: "error",
          code: pubErr.code,
          errorId: pubErr.errorId,
          message: pubErr.message,
        });
      } finally {
        concurrencySlot.release();
        if (!streamClosed) {
          streamClosed = true;
          try {
            controller.close();
          } catch {
            // Stream already closed by client cancellation
          }
        }
      }
    },
    cancel() {
      streamClosed = true;
      concurrencySlot.release();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      ...rateHeaders,
    },
  });
}
