import type {
  ClaimExtractionResult,
  EvidenceSource,
  InvestigationReport,
  OriginTimelineEvent,
  PipelineStepState,
  ProcessedImageSummary,
  PublicOriginTrace,
  VerdictAssessment,
} from "@/lib/types";
import { STANDARD_REPORT_LIMITATIONS } from "../../../tests/fixtures/cases";

export function generateCaseId(now = new Date()): string {
  const yyyy = now.getUTCFullYear();
  const mm = String(now.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(now.getUTCDate()).padStart(2, "0");
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `KS-${yyyy}${mm}${dd}-${rand}`;
}

export function buildPublicOriginTrace(params: {
  extraction: ClaimExtractionResult;
  sources: EvidenceSource[];
  checkedAt: string;
}): PublicOriginTrace {
  const { extraction, sources, checkedAt } = params;

  const clarificationSources = sources
    .filter(
      (s) =>
        s.relation !== "irrelevant" &&
        (s.sourceTier === "official_government" ||
          s.sourceTier === "fact_checker" ||
          s.relation === "contradicting")
    )
    .slice(0, 6)
    .map((s) => ({
      publisher: s.publisher,
      url: s.url,
      tier: s.sourceTier,
      publishedAt: s.publishedAt,
    }));

  const timeline: OriginTimelineEvent[] = [
    {
      id: "tl-observed",
      timestampLabel: extraction.visibleTimestamp || "Terlihat pada screenshot",
      eventType: "post_observed",
      title: `Unggahan terdeteksi di ${extraction.platform}`,
      description: [
        extraction.visibleAccountHandle
          ? `Akun terlihat: ${extraction.visibleAccountHandle}`
          : "Akun tidak menampilkan handle yang terbaca jelas",
        `Sikap postingan: ${extraction.postStanceSummary}`,
      ].join(" · "),
      sourceUrl: extraction.visiblePostUrl,
    },
  ];

  for (const src of sources
    .filter((s) => s.relation !== "irrelevant")
    .slice(0, 4)) {
    timeline.push({
      id: `tl-${src.id}`,
      timestampLabel: src.publishedAt || "Publikasi terindeks",
      eventType:
        src.sourceTier === "official_government"
          ? "official_statement"
          : "fact_check_prior",
      title: `${src.publisher} (${src.relation})`,
      description: src.title,
      sourceUrl: src.url,
      verifiedDate: src.publishedAt,
    });
  }

  timeline.push({
    id: "tl-verified-now",
    timestampLabel: checkedAt,
    eventType: "verification_run",
    title: "Verifikasi KLAIMSCAN AI selesai",
    description:
      "Pemeriksaan silang bukti terbuka dan generasi laporan investigasi selesai dijalankan.",
    sourceUrl: null,
  });

  return {
    platform: extraction.platform,
    visibleAccountHandle: extraction.visibleAccountHandle,
    visibleAccountName: extraction.visibleAccountName,
    visiblePostUrl: extraction.visiblePostUrl,
    visibleTimestamp: extraction.visibleTimestamp,
    clarificationSources,
    timeline,
    privacyGuarantee:
      "Hanya menganalisis handle dan URL publik yang terlihat pada screenshot serta sumber terbuka (OSINT). KLAIMSCAN AI tidak pernah mengklaim mengetahui IP pribadi, alamat rumah, lokasi presisi, atau identitas hukum pengunggah.",
    attributionCaveat:
      "Postingan publik paling awal yang teramati tidak dianggap sebagai penulis asli atau pembuat pertama klaim.",
  };
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
