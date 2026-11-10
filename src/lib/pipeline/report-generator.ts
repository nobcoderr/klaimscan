import type {
  ClaimExtractionResult,
  EvidenceSource,
  InvestigationReport,
  PipelineStepState,
  ProcessedImageSummary,
  VerdictAssessment,
} from "@/lib/types";
import { STANDARD_REPORT_LIMITATIONS } from "../../../tests/fixtures/cases";
import { buildPublicOriginTrace } from "./public-trace";

export { buildPublicOriginTrace };

export function generateCaseId(now = new Date()): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `KS-${yyyy}${mm}${dd}-${rand}`;
}

export function buildInvestigationReport(params: {
  caseId?: string;
  checkedAt?: string;
  analystNotes?: string | null;
  imageMetadata: ProcessedImageSummary;
  extraction: ClaimExtractionResult;
  verdict: VerdictAssessment;
  sources: EvidenceSource[];
  pipelineSteps: PipelineStepState[];
  warnings: string[];
}): InvestigationReport {
  const checkedAt = params.checkedAt || new Date().toISOString();
  const caseId = params.caseId || generateCaseId(new Date(checkedAt));

  const supportingEvidence = params.sources.filter(
    (s) => s.relation === "supporting"
  );
  const contradictingEvidence = params.sources.filter(
    (s) => s.relation === "contradicting"
  );
  const partialContextEvidence = params.sources.filter(
    (s) => s.relation === "partial_context"
  );

  return {
    caseId,
    title: params.extraction.primaryClaim,
    isDemo: false,
    checkedAt,
    analystNotes: params.analystNotes ?? null,
    imageMetadata: params.imageMetadata,
    claimExtraction: params.extraction,
    verdict: params.verdict,
    supportingEvidence,
    contradictingEvidence,
    partialContextEvidence,
    publicOriginTrace: buildPublicOriginTrace({
      extraction: params.extraction,
      sources: params.sources,
      checkedAt,
    }),
    evidenceSources: params.sources,
    pipelineSteps: params.pipelineSteps,
    limitations: STANDARD_REPORT_LIMITATIONS,
    warnings: params.warnings,
  };
}
