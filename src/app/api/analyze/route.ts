import { NextResponse } from "next/server";
import { getServerEnvConfig } from "@/lib/env";
import {
  ImageValidationError,
  sanitizeScreenshotBuffer,
} from "@/lib/image/sanitize";
import { runAnalysisPipeline } from "@/lib/pipeline/orchestrator";
import {
  checkRateLimit,
  getClientIpFromRequest,
} from "@/lib/security/rate-limit";
import { sanitizeApiErrorMessage } from "@/lib/security/error-sanitizer";

export const runtime = "nodejs";
export const maxDuration = 60;

// Allow multipart boundary + optional analyst notes on top of 5 MB max image
const MAX_MULTIPART_CONTENT_LENGTH = 7 * 1024 * 1024;

export async function POST(request: Request) {
  const clientIp = getClientIpFromRequest(request);
  const rate = checkRateLimit(clientIp, {
    maxRequests: 15,
    windowMs: 60_000,
  });

  if (!rate.allowed) {
    return NextResponse.json(
      {
        error:
          "Terlalu banyak permintaan analisis dari alamat yang sama. Tunggu beberapa saat lalu coba lagi.",
        code: "RATE_LIMITED",
        retryAfterSeconds: rate.retryAfterSeconds,
      },
      {
        status: 429,
        headers: {
          "Retry-After": String(rate.retryAfterSeconds),
          "X-RateLimit-Limit": String(rate.limit),
          "X-RateLimit-Remaining": "0",
          "X-RateLimit-Reset": String(Math.ceil(rate.resetAt / 1000)),
        },
      }
    );
  }

  const contentLengthHeader = request.headers.get("content-length");
  if (contentLengthHeader) {
    const contentLength = Number.parseInt(contentLengthHeader, 10);
    if (Number.isFinite(contentLength) && contentLength > MAX_MULTIPART_CONTENT_LENGTH) {
      return NextResponse.json(
        {
          error: "Ukuran payload permintaan melebihi batas maksimal 5 MB per screenshot.",
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
        error: "Permintaan harus menggunakan multipart/form-data dengan field 'file'.",
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
  const analystNotesRaw = formData.get("analystNotes");
  const analystNotes =
    typeof analystNotesRaw === "string" && analystNotesRaw.trim()
      ? analystNotesRaw.trim().slice(0, 500)
      : undefined;

  // Validate image & strip metadata synchronously first so invalid files fail fast with 400
  try {
    sanitizeScreenshotBuffer(rawBuffer, fileEntry.name, fileEntry.type);
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

  const env = getServerEnvConfig();
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

  const wantsStream =
    new URL(request.url).searchParams.get("stream") === "true" ||
    request.headers.get("accept")?.includes("application/x-ndjson");

  if (!wantsStream) {
    try {
      const report = await runAnalysisPipeline({
        rawBuffer,
        fileName: fileEntry.name,
        declaredMimeType: fileEntry.type,
        analystNotes,
      });
      return NextResponse.json(
        { report },
        {
          headers: {
            "Cache-Control": "no-store",
            "X-RateLimit-Limit": String(rate.limit),
            "X-RateLimit-Remaining": String(rate.remaining),
          },
        }
      );
    } catch (error) {
      return NextResponse.json(
        { error: sanitizeApiErrorMessage(error), code: "PIPELINE_ERROR" },
        { status: 500 }
      );
    }
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`${JSON.stringify(payload)}\n`));
      };

      try {
        const report = await runAnalysisPipeline({
          rawBuffer,
          fileName: fileEntry.name,
          declaredMimeType: fileEntry.type,
          analystNotes,
          onProgress: (steps) => {
            send({ type: "progress", steps });
          },
        });
        send({ type: "complete", report });
      } catch (error) {
        send({
          type: "error",
          message: sanitizeApiErrorMessage(error),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
      "X-RateLimit-Limit": String(rate.limit),
      "X-RateLimit-Remaining": String(rate.remaining),
    },
  });
}
