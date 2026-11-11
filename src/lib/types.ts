export const TEXT_VERIFICATION_NOTICE =
  "Verifikasi dilakukan terhadap klaim tekstual. Keaslian foto sampul tidak diperiksa.";

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
  | "insufficient"
  | "irrelevant";

export type ClaimModality =
  | "assertion"
  | "allegation"
  | "intention"
  | "proposal"
  | "approved"
  | "target"
  | "prediction"
  | "quotation"
  | "reported"
  | "unknown";

export type ClaimEpistemicCertainty =
  | "asserted"
  | "alleged"
  | "uncertain"
  | "disputed"
  | "hypothetical"
  | "unknown";

export type ClaimAssertionType =
  | "event"
  | "quotation"
  | "causal"
  | "correlational"
  | "opinion"
  | "prediction"
  | "unknown";

export type EvidenceNature =
  | "primary_record"
  | "direct_statement"
  | "original_research"
  | "institutional_data"
  | "independent_reporting"
  | "fact_check"
  | "commentary"
  | "unknown";

export type EvidenceIndependence = "independent" | "syndicated" | "unknown";

export type EvidenceExcerptBasis =
  | "fact_check_api_metadata"
  | "ai_search_summary"
  | "url_only";

export type EvidenceTargetAspect =
  | "text_claim"
  | "image_authenticity"
  | "event_occurrence"
  | "status_or_stage"
  | "plan_or_target"
  | "implementation_or_outcome";

export type TemporalVerificationStatus =
  | "current_match"
  | "historical_debunk"
  | "date_mismatch"
  | "unclear";

export type AtomicClaimCategory =
  | "main_event"
  | "subject_identity"
  | "time_and_location"
  | "status_or_stage"
  | "quantity_or_measurement"
  | "caption_context"
  | "outcome_or_result"
  | "modality_or_condition";

export type OcrRegionRole =
  | "headline"
  | "graphic_overlay"
  | "caption"
  | "publisher"
  | "date"
  | "debunk_note";

export interface OcrBoundingBox {
  /** Normalized 0..1000 left offset */
  x: number;
  /** Normalized 0..1000 top offset */
  y: number;
  /** Normalized 0..1000 width */
  width: number;
  /** Normalized 0..1000 height */
  height: number;
}

export interface OcrTextRegion {
  id: string;
  role: OcrRegionRole;
  text: string;
  bbox: OcrBoundingBox;
}

export interface ScreenshotOcrResult {
  extractedHeadline: string | null;
  graphicOverlayTexts: string[];
  extractedCaption: string | null;
  captionTruncated?: boolean;
  publisherOrAccountName: string | null;
  visibleAccountHandle: string | null;
  visiblePostUrl: string | null;
  visiblePublicationDate: string | null;
  clarificationOrDebunkText: string | null;
  rawTranscript: string;
  language: string;
  platform: PlatformType;
  ocrRegions: OcrTextRegion[];
}

export interface NormalizedFactualClaim {
  id: string;
  subject: string;
  predicateAction: string;
  objectTarget: string;
  proposition: string;
  eventDate: string | null;
  legalOrAdministrativeStatus: string | null;
  sourceRole: "headline" | "caption" | "combined";
  semanticNote?: string | null;
  requiredForFullConfirmation?: boolean;
  namedEntities?: string[];
  numericValues?: Array<{
    value: string;
    unit: string | null;
    context: string;
  }>;
  geographicContext?: string[];
  polarity?: "affirmed" | "negated";
  modality?: ClaimModality;
  epistemicCertainty?: ClaimEpistemicCertainty;
  assertionType?: ClaimAssertionType;
  requiredConditions?: string[];
}

export interface AtomicClaimItem {
  id: string;
  category: AtomicClaimCategory;
  label: string;
  proposition: string;
  requiredForFullConfirmation?: boolean;
}

export type EvidenceDateBasis = "verified" | "reported" | "inferred" | "unknown";

export interface AtomicClaimAssessment extends AtomicClaimItem {
  status: ClaimVerdict;
  statusLabel: string;
  evidenceIds: string[];
  rationale: string;
}

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
  extractedHeadline?: string | null;
  graphicOverlayTexts?: string[];
  extractedCaption?: string | null;
  captionTruncated?: boolean;
  clarificationOrDebunkText?: string | null;
  primaryClaim: string;
  secondaryClaims: string[];
  normalizedClaims?: NormalizedFactualClaim[];
  atomicClaims?: AtomicClaimItem[];
  ocr?: ScreenshotOcrResult;
  textVerificationNotice?: string;
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
  publicationDateBasis?: EvidenceDateBasis;
  inferredPublishedAt?: string | null;
  snippet: string;
  relation: EvidenceRelation;
  targetAspect?: EvidenceTargetAspect;
  temporalStatus?: TemporalVerificationStatus;
  sourceEventDate?: string | null;
  sourceEventDateBasis?: Exclude<EvidenceDateBasis, "verified">;
  evidenceNature?: EvidenceNature;
  independence?: EvidenceIndependence;
  excerptBasis?: EvidenceExcerptBasis;
  evaluatedAtomicClaimId?: string | null;
  evaluatedAtomicClaimIds?: string[];
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
  qualifiedStatusLabels?: string[];
  atomicAssessments?: AtomicClaimAssessment[];
  evidenceMetrics: {
    totalRetrieved: number;
    relevantSources: number;
    insufficientCount?: number;
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
  insufficientEvidence?: EvidenceSource[];
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
  publicAnalyzeEnabled?: boolean;
  accessTokenRequired?: boolean;
  distributedRateLimitConfigured?: boolean;
  distributedQuotaRequired?: boolean;
}
