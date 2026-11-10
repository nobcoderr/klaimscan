export type ClaimVerdict =
  | "FALSE"
  | "TRUE"
  | "MISLEADING"
  | "OUTDATED"
  | "UNVERIFIED";

export type PostStance =
  | "asserting_claim"
  | "debunking_claim"
  | "quoting_claim"
  | "neutral_discussion"
  | "unclear_context";

export type EvidenceRelation =
  | "supporting"
  | "contradicting"
  | "partial_context"
  | "irrelevant";

export type SourceTier =
  | "official_government"
  | "fact_checker"
  | "credible_media"
  | "public_source";

export type PlatformType =
  | "Instagram"
  | "TikTok"
  | "Facebook"
  | "WhatsApp"
  | "X"
  | "Other";

export type PipelineStepId =
  | "image_processing"
  | "claim_extraction"
  | "evidence_retrieval"
  | "evidence_comparison"
  | "verdict_engine"
  | "report_generator";

export type PipelineStepStatus =
  | "pending"
  | "active"
  | "completed"
  | "skipped"
  | "error";

export interface PipelineStepState {
  id: PipelineStepId;
  code: string;
  label: string;
  description: string;
  status: PipelineStepStatus;
  durationMs?: number;
  detail?: string;
}

export interface ClaimExtractionResult {
  extractedText: string;
  primaryClaim: string;
  secondaryClaims: string[];
  topicCategory: string;
  claimDateMentioned: string | null;
  language: string;
  platform: PlatformType;
  visibleAccountHandle: string | null;
  visibleAccountName: string | null;
  visiblePostUrl: string | null;
  visibleTimestamp: string | null;
  postStance: PostStance;
  postStanceSummary: string;
  containsCheckableClaim: boolean;
  searchQueries: string[];
}

export interface EvidenceSource {
  id: string;
  title: string;
  url: string;
  domain: string;
  publisher: string;
  publishedAt: string | null;
  snippet: string;
  relation: EvidenceRelation;
  claimEvaluated: string;
  sourceTier: SourceTier;
  origin: "google_fact_check" | "openai_web_search" | "demo_fixture";
  ratingText?: string | null;
  rationale: string;
}

export interface OriginTimelineEvent {
  id: string;
  timestampLabel: string;
  eventType:
    | "post_observed"
    | "fact_check_prior"
    | "official_statement"
    | "verification_run";
  title: string;
  description: string;
  sourceUrl?: string | null;
  verifiedDate?: string | null;
}

export interface PublicOriginTrace {
  platform: PlatformType;
  visibleAccountHandle: string | null;
  visibleAccountName: string | null;
  visiblePostUrl: string | null;
  visibleTimestamp: string | null;
  clarificationSources: Array<{
    publisher: string;
    url: string;
    tier: SourceTier;
    publishedAt?: string | null;
  }>;
  timeline: OriginTimelineEvent[];
  privacyGuarantee: string;
  attributionCaveat: string;
}

export interface VerdictAssessment {
  claimVerdict: ClaimVerdict;
  verdictLabelId: string;
  postClassification: string;
  postStance: PostStance;
  summary: string;
  explanation: string;
  evidenceMetrics: {
    totalRetrieved: number;
    relevantSources: number;
    supportingCount: number;
    contradictingCount: number;
    partialContextCount: number;
    officialOrFactCheckCount: number;
  };
}

export interface ProcessedImageSummary {
  fileName: string;
  mimeType: string;
  originalBytes: number;
  sanitizedBytes: number;
  metadataRemovedBytes: number;
  strippedSegments: string[];
  sha256: string;
  persistedOnServer: false;
}

export interface InvestigationReport {
  caseId: string;
  title: string;
  isDemo: boolean;
  demoCategoryLabel?: string;
  checkedAt: string;
  analystNotes?: string | null;
  imageMetadata: ProcessedImageSummary;
  claimExtraction: ClaimExtractionResult;
  verdict: VerdictAssessment;
  supportingEvidence: EvidenceSource[];
  contradictingEvidence: EvidenceSource[];
  partialContextEvidence: EvidenceSource[];
  publicOriginTrace: PublicOriginTrace;
  evidenceSources: EvidenceSource[];
  pipelineSteps: PipelineStepState[];
  limitations: string[];
  warnings: string[];
}

export interface ServerConfigStatus {
  openAiConfigured: boolean;
  factCheckConfigured: boolean;
  visionModel: string;
  searchModel: string;
  usingFallbackVisionModel: boolean;
  usingFallbackSearchModel: boolean;
}
