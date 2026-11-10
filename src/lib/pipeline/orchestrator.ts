import OpenAI from "openai";
import { getServerEnvConfig } from "@/lib/env";
import {
  createServerOcrRulerGuide,
  OcrGuideIntegrityError,
} from "@/lib/image/ocr-guide";
import { sanitizeScreenshotBuffer } from "@/lib/image/sanitize";
import type {
  ClaimExtractionResult,
  InvestigationReport,
  PipelineStepId,
  PipelineStepState,
} from "@/lib/types";
import { getJakartaIsoDate } from "@/lib/utils";
import {
  buildFallbackAtomicClaims,
  buildFallbackNormalizedClaims,
  extractClaimFromScreenshot,
  TEXT_VERIFICATION_NOTICE,
} from "./claim-extractor";
import {
  compareEvidenceAgainstClaim,
  mapEvaluationsToVerifiedSources,
} from "./evidence-comparator";
import { retrieveEvidence } from "./evidence-retriever";
import { buildInvestigationReport } from "./report-generator";
import { createInitialPipelineSteps } from "./steps";
import { computeVerdictFromEvidence } from "./verdict-engine";

export { createInitialPipelineSteps };

export const PIPELINE_TOTAL_DEADLINE_MS = 48_000;
const MIN_STAGE_BUDGET_MS = 3_000;

export class PipelineConfigurationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PipelineConfigurationError";
  }
}

export class PipelineTimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PipelineTimeoutError";
  }
}

export class PipelineUpstreamError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PipelineUpstreamError";
  }
}

export type PipelineProgressCallback = (steps: PipelineStepState[]) => void;

function isAbortOrTimeoutError(error: unknown, signal: AbortSignal): boolean {
  if (signal.aborted) return true;
  if (!(error instanceof Error)) return false;
  return (
    error.name === "AbortError" ||
    error.name === "TimeoutError" ||
    error.name === "PipelineTimeoutError" ||
    /timeout|aborted|deadline/i.test(error.message)
  );
}

export async function runAnalysisPipeline(params: {
  rawBuffer: Buffer;
  fileName: string;
  declaredMimeType?: string;
  ignoredClientGuideSubmitted?: boolean;
  analystNotes?: string;
  deadlineMs?: number;
  signal?: AbortSignal;
  onProgress?: PipelineProgressCallback;
}): Promise<InvestigationReport> {
  const env = getServerEnvConfig();
  if (!env.openAiApiKey) {
    throw new PipelineConfigurationError(
      "OPENAI_API_KEY belum dikonfigurasi pada server."
    );
  }

  const totalDeadlineMs = Math.max(
    5_000,
    params.deadlineMs ?? env.pipelineDeadlineMs ?? PIPELINE_TOTAL_DEADLINE_MS
  );
  const startedAt = Date.now();
  const deadlineAt = startedAt + totalDeadlineMs;
  const remainingMs = () => Math.max(0, deadlineAt - Date.now());

  const pipelineController = new AbortController();
  const deadlineTimer = setTimeout(
    () =>
      pipelineController.abort(
        new PipelineTimeoutError(
          "Batas waktu keseluruhan pipeline analisis terlampaui."
        )
      ),
    totalDeadlineMs
  );

  const onParentAbort = () => {
    pipelineController.abort(
      params.signal?.reason ?? new PipelineTimeoutError("Permintaan dibatalkan.")
    );
  };

  if (params.signal) {
    if (params.signal.aborted) {
      onParentAbort();
    } else {
      params.signal.addEventListener("abort", onParentAbort, { once: true });
    }
  }

  const throwIfDeadlineExceeded = () => {
    if (pipelineController.signal.aborted || remainingMs() <= 500) {
      throw new PipelineTimeoutError(
        "Batas waktu keseluruhan pipeline analisis terlampaui."
      );
    }
  };

  const steps = createInitialPipelineSteps();
  const markStep = (
    id: PipelineStepId,
    patch: Partial<PipelineStepState>
  ) => {
    const target = steps.find((s) => s.id === id);
    if (target) {
      Object.assign(target, patch);
    }
    params.onProgress?.(steps.map((s) => ({ ...s })));
  };

  const client = new OpenAI({ apiKey: env.openAiApiKey });
  const warnings: string[] = [];

  if (params.ignoredClientGuideSubmitted) {
    warnings.push(
      "Field ocrGuide eksternal dari klien diabaikan demi integritas bukti; panduan penggaris OCR dibuat langsung di server dari screenshot asli tervalidasi."
    );
  }

  try {
    // 01 — Image Processing & Server-Side OCR Guide Generation
    let t0 = Date.now();
    markStep("image_processing", { status: "active" });
    const sanitized = sanitizeScreenshotBuffer(
      params.rawBuffer,
      params.fileName,
      params.declaredMimeType
    );
    const serverGuide = await createServerOcrRulerGuide({
      sanitizedImageBuffer: sanitized.buffer,
      mimeType: sanitized.mimeType,
      expectedSha256: sanitized.summary.sha256,
    });
    markStep("image_processing", {
      status: "completed",
      durationMs: Date.now() - t0,
      detail: `SHA-256 ${sanitized.summary.sha256.slice(0, 12)}… · ${sanitized.summary.metadataRemovedBytes} B metadata dibersihkan`,
    });

    throwIfDeadlineExceeded();

    // 02 — Text-First Two-Stage Extraction (Stage A Vision OCR -> Stage B Text-Only Normalization)
    t0 = Date.now();
    markStep("claim_extraction", { status: "active" });
    const extractionBudgetMs = Math.min(
      26_000,
      Math.max(MIN_STAGE_BUDGET_MS, remainingMs() - 8_000)
    );
    let extraction: ClaimExtractionResult;
    try {
      const extracted = await extractClaimFromScreenshot({
        client,
        model: env.visionModel,
        textModel: env.searchModel,
        base64DataUrl: sanitized.base64DataUrl,
        sanitizedImageBuffer: sanitized.buffer,
        imageMimeType: sanitized.mimeType,
        expectedImageSha256: sanitized.summary.sha256,
        serverGuide,
        analystNotes: params.analystNotes,
        timeoutMs: extractionBudgetMs,
        signal: pipelineController.signal,
      });
      extraction = {
        ...extracted,
        textVerificationNotice:
          extracted.textVerificationNotice ?? TEXT_VERIFICATION_NOTICE,
        normalizedClaims: buildFallbackNormalizedClaims({
          primaryClaim: extracted.primaryClaim,
          claimDateMentioned: extracted.claimDateMentioned,
          normalizedClaims: extracted.normalizedClaims,
        }),
        atomicClaims: buildFallbackAtomicClaims({
          primaryClaim: extracted.primaryClaim,
          claimDateMentioned: extracted.claimDateMentioned,
          atomicClaims: extracted.atomicClaims,
        }),
      };
    } catch (error) {
      if (error instanceof OcrGuideIntegrityError) {
        throw error;
      }
      if (isAbortOrTimeoutError(error, pipelineController.signal)) {
        throw new PipelineTimeoutError("Tahap ekstraksi klaim melampaui batas waktu.");
      }
      throw new PipelineUpstreamError("Ekstraksi klaim berbasis teks gagal dijalankan.");
    }

    markStep("claim_extraction", {
      status: "completed",
      durationMs: Date.now() - t0,
      detail: extraction.containsCheckableClaim
        ? `Stage A OCR → Stage B Claim · ${extraction.platform} · ${extraction.postStance}`
        : `Tidak ada teks klaim faktual (${extraction.platform})`,
    });

    throwIfDeadlineExceeded();

    // 03 — Evidence Retrieval & 04 — Evidence Comparison (skip cleanly when no readable factual claim)
    let comparison: {
      sources: import("@/lib/types").EvidenceSource[];
      outdatedSignalDetected: boolean;
      warning?: string;
    };

    if (!extraction.containsCheckableClaim) {
      markStep("evidence_retrieval", {
        status: "skipped",
        durationMs: 0,
        detail: "Dilewati: tidak terdapat klaim faktual berbasis teks pada screenshot",
      });
      markStep("evidence_comparison", {
        status: "skipped",
        durationMs: 0,
        detail: "Dilewati: langsung ditetapkan sebagai UNVERIFIED",
      });
      comparison = { sources: [], outdatedSignalDetected: false };
      warnings.push(
        "Screenshot tidak memuat teks klaim faktual yang cukup jelas sehingga penelusuran web dilewati dan status ditetapkan UNVERIFIED."
      );
    } else {
      // 03 — Evidence Retrieval
      t0 = Date.now();
      markStep("evidence_retrieval", { status: "active" });
      const retrievalBudgetMs = Math.min(
        24_000,
        Math.max(MIN_STAGE_BUDGET_MS, remainingMs() - 4_000)
      );
      let retrieval;
      try {
        retrieval = await retrieveEvidence({
          client,
          searchModel: env.searchModel,
          factCheckApiKey: env.factCheckApiKey,
          extraction,
          timeoutMs: retrievalBudgetMs,
          signal: pipelineController.signal,
        });
      } catch (error) {
        if (isAbortOrTimeoutError(error, pipelineController.signal)) {
          throw new PipelineTimeoutError("Tahap penelusuran bukti melampaui batas waktu.");
        }
        throw new PipelineUpstreamError("Penelusuran bukti web gagal dijalankan.");
      }

      warnings.push(...retrieval.warnings);
      markStep("evidence_retrieval", {
        status: "completed",
        durationMs: Date.now() - t0,
        detail: `${retrieval.candidates.length} URL bukti terindeks`,
      });

      throwIfDeadlineExceeded();

      // 04 — Evidence Comparison (gracefully degrade if pipeline deadline budget is nearly exhausted)
      t0 = Date.now();
      markStep("evidence_comparison", { status: "active" });
      const remainingForComparison = remainingMs();
      const todayIso = getJakartaIsoDate();

      if (
        retrieval.candidates.length > 0 &&
        remainingForComparison < MIN_STAGE_BUDGET_MS
      ) {
        comparison = mapEvaluationsToVerifiedSources({
          candidates: retrieval.candidates,
          primaryClaim: extraction.primaryClaim,
          atomicClaims: extraction.atomicClaims,
          claimDateMentioned: extraction.claimDateMentioned,
          referenceDateIso: todayIso,
          evaluations: [],
        });
        warnings.push(
          "Anggaran waktu pipeline tersisa terlalu singkat; pembandingan bukti menggunakan fallback penilaian terstruktur yang konservatif."
        );
      } else {
        const comparisonBudgetMs = Math.min(
          16_000,
          Math.max(MIN_STAGE_BUDGET_MS, remainingForComparison - 1_500)
        );
        comparison = await compareEvidenceAgainstClaim({
          client,
          model: env.searchModel,
          extraction,
          candidates: retrieval.candidates,
          searchSummary: retrieval.searchSummary,
          timeoutMs: comparisonBudgetMs,
          signal: pipelineController.signal,
        });
        if (comparison.warning) {
          warnings.push(comparison.warning);
        }
      }

      markStep("evidence_comparison", {
        status: "completed",
        durationMs: Date.now() - t0,
        detail: `${comparison.sources.filter((s) => s.relation !== "irrelevant").length} sumber relevan dibandingkan`,
      });
    }

    // 05 — Verdict Engine
    t0 = Date.now();
    markStep("verdict_engine", { status: "active" });
    const verdict = computeVerdictFromEvidence({
      primaryClaim: extraction.primaryClaim,
      postStance: extraction.postStance,
      postStanceSummary: extraction.postStanceSummary,
      sources: comparison.sources,
      atomicClaims: extraction.atomicClaims,
      outdatedSignalDetected: comparison.outdatedSignalDetected,
      containsCheckableClaim: extraction.containsCheckableClaim,
    });
    markStep("verdict_engine", {
      status: "completed",
      durationMs: Date.now() - t0,
      detail: `Verdict: ${verdict.claimVerdict}`,
    });

    // 06 — Report Generator
    t0 = Date.now();
    markStep("report_generator", { status: "active" });
    const finalSteps = steps.map((s) =>
      s.id === "report_generator"
        ? {
            ...s,
            status: "completed" as const,
            durationMs: Date.now() - t0,
            detail: "Laporan investigasi & Public Trace siap",
          }
        : { ...s }
    );

    const report = buildInvestigationReport({
      analystNotes: params.analystNotes ?? null,
      imageMetadata: sanitized.summary,
      extraction,
      verdict,
      sources: comparison.sources,
      pipelineSteps: finalSteps,
      warnings,
    });

    markStep("report_generator", {
      status: "completed",
      durationMs: Date.now() - t0,
      detail: `Case ${report.caseId}`,
    });

    return report;
  } finally {
    clearTimeout(deadlineTimer);
    params.signal?.removeEventListener("abort", onParentAbort);
  }
}
