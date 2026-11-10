import OpenAI from "openai";
import { getServerEnvConfig } from "@/lib/env";
import { sanitizeScreenshotBuffer } from "@/lib/image/sanitize";
import type { InvestigationReport, PipelineStepId, PipelineStepState } from "@/lib/types";
import { extractClaimFromScreenshot } from "./claim-extractor";
import { compareEvidenceAgainstClaim } from "./evidence-comparator";
import { retrieveEvidence } from "./evidence-retriever";
import { buildInvestigationReport } from "./report-generator";
import { createInitialPipelineSteps } from "./steps";
import { computeVerdictFromEvidence } from "./verdict-engine";

export { createInitialPipelineSteps };

export type PipelineProgressCallback = (steps: PipelineStepState[]) => void;

export async function runAnalysisPipeline(params: {
  rawBuffer: Buffer;
  fileName: string;
  declaredMimeType?: string;
  analystNotes?: string;
  onProgress?: PipelineProgressCallback;
}): Promise<InvestigationReport> {
  const env = getServerEnvConfig();
  if (!env.openAiApiKey) {
    throw new Error(
      "OPENAI_API_KEY belum diisi pada .env.local atau env.local. Tambahkan API key OpenAI di server untuk menjalankan analisis screenshot langsung."
    );
  }

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

  // 01 — Image Processing
  let t0 = Date.now();
  markStep("image_processing", { status: "active" });
  const sanitized = sanitizeScreenshotBuffer(
    params.rawBuffer,
    params.fileName,
    params.declaredMimeType
  );
  markStep("image_processing", {
    status: "completed",
    durationMs: Date.now() - t0,
    detail: `SHA-256 ${sanitized.summary.sha256.slice(0, 12)}… · ${sanitized.summary.metadataRemovedBytes} B metadata dibersihkan`,
  });

  // 02 — Claim Extraction
  t0 = Date.now();
  markStep("claim_extraction", { status: "active" });
  const extraction = await extractClaimFromScreenshot({
    client,
    model: env.visionModel,
    base64DataUrl: sanitized.base64DataUrl,
    analystNotes: params.analystNotes,
  });
  markStep("claim_extraction", {
    status: "completed",
    durationMs: Date.now() - t0,
    detail: `Platform ${extraction.platform} · Sikap: ${extraction.postStance}`,
  });

  // 03 — Evidence Retrieval
  t0 = Date.now();
  markStep("evidence_retrieval", { status: "active" });
  const retrieval = await retrieveEvidence({
    client,
    searchModel: env.searchModel,
    factCheckApiKey: env.factCheckApiKey,
    extraction,
  });
  warnings.push(...retrieval.warnings);
  markStep("evidence_retrieval", {
    status: "completed",
    durationMs: Date.now() - t0,
    detail: `${retrieval.candidates.length} URL bukti terindeks`,
  });

  // 04 — Evidence Comparison
  t0 = Date.now();
  markStep("evidence_comparison", { status: "active" });
  const comparison = await compareEvidenceAgainstClaim({
    client,
    model: env.searchModel,
    extraction,
    candidates: retrieval.candidates,
    searchSummary: retrieval.searchSummary,
  });
  if (comparison.warning) {
    warnings.push(comparison.warning);
  }
  markStep("evidence_comparison", {
    status: "completed",
    durationMs: Date.now() - t0,
    detail: `${comparison.sources.filter((s) => s.relation !== "irrelevant").length} sumber relevan dibandingkan`,
  });

  // 05 — Verdict Engine
  t0 = Date.now();
  markStep("verdict_engine", { status: "active" });
  const verdict = computeVerdictFromEvidence({
    primaryClaim: extraction.primaryClaim,
    postStance: extraction.postStance,
    postStanceSummary: extraction.postStanceSummary,
    sources: comparison.sources,
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
}
