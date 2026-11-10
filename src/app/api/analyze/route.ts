import { NextResponse } from "next/server";
import { getServerEnvConfig } from "@/lib/env";
import {
  ImageValidationError,
  sanitizeScreenshotBuffer,
} from "@/lib/image/sanitize";
import { runAnalysisPipeline } from "@/lib/pipeline/orchestrator";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
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
      return NextResponse.json({ report });
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Terjadi kesalahan saat menjalankan pipeline analisis.";
      return NextResponse.json(
        { error: message, code: "PIPELINE_ERROR" },
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
          message:
            error instanceof Error
              ? error.message
              : "Terjadi kesalahan saat menjalankan pipeline analisis.",
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
    },
  });
}
