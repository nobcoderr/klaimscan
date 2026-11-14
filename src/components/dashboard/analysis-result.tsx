"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowRight,
  Clock,
  ExternalLink,
  FileText,
  Globe2,
  Highlighter,
  Layers,
  Lock,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type EvidenceSource,
  type EvidenceNature,
  type EvidenceTargetAspect,
  type InvestigationReport,
  type OcrRegionRole,
  type OcrTextRegion,
  type TemporalVerificationStatus,
  TEXT_VERIFICATION_NOTICE,
} from "@/lib/types";
import { cn, formatWibTimestamp } from "@/lib/utils";
import {
  ClaimReading,
  EvidenceRelationBadge,
  getVerdictStyle,
  PostStanceBadge,
  SourceTierBadge,
  VerdictBadge,
} from "./verdict-badges";

export type ResultViewTab =
  | "assessment"
  | "evidence"
  | "timeline"
  | "trace";

interface AnalysisResultProps {
  report: InvestigationReport;
  screenshotPreviewUrl?: string;
  activeTab?: ResultViewTab;
  onTabChange?: (tab: ResultViewTab) => void;
}

function formatAspectLabel(aspect?: EvidenceTargetAspect): string | null {
  switch (aspect) {
    case "image_authenticity":
      return "Aspek: Foto Sampul (Dikecualikan)";
    case "event_occurrence":
      return "Aspek: Kejadian / Niat";
    case "status_or_stage":
      return "Aspek: Status / Tahap";
    case "plan_or_target":
      return "Aspek: Rencana / Target";
    case "implementation_or_outcome":
      return "Aspek: Implementasi / Hasil";
    case "text_claim":
      return "Aspek: Klaim Teks";
    default:
      return null;
  }
}

function formatTemporalLabel(
  status?: TemporalVerificationStatus
): string | null {
  switch (status) {
    case "historical_debunk":
      return "Temporal: Klarifikasi Lama Dikecualikan";
    case "date_mismatch":
      return "Temporal: Beda Periode";
    case "current_match":
      return "Temporal: Sesuai Periode";
    default:
      return null;
  }
}

function formatEvidenceNatureLabel(nature?: EvidenceNature): string {
  switch (nature) {
    case "primary_record":
      return "Rekaman primer";
    case "direct_statement":
      return "Pernyataan langsung";
    case "original_research":
      return "Penelitian asli";
    case "institutional_data":
      return "Data institusi";
    case "independent_reporting":
      return "Pelaporan independen";
    case "fact_check":
      return "Pemeriksaan fakta";
    case "commentary":
      return "Komentar";
    default:
      return "Jenis bukti belum dipastikan";
  }
}

function formatOcrMapLabel(role: OcrRegionRole): string {
  switch (role) {
    case "headline":
      return "HEADLINE";
    case "graphic_overlay":
      return "OVERLAY";
    case "caption":
      return "CAPTION";
    case "publisher":
      return "AKUN";
    case "date":
      return "TANGGAL";
    case "debunk_note":
      return "BANTAHAN";
    default:
      return "OCR";
  }
}

function formatOcrRoleLabel(role: OcrRegionRole): string {
  switch (role) {
    case "headline":
      return "HEADLINE";
    case "graphic_overlay":
      return "OVERLAY GRAFIS";
    case "caption":
      return "CAPTION";
    case "publisher":
      return "PUBLISHER / AKUN";
    case "date":
      return "TANGGAL";
    case "debunk_note":
      return "CATATAN BANTAHAN";
    default:
      return "OCR";
  }
}

function getQualifiedLabelVariant(
  label: string
): "verified" | "threat" | "warning" | "outdated" | "default" {
  const upper = label.toUpperCase();
  if (upper.includes("DIBANTAH")) return "threat";
  if (upper.includes("TERKONFIRMASI")) {
    return "verified";
  }
  if (upper.includes("KEDALUWARSA")) return "outdated";
  if (upper.includes("MENYESATKAN") || upper.includes("PARSIAL")) {
    return "warning";
  }
  return "default";
}

function EvidenceGroupList({
  title,
  emptyLabel,
  items,
  accentClass,
}: {
  title: string;
  emptyLabel: string;
  items: EvidenceSource[];
  accentClass: string;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className={cn("font-heading text-sm font-semibold", accentClass)}>
          {title} ({items.length})
        </h4>
      </div>
      {items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background/45 p-4 text-xs text-muted-foreground">
          {emptyLabel}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((src) => (
            <div
              key={`${src.id}-${src.url}`}
              className="rounded-xl border border-border bg-background/75 p-4 transition-colors hover:border-primary/45"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-primary">
                      {src.id}
                    </span>
                    <SourceTierBadge tier={src.sourceTier} />
                    <EvidenceRelationBadge relation={src.relation} />
                    {formatAspectLabel(src.targetAspect) && (
                      <Badge
                        variant={
                          src.targetAspect === "image_authenticity"
                            ? "warning"
                            : "outline"
                        }
                      >
                        {formatAspectLabel(src.targetAspect)}
                      </Badge>
                    )}
                    {src.evaluatedAtomicClaimId && (
                      <Badge variant="secondary">
                        {src.evaluatedAtomicClaimId}
                      </Badge>
                    )}
                    {src.publishedAt && (
                      <Badge variant="outline">
                        {src.publicationDateBasis === "verified"
                          ? "Terbit terverifikasi"
                          : "Terbit belum diverifikasi"}
                        : {src.publishedAt}
                      </Badge>
                    )}
                    {!src.publishedAt && src.inferredPublishedAt && (
                      <Badge variant="outline">
                        Terbit diperkirakan dari URL: {src.inferredPublishedAt}
                      </Badge>
                    )}
                    {src.sourceEventDate && (
                      <Badge variant="outline">
                        Tanggal peristiwa{" "}
                        {src.sourceEventDateBasis === "reported"
                          ? "(disebut sumber)"
                          : src.sourceEventDateBasis === "inferred"
                            ? "(perkiraan)"
                            : "(belum diketahui)"}
                        : {src.sourceEventDate}
                      </Badge>
                    )}
                    {src.temporalStatus &&
                      src.temporalStatus !== "unclear" &&
                      src.temporalStatus !== "current_match" &&
                      formatTemporalLabel(src.temporalStatus) && (
                        <Badge variant="warning">
                          {formatTemporalLabel(src.temporalStatus)}
                        </Badge>
                      )}
                    {src.ratingText && (
                      <Badge variant="outline">Rating: {src.ratingText}</Badge>
                    )}
                  </div>
                  <h5 className="font-heading text-sm font-semibold text-foreground">
                    {src.title}
                  </h5>
                </div>
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 font-mono text-xs text-primary hover:border-primary/60"
                >
                  <span>{src.domain}</span>
                  <ExternalLink className="size-3" />
                </a>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] text-muted-foreground">
                <Badge variant="outline">
                  {formatEvidenceNatureLabel(src.evidenceNature)}
                </Badge>
                <Badge variant="outline">
                  {src.independence === "syndicated"
                    ? "Sindikasi / bukan independen"
                    : src.independence === "independent"
                      ? "Independensi dinilai"
                      : "Independensi belum diketahui"}
                </Badge>
                {src.excerptBasis === "ai_search_summary" && (
                  <span>Ringkasan hasil pencarian AI, bukan kutipan artikel.</span>
                )}
                {src.excerptBasis === "fact_check_api_metadata" && (
                  <span>Metadata API pemeriksa fakta, bukan kutipan isi artikel.</span>
                )}
                {src.excerptBasis === "direct_source_content" && (
                  <span>Isi sumber asli diperiksa langsung.</span>
                )}
                {src.excerptBasis === "url_only" && (
                  <span>Judul/URL saja; isi sumber belum diperiksa.</span>
                )}
              </div>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                {src.snippet}
              </p>
              <p className="mt-2 border-t border-border/50 pt-2 text-xs text-foreground/85">
                <strong className="font-mono text-primary">
                  Klaim yang dievaluasi:
                </strong>{" "}
                {src.claimEvaluated} — {src.rationale}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function OcrHighlightViewer({
  screenshotPreviewUrl,
  regions,
  selectedRegionId,
  onSelectRegion,
}: {
  screenshotPreviewUrl?: string;
  regions: OcrTextRegion[];
  selectedRegionId: string | null;
  onSelectRegion: (id: string) => void;
}) {
  const activeRegion =
    regions.find((r) => r.id === selectedRegionId) ?? regions[0] ?? null;

  const viewportRef = React.useRef<HTMLDivElement>(null);
  const imgRef = React.useRef<HTMLImageElement>(null);
  const [viewportWidth, setViewportWidth] = React.useState(0);
  const [naturalSize, setNaturalSize] = React.useState<{
    src: string;
    width: number;
    height: number;
  } | null>(null);

  React.useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const measure = () => {
      const innerW = Math.max(0, el.clientWidth - 16);
      setViewportWidth(innerW);
      const img = imgRef.current;
      if (
        screenshotPreviewUrl &&
        img &&
        img.complete &&
        img.naturalWidth > 0 &&
        img.naturalHeight > 0
      ) {
        setNaturalSize((prev) =>
          prev &&
          prev.src === screenshotPreviewUrl &&
          prev.width === img.naturalWidth &&
          prev.height === img.naturalHeight
            ? prev
            : {
                src: screenshotPreviewUrl,
                width: img.naturalWidth,
                height: img.naturalHeight,
              }
        );
      }
    };

    const rafId = requestAnimationFrame(measure);
    if (typeof ResizeObserver === "undefined") {
      return () => cancelAnimationFrame(rafId);
    }
    const observer = new ResizeObserver(() => {
      measure();
    });
    observer.observe(el);
    return () => {
      cancelAnimationFrame(rafId);
      observer.disconnect();
    };
  }, [screenshotPreviewUrl]);

  const handleImageLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    if (!screenshotPreviewUrl) return;
    const img = e.currentTarget;
    if (img.naturalWidth > 0 && img.naturalHeight > 0) {
      setNaturalSize({
        src: screenshotPreviewUrl,
        width: img.naturalWidth,
        height: img.naturalHeight,
      });
    }
    if (viewportRef.current) {
      setViewportWidth(Math.max(0, viewportRef.current.clientWidth - 16));
    }
  };

  let frameStyle: React.CSSProperties | undefined;
  if (
    screenshotPreviewUrl &&
    naturalSize &&
    naturalSize.src === screenshotPreviewUrl &&
    naturalSize.width > 0 &&
    naturalSize.height > 0 &&
    viewportWidth > 0
  ) {
    const MAX_PREVIEW_HEIGHT = 440;
    const aspect = naturalSize.width / naturalSize.height;
    let width = viewportWidth;
    let height = width / aspect;
    if (height > MAX_PREVIEW_HEIGHT) {
      height = MAX_PREVIEW_HEIGHT;
      width = height * aspect;
    }
    frameStyle = {
      width: `${Math.round(width)}px`,
      height: `${Math.round(height)}px`,
    };
  }

  return (
    <div className="flex flex-col justify-between rounded-xl border border-border bg-background/85 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Highlighter className="size-4 text-primary" />
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-primary">
            OCR Text Highlight
          </p>
        </div>
        <Badge variant="outline" className="text-[10px]">
          {screenshotPreviewUrl
            ? "Screenshot Sesi Aktif"
            : "Peta Koordinat OCR (Demo / Tanpa Gambar Server)"}
        </Badge>
      </div>

      <div
        ref={viewportRef}
        className="relative flex w-full justify-center overflow-hidden rounded-lg border border-border bg-background p-2"
      >
        {screenshotPreviewUrl ? (
          <div
            style={frameStyle}
            className={cn(
              "relative shrink-0",
              !frameStyle && "inline-block max-w-full"
            )}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              ref={imgRef}
              src={screenshotPreviewUrl}
              alt="Screenshot yang dianalisis dengan sorotan OCR"
              onLoad={handleImageLoad}
              className={
                frameStyle
                  ? "block h-full w-full select-none rounded-[2px]"
                  : "block h-auto max-h-[440px] w-auto max-w-full select-none rounded-[2px]"
              }
            />
            {frameStyle &&
              regions.map((region) => {
                const isSelected = activeRegion?.id === region.id;
                return (
                  <button
                    key={region.id}
                    type="button"
                    onClick={() => onSelectRegion(region.id)}
                    title={`${formatOcrRoleLabel(region.role)}: ${region.text}`}
                    aria-label={`Sorot wilayah OCR ${formatOcrRoleLabel(region.role)}`}
                    style={{
                      left: `${(region.bbox.x / 10).toFixed(1)}%`,
                      top: `${(region.bbox.y / 10).toFixed(1)}%`,
                      width: `${(region.bbox.width / 10).toFixed(1)}%`,
                      height: `${(region.bbox.height / 10).toFixed(1)}%`,
                    }}
                    className={cn(
                      "absolute cursor-pointer rounded transition-all",
                      isSelected
                        ? "z-20 border-2 border-primary bg-primary/20 shadow-sm"
                        : "z-10 border border-verdict-true/55 bg-verdict-true/10 hover:border-primary"
                    )}
                  >
                    {isSelected && (
                      <span
                        className={cn(
                          "pointer-events-none absolute whitespace-nowrap rounded bg-background/95 px-1.5 py-0.5 font-mono text-[9px] font-bold text-primary shadow",
                          region.bbox.y < 85 ? "top-full mt-1" : "-top-5",
                          region.bbox.x > 680 ? "right-0" : "left-0"
                        )}
                      >
                        {formatOcrRoleLabel(region.role)}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
        ) : (
          <div className="w-full">
            <p className="mb-2 text-center font-mono text-[10px] tracking-wide text-muted-foreground">
              Area foto sampul diabaikan. Peta ini hanya menunjukkan posisi teks.
            </p>
            <div className="relative aspect-[16/10] w-full bg-background">
              {regions.map((region) => {
                const isSelected = activeRegion?.id === region.id;
                return (
                  <button
                    key={region.id}
                    type="button"
                    onClick={() => onSelectRegion(region.id)}
                    title={`${formatOcrRoleLabel(region.role)}: ${region.text}`}
                    aria-label={`Sorot wilayah OCR ${formatOcrRoleLabel(region.role)}`}
                    style={{
                      left: `${(region.bbox.x / 10).toFixed(1)}%`,
                      top: `${(region.bbox.y / 10).toFixed(1)}%`,
                      width: `${(region.bbox.width / 10).toFixed(1)}%`,
                      height: `${(region.bbox.height / 10).toFixed(1)}%`,
                    }}
                    className={cn(
                      "absolute box-border flex min-h-0 cursor-pointer items-center overflow-hidden rounded px-1.5 text-left leading-none",
                      isSelected
                        ? "z-20 border-2 border-primary bg-accent text-foreground"
                        : "z-10 border border-border bg-card text-muted-foreground hover:border-primary/60"
                    )}
                  >
                    <span className="truncate font-mono text-[10px] leading-none">
                      {formatOcrMapLabel(region.role)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {regions.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {regions.map((region) => {
              const isSelected = activeRegion?.id === region.id;
              return (
                <button
                  key={`chip-${region.id}`}
                  type="button"
                  onClick={() => onSelectRegion(region.id)}
                  className={cn(
                    "cursor-pointer rounded-md border px-2 py-1 font-mono text-[10px] transition-colors",
                    isSelected
                      ? "border-primary bg-secondary text-primary"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  )}
                >
                  {formatOcrRoleLabel(region.role)}
                </button>
              );
            })}
          </div>
          {activeRegion && (
            <div className="rounded-lg border border-primary/35 bg-background/90 px-3 py-2 text-xs">
              <span className="font-mono text-[10px] font-semibold uppercase text-primary">
                {formatOcrRoleLabel(activeRegion.role)} TERPILIH:
              </span>
              <p className="mt-0.5 text-foreground">{activeRegion.text}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export function AnalysisResult({
  report,
  screenshotPreviewUrl,
  activeTab = "assessment",
  onTabChange,
}: AnalysisResultProps) {
  const verdictStyle = getVerdictStyle(report.verdict.claimVerdict);
  const VerdictIcon = verdictStyle.Icon;

  const ocrRegions = React.useMemo(
    () => report.claimExtraction.ocr?.ocrRegions ?? [],
    [report.claimExtraction.ocr]
  );

  const defaultRegionId =
    ocrRegions.find((r) => r.role === "headline")?.id ??
    ocrRegions[0]?.id ??
    null;

  const [regionSelection, setRegionSelection] = React.useState<{
    caseId: string;
    regionId: string | null;
  }>({ caseId: report.caseId, regionId: defaultRegionId });

  const selectedRegionId =
    regionSelection.caseId === report.caseId
      ? regionSelection.regionId
      : defaultRegionId;

  const setSelectedRegionId = (regionId: string | null) => {
    setRegionSelection({ caseId: report.caseId, regionId });
  };

  const highlightByRoles = (roles: OcrRegionRole[]) => {
    const match = ocrRegions.find((r) => roles.includes(r.role));
    if (match) setSelectedRegionId(match.id);
  };

  const verificationNotice =
    report.claimExtraction.textVerificationNotice || TEXT_VERIFICATION_NOTICE;

  const extractedHeadline =
    report.claimExtraction.extractedHeadline ||
    report.claimExtraction.primaryClaim;

  const extractedCaption = report.claimExtraction.extractedCaption;
  const graphicOverlays = report.claimExtraction.graphicOverlayTexts ?? [];
  const normalizedClaims = report.claimExtraction.normalizedClaims ?? [];

  return (
    <div className="space-y-8">
      {report.isDemo && (
        <Alert variant="cyber">
          <AlertTriangle className="size-4 text-primary" />
          <AlertTitle>
            DEMO MODE — Fixture Data ({report.demoCategoryLabel || "Demo Case"})
          </AlertTitle>
          <AlertDescription>
            Kasus ini adalah data demonstrasi offline terverifikasi untuk
            presentasi dan pengujian, bukan hasil pencarian live terhadap
            unggahan baru.
          </AlertDescription>
        </Alert>
      )}

      {report.warnings.length > 0 && (
        <Alert variant="warning">
          <AlertTriangle className="size-4 text-verdict-mislead" />
          <AlertTitle>Peringatan pada bukti ini</AlertTitle>
          <AlertDescription>
            <ul className="list-disc space-y-1 pl-4">
              {report.warnings.map((warning, index) => (
                <li key={`warn-${index}`}>{warning}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      {/* Dual Split Cards matching SOC Dashboard */}
      <div className="grid gap-4 md:grid-cols-2">
        <Card className={cn("border", verdictStyle.borderClass)}>
          <CardContent className="flex flex-col justify-between gap-4 pt-5">
            <div className="flex items-start justify-between gap-3">
              <p className="font-mono text-[11px] text-muted-foreground">
                {report.caseId}{" "}
                {report.isDemo ? "• DEMO FIXTURE" : "• LIVE EVIDENCE"}
              </p>
              <VerdictBadge verdict={report.verdict.claimVerdict} />
            </div>

            <ClaimReading verdict={report.verdict.claimVerdict} />

            <p className="text-sm font-medium leading-relaxed text-foreground">
              {report.claimExtraction.primaryClaim}
            </p>

            {report.verdict.qualifiedStatusLabels &&
              report.verdict.qualifiedStatusLabels.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {report.verdict.qualifiedStatusLabels.map((label) => (
                    <Badge
                      key={label}
                      variant={getQualifiedLabelVariant(label)}
                    >
                      {label}
                    </Badge>
                  ))}
                </div>
              )}

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 font-mono text-xs font-semibold tracking-wider",
                  verdictStyle.colorClass
                )}
              >
                <VerdictIcon className="size-4" />
                <span>{verdictStyle.shortCode}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>Sikap postingan:</span>
                <PostStanceBadge stance={report.verdict.postStance} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-border">
          <CardContent className="flex flex-col justify-between gap-4 pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-lg border border-verdict-true/35 bg-verdict-true/10 text-verdict-true">
                  <FileText className="size-5" />
                </div>
                <div>
                  <p className="font-heading text-base font-semibold text-foreground">
                    Evidence Trail
                  </p>
                  <p className="font-mono text-[11px] text-muted-foreground">
                    {report.supportingEvidence.length} mendukung ·{" "}
                    {report.contradictingEvidence.length} membantah ·{" "}
                    {report.partialContextEvidence.length} konteks parsial ·{" "}
                    {(report.insufficientEvidence ??
                      report.evidenceSources.filter(
                        (source) => source.relation === "insufficient"
                      )).length}{" "}
                    bukti belum cukup
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <p className="text-xs leading-relaxed text-muted-foreground">
                {report.evidenceSources.some(
                  (source) => source.relation !== "irrelevant"
                )
                  ? "Sumber yang diperiksa; bukti belum cukup dibedakan dari sumber yang tidak relevan:"
                  : "Belum ditemukan sumber relevan yang cukup untuk membentuk penilaian."}
              </p>
              <div className="flex flex-wrap gap-2">
                {report.evidenceSources
                  .filter((source) => source.relation !== "irrelevant")
                  .map((source) => (
                    <a
                      key={`${source.id}-${source.url}`}
                      href={source.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="rounded-md border border-border bg-card px-2 py-1 text-xs text-primary hover:border-primary/60"
                    >
                      {source.publisher} · {source.relation}
                    </a>
                  ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-3">
              {report.verdict.evidenceMetrics.officialOrFactCheckCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold tracking-wider text-verdict-true">
                  <ShieldCheck className="size-4" />
                  EVIDENCE RETRIEVED (
                  {report.verdict.evidenceMetrics.officialOrFactCheckCount})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold tracking-wider text-primary">
                  <Clock className="size-4" />
                  INSUFFICIENT EVIDENCE • UNVERIFIED
                </span>
              )}
              <span className="font-mono text-xs text-muted-foreground">
                {formatWibTimestamp(report.checkedAt)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Explicit Debunking Stance Separation Alert */}
      {report.claimExtraction.postStance === "debunking_claim" && (
        <Alert variant="verified">
          <UserCheck className="size-4 text-verdict-true" />
          <AlertTitle>
            Pemisahan Klasifikasi Postingan vs Verdict Klaim Aktif
          </AlertTitle>
          <AlertDescription className="text-foreground/90">
            Klaim faktual berstatus{" "}
            <strong className="text-verdict-false">
              {report.verdict.claimVerdict}
            </strong>
            , sedangkan akun publik{" "}
            <code className="font-mono text-primary">
              {report.claimExtraction.visibleAccountHandle || "pada screenshot"}
            </code>{" "}
            berperan{" "}
            <strong className="text-verdict-true">
              {report.verdict.postClassification}
            </strong>
            . Sistem tidak melabeli akun pemeriksa fakta sebagai pembuat hoaks.
          </AlertDescription>
        </Alert>
      )}

      {/* Detailed Forensic Investigation Tabs */}
      <Tabs
        value={activeTab}
        onValueChange={(v) => onTabChange?.(v as ResultViewTab)}
        className="space-y-4"
      >
        <TabsList aria-label="Bagian hasil">
          <TabsTrigger value="assessment">Ringkasan</TabsTrigger>
          <TabsTrigger value="evidence">Bukti</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
          <TabsTrigger value="trace">Jejak Publik</TabsTrigger>
        </TabsList>

        <TabsContent value="assessment" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>Klaim, sikap postingan, dan teks yang terbaca</CardTitle>
                <Badge variant="default">TEXT-FIRST NEWS VERIFICATION</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Mandatory Text-First Notice */}
              <div className="space-y-2 text-xs">
                <p className="leading-relaxed text-muted-foreground">
                  {verificationNotice}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  <Badge variant="outline">
                    Topik: {report.claimExtraction.topicCategory}
                  </Badge>
                  {report.claimExtraction.claimDateMentioned && (
                    <Badge variant="outline">
                      Indikator Waktu: {report.claimExtraction.claimDateMentioned}
                    </Badge>
                  )}
                </div>
              </div>

              {/* Phase 5 Grid: EXTRACTED HEADLINE + EXTRACTED CAPTION + Interactive OCR Highlight */}
              <div
                className={cn(
                  "grid gap-4",
                  screenshotPreviewUrl || ocrRegions.length > 0
                    ? "lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]"
                    : "md:grid-cols-2"
                )}
              >
                <div className="space-y-3">
                  {/* 1. EXTRACTED HEADLINE */}
                  <div
                    role={
                      ocrRegions.some(
                        (r) =>
                          r.role === "headline" || r.role === "graphic_overlay"
                      )
                        ? "button"
                        : undefined
                    }
                    tabIndex={
                      ocrRegions.some(
                        (r) =>
                          r.role === "headline" || r.role === "graphic_overlay"
                      )
                        ? 0
                        : undefined
                    }
                    onClick={() =>
                      highlightByRoles(["headline", "graphic_overlay"])
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        highlightByRoles(["headline", "graphic_overlay"]);
                      }
                    }}
                    className={cn(
                      "rounded-lg border border-border bg-background/80 p-4 transition-colors",
                      ocrRegions.some(
                        (r) =>
                          r.role === "headline" || r.role === "graphic_overlay"
                      ) && "cursor-pointer hover:border-primary/65"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-primary">
                        EXTRACTED HEADLINE
                      </p>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        Teks Utama / Overlay Gambar
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-foreground">
                      {extractedHeadline}
                    </p>
                    {graphicOverlays.length > 0 && (
                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                        {graphicOverlays.map((overlay, idx) => (
                          <Badge key={`overlay-${idx}`} variant="outline">
                            Overlay: {overlay}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* 2. EXTRACTED CAPTION */}
                  <div
                    role={
                      ocrRegions.some((r) => r.role === "caption")
                        ? "button"
                        : undefined
                    }
                    tabIndex={
                      ocrRegions.some((r) => r.role === "caption")
                        ? 0
                        : undefined
                    }
                    onClick={() => highlightByRoles(["caption", "debunk_note"])}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        highlightByRoles(["caption", "debunk_note"]);
                      }
                    }}
                    className={cn(
                      "rounded-lg border border-border bg-background/80 p-4 transition-colors",
                      ocrRegions.some((r) => r.role === "caption") &&
                        "cursor-pointer hover:border-primary/65"
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-primary">
                        EXTRACTED CAPTION
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {report.claimExtraction.captionTruncated && (
                          <Badge variant="warning">Caption Terpotong (...)</Badge>
                        )}
                        {report.claimExtraction.visibleAccountHandle && (
                          <Badge variant="secondary">
                            {report.claimExtraction.visibleAccountHandle}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                      {extractedCaption ||
                        "Tidak terdapat caption terpisah yang terbaca pada screenshot."}
                    </p>
                    {report.claimExtraction.clarificationOrDebunkText && (
                      <div className="mt-2.5 rounded-md border border-verdict-true/35 bg-verdict-true/10 px-2.5 py-1.5 text-xs text-verdict-true">
                        <strong>Catatan Klarifikasi Terlihat:</strong>{" "}
                        {report.claimExtraction.clarificationOrDebunkText}
                      </div>
                    )}
                    <details className="mt-2.5">
                      <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        Lihat Transkrip OCR Lengkap
                      </summary>
                      <p className="mt-1.5 whitespace-pre-wrap text-xs text-muted-foreground">
                        {report.claimExtraction.extractedText}
                      </p>
                    </details>
                  </div>
                </div>

                {/* Interactive OCR Text Highlight Box */}
                {(screenshotPreviewUrl || ocrRegions.length > 0) && (
                  <OcrHighlightViewer
                    screenshotPreviewUrl={screenshotPreviewUrl}
                    regions={ocrRegions}
                    selectedRegionId={selectedRegionId}
                    onSelectRegion={setSelectedRegionId}
                  />
                )}
              </div>

              {/* 3. NORMALIZED FACTUAL CLAIMS */}
              <div className="rounded-xl border border-border bg-background/75 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Layers className="size-4 text-primary" />
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-primary">
                      NORMALIZED FACTUAL CLAIMS
                    </p>
                  </div>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    Ekstraksi Proposisi Berbasis Teks (Tanpa Inferensi Foto)
                  </span>
                </div>

                {normalizedClaims.length > 0 ? (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {normalizedClaims.map((nc) => (
                      <div
                        key={nc.id}
                        className="rounded-lg border border-border/90 bg-background/80 p-3.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-xs font-semibold text-primary">
                            {nc.id}
                          </span>
                          <div className="flex flex-wrap gap-1.5">
                            <Badge variant="outline">
                              Sumber: {nc.sourceRole.toUpperCase()}
                            </Badge>
                            {nc.eventDate && (
                              <Badge variant="secondary">{nc.eventDate}</Badge>
                            )}
                          </div>
                        </div>
                        <p className="mt-2 text-xs font-semibold text-foreground">
                          {nc.proposition}
                        </p>
                        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
                          <div>
                            <dt className="font-mono text-[10px] uppercase">
                              Subjek
                            </dt>
                            <dd className="text-foreground/90">{nc.subject}</dd>
                          </div>
                          <div>
                            <dt className="font-mono text-[10px] uppercase">
                              Tindakan / Status
                            </dt>
                            <dd className="text-foreground/90">
                              {nc.predicateAction}
                            </dd>
                          </div>
                          <div>
                            <dt className="font-mono text-[10px] uppercase">
                              Objek / Target
                            </dt>
                            <dd className="text-foreground/90">
                              {nc.objectTarget}
                            </dd>
                          </div>
                          <div>
                            <dt className="font-mono text-[10px] uppercase">
                              Status Formal/Hukum
                            </dt>
                            <dd className="text-foreground/90">
                              {nc.legalOrAdministrativeStatus || "Tidak disebut"}
                            </dd>
                          </div>
                        </dl>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          <Badge variant="outline">
                            Polaritas: {nc.polarity ?? "belum ditentukan"}
                          </Badge>
                          <Badge variant="outline">
                            Modus: {nc.modality ?? "unknown"}
                          </Badge>
                          <Badge variant="outline">
                            Kepastian teks: {nc.epistemicCertainty ?? "unknown"}
                          </Badge>
                          <Badge variant="outline">
                            Jenis: {nc.assertionType ?? "unknown"}
                          </Badge>
                        </div>
                        {((nc.namedEntities?.length ?? 0) > 0 ||
                          (nc.numericValues?.length ?? 0) > 0 ||
                          (nc.geographicContext?.length ?? 0) > 0 ||
                          (nc.requiredConditions?.length ?? 0) > 0) && (
                          <dl className="mt-2 grid gap-1 border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
                            {(nc.namedEntities?.length ?? 0) > 0 && (
                              <div>
                                <dt className="inline font-mono text-[10px] uppercase">
                                  Entitas:
                                </dt>{" "}
                                <dd className="inline text-foreground/90">
                                  {nc.namedEntities?.join(", ")}
                                </dd>
                              </div>
                            )}
                            {(nc.numericValues?.length ?? 0) > 0 && (
                              <div>
                                <dt className="font-mono text-[10px] uppercase">
                                  Angka / satuan / kondisi
                                </dt>
                                <dd className="text-foreground/90">
                                  {nc.numericValues
                                    ?.map(
                                      (value) =>
                                        `${value.value}${value.unit ? ` ${value.unit}` : ""} — ${value.context}`
                                    )
                                    .join("; ")}
                                </dd>
                              </div>
                            )}
                            {(nc.geographicContext?.length ?? 0) > 0 && (
                              <div>
                                <dt className="inline font-mono text-[10px] uppercase">
                                  Geografi:
                                </dt>{" "}
                                <dd className="inline text-foreground/90">
                                  {nc.geographicContext?.join(", ")}
                                </dd>
                              </div>
                            )}
                            {(nc.requiredConditions?.length ?? 0) > 0 && (
                              <div>
                                <dt className="inline font-mono text-[10px] uppercase">
                                  Kondisi:
                                </dt>{" "}
                                <dd className="inline text-foreground/90">
                                  {nc.requiredConditions?.join("; ")}
                                </dd>
                              </div>
                            )}
                          </dl>
                        )}
                        {nc.semanticNote && (
                          <p className="mt-2 rounded bg-card px-2 py-1 text-[11px] text-verdict-mislead">
                            {nc.semanticNote}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted-foreground">
                    Proposisi utama: {report.claimExtraction.primaryClaim}
                  </p>
                )}

                {report.verdict.atomicAssessments &&
                  report.verdict.atomicAssessments.length > 0 && (
                    <div className="mt-4 border-t border-border/70 pt-3">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                        Status Verifikasi Per Proposisi Atomik
                      </p>
                      <div className="mt-2 grid gap-2.5 md:grid-cols-2">
                        {report.verdict.atomicAssessments.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-lg border border-border/80 bg-background/70 p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-mono text-xs text-primary">
                                {item.id} · {item.label}
                              </span>
                              <Badge
                                variant={getQualifiedLabelVariant(
                                  item.statusLabel
                                )}
                              >
                                {item.statusLabel}
                              </Badge>
                            </div>
                            <p className="mt-1.5 text-xs font-medium text-foreground">
                              {item.proposition}
                            </p>
                            <p className="mt-1 text-[11px] text-muted-foreground">
                              {item.rationale}
                              {item.evidenceIds.length > 0
                                ? ` (${item.evidenceIds.join(", ")})`
                                : ""}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>

              {/* 4. FACT CHECK VERDICT */}
              <div className="rounded-xl border border-border bg-background/75 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-primary">
                    FACT CHECK VERDICT
                  </p>
                  <VerdictBadge verdict={report.verdict.claimVerdict} />
                </div>
                <p className="mt-2 text-sm leading-relaxed text-foreground">
                  {report.verdict.explanation}
                </p>
                <p className="mt-2 text-xs text-muted-foreground">
                  <strong className="text-foreground">Sikap postingan:</strong>{" "}
                  {report.verdict.postClassification} —{" "}
                  {report.claimExtraction.postStanceSummary}
                </p>
              </div>

              <Separator />

                            <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-border bg-background/70 px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">
                    Bukti yang dibandingkan
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {report.supportingEvidence.length} mendukung ·{" "}
                    {report.contradictingEvidence.length} membantah ·{" "}
                    {report.partialContextEvidence.length} konteks parsial ·{" "}
                    {(report.insufficientEvidence ??
                      report.evidenceSources.filter(
                        (source) => source.relation === "insufficient"
                      )).length}{" "}
                    belum cukup
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onTabChange?.("evidence")}
                >
                  Buka bukti
                  <ArrowRight className="size-3.5" />
                </Button>
              </div>

{/* 6 & 7 Quick Summary Cards: VERIFICATION TIMELINE & PUBLIC SOURCE TRACE */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-border bg-background/70 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-primary">
                      VERIFICATION TIMELINE
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onTabChange?.("timeline")}
                      className="h-7 px-2 font-mono text-[11px] text-primary"
                    >
                      Buka timeline
                      <ArrowRight className="size-3" />
                    </Button>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    {report.publicOriginTrace.timeline.length} titik jejak
                    kronologis tercatat (postingan teramati, sumber rujukan, &amp;
                    audit AI).
                  </p>
                </div>

                <div className="rounded-xl border border-border bg-background/70 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-primary">
                      PUBLIC SOURCE TRACE
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onTabChange?.("trace")}
                      className="h-7 px-2 font-mono text-[11px] text-primary"
                    >
                      Buka jejak
                      <ArrowRight className="size-3" />
                    </Button>
                  </div>
                  <p className="mt-1.5 text-xs text-muted-foreground">
                    Platform: {report.publicOriginTrace.platform} · Handle:{" "}
                    {report.publicOriginTrace.visibleAccountHandle ||
                      "Tidak terlihat"}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-border bg-background/70 p-4">
                <p className="font-mono text-xs uppercase tracking-wider text-verdict-mislead">
                  Batasan Analisis (Clear Limitations)
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-muted-foreground">
                  {report.limitations.map((lim, idx) => (
                    <li key={idx}>{lim}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

                <TabsContent value="evidence" className="space-y-4">
          <Card>
            <CardContent className="space-y-4 pt-6">
{/* 5. EVIDENCE SOURCES */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-primary">
                    EVIDENCE SOURCES
                  </p>
                  <span className="font-mono text-[11px] text-muted-foreground">
                    {report.supportingEvidence.length} mendukung ·{" "}
                    {report.contradictingEvidence.length} membantah ·{" "}
                    {report.partialContextEvidence.length} konteks
                  </span>
                </div>

                {report.evidenceSources.length === 0 ? (
                  <Alert variant="cyber">
                    <ShieldAlert className="size-4 text-primary" />
                    <AlertTitle>
                      Bukti Tidak Mencukupi — Status UNVERIFIED
                    </AlertTitle>
                    <AlertDescription>
                      Tidak ditemukan URL sumber resmi atau pemeriksa fakta yang
                      memadai untuk mendukung maupun membantah klaim ini. Sesuai
                      aturan verifikasi, tidak ada kutipan atau skor probabilitas
                      yang direkayasa.
                    </AlertDescription>
                  </Alert>
                ) : (
                  <div className="grid gap-5 lg:grid-cols-2">
                    <EvidenceGroupList
                      title="Supporting Evidence (Mendukung Klaim)"
                      emptyLabel="Tidak ada sumber terindeks yang mendukung klaim ini."
                      items={report.supportingEvidence}
                      accentClass="text-verdict-true"
                    />
                    <EvidenceGroupList
                      title="Contradicting Evidence (Membantah Klaim)"
                      emptyLabel="Tidak ada sumber terindeks yang membantah klaim ini."
                      items={report.contradictingEvidence}
                      accentClass="text-verdict-false"
                    />
                  </div>
                )}

                {report.partialContextEvidence.length > 0 && (
                  <EvidenceGroupList
                    title="Partial / Outdated Context Evidence"
                    emptyLabel=""
                    items={report.partialContextEvidence}
                    accentClass="text-verdict-mislead"
                  />
                )}

                {(report.insufficientEvidence ??
                  report.evidenceSources.filter(
                    (source) => source.relation === "insufficient"
                  )).length > 0 && (
                  <EvidenceGroupList
                    title="Insufficient Evidence (Terkait, Bukti Belum Cukup)"
                    emptyLabel=""
                    items={
                      report.insufficientEvidence ??
                      report.evidenceSources.filter(
                        (source) => source.relation === "insufficient"
                      )
                    }
                    accentClass="text-muted-foreground"
                  />
                )}

                {report.evidenceSources.some(
                  (s) => s.relation === "irrelevant"
                ) && (
                  <details className="rounded-xl border border-border bg-background/65 p-4">
                    <summary className="cursor-pointer font-mono text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Sumber Dikecualikan / Foto Sampul / Klarifikasi Lama (
                      {
                        report.evidenceSources.filter(
                          (s) => s.relation === "irrelevant"
                        ).length
                      }
                      )
                    </summary>
                    <div className="mt-3 space-y-2.5">
                      {report.evidenceSources
                        .filter((s) => s.relation === "irrelevant")
                        .map((src) => (
                          <div
                            key={`excluded-${src.id}-${src.url}`}
                            className="rounded-lg border border-border/70 bg-background/70 p-3 text-xs text-muted-foreground"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-primary">
                                {src.id}
                              </span>
                              <SourceTierBadge tier={src.sourceTier} />
                              {formatAspectLabel(src.targetAspect) && (
                                <Badge variant="warning">
                                  {formatAspectLabel(src.targetAspect)}
                                </Badge>
                              )}
                              {formatTemporalLabel(src.temporalStatus) && (
                                <Badge variant="warning">
                                  {formatTemporalLabel(src.temporalStatus)}
                                </Badge>
                              )}
                              {src.publishedAt && (
                                <Badge variant="outline">
                                  Tgl: {src.publishedAt}
                                </Badge>
                              )}
                            </div>
                            <p className="mt-1 font-medium text-foreground">
                              {src.title}
                            </p>
                            <p className="mt-1">{src.rationale}</p>
                          </div>
                        ))}
                    </div>
                  </details>
                )}
              </div>

                          </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Evidence Timeline &amp; Chronological Audit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Urutan kronologis peristiwa publik yang teramati pada
                screenshot, publikasi klarifikasi/fact-check terindeks, dan
                waktu pemeriksaan KLAIMSCAN AI.
              </p>

              <ol className="relative ml-2 space-y-4 border-l border-border pl-6">
                {report.publicOriginTrace.timeline.map((evt) => (
                  <li key={evt.id} className="relative">
                    <span
                      className={cn(
                        "absolute -left-[29px] top-1 flex size-3 rounded-full border-2 border-background",
                        evt.eventType === "official_statement"
                          ? "bg-verdict-true"
                          : evt.eventType === "fact_check_prior"
                            ? "bg-primary"
                            : evt.eventType === "verification_run"
                              ? "bg-verdict-mislead"
                              : "bg-muted-foreground"
                      )}
                    />
                    <div className="rounded-lg border border-border bg-background/75 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-xs text-primary">
                          {evt.timestampLabel}
                        </span>
                        {evt.sourceUrl && (
                          <a
                            href={evt.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-[11px] text-verdict-true hover:underline"
                          >
                            <Globe2 className="size-3" />
                            Buka Sumber
                          </a>
                        )}
                      </div>
                      <p className="mt-1 font-heading text-sm font-semibold text-foreground">
                        {evt.title}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {evt.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trace" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Public Source Trace (OSINT Terbatas)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <Alert variant="cyber">
                <Lock className="size-4 text-primary" />
                <AlertTitle>Batasan Privasi &amp; Non-Atribusi</AlertTitle>
                <AlertDescription className="space-y-1">
                  <p>{report.publicOriginTrace.privacyGuarantee}</p>
                  <p className="font-medium text-verdict-mislead">
                    {report.publicOriginTrace.attributionCaveat}
                  </p>
                </AlertDescription>
              </Alert>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-border bg-background/80 p-3">
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">
                    Platform Terlihat
                  </span>
                  <p className="mt-1 font-heading text-sm font-semibold text-foreground">
                    {report.publicOriginTrace.platform}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-background/80 p-3">
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">
                    Username / Handle Publik
                  </span>
                  <p className="mt-1 font-mono text-sm text-primary">
                    {report.publicOriginTrace.visibleAccountHandle ||
                      "Tidak terlihat"}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-background/80 p-3">
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">
                    Indikator Waktu Terlihat
                  </span>
                  <p className="mt-1 font-mono text-sm text-foreground">
                    {report.publicOriginTrace.visibleTimestamp ||
                      "Tidak tercantum"}
                  </p>
                </div>
                <div className="rounded-lg border border-border bg-background/80 p-3">
                  <span className="font-mono text-[10px] uppercase text-muted-foreground">
                    URL Publik Terlihat
                  </span>
                  {report.publicOriginTrace.visiblePostUrl ? (
                    <a
                      href={report.publicOriginTrace.visiblePostUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block truncate font-mono text-xs text-primary underline"
                    >
                      {report.publicOriginTrace.visiblePostUrl}
                    </a>
                  ) : (
                    <p className="mt-1 font-mono text-xs text-muted-foreground">
                      Tidak terlihat pada screenshot
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="mb-2 font-heading text-sm font-semibold text-foreground">
                  Sumber Resmi &amp; Pemeriksa Fakta Terobservasi
                </h4>
                {report.publicOriginTrace.clarificationSources.length === 0 ? (
                  <p className="text-xs text-muted-foreground">
                    Belum ada sumber klarifikasi publik terverifikasi yang
                    tercatat.
                  </p>
                ) : (
                  <div className="grid gap-3 sm:grid-cols-2">
                    {report.publicOriginTrace.clarificationSources.map((s) => (
                      <a
                        key={s.url}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between rounded-lg border border-border bg-background/75 p-3 hover:border-primary/60"
                      >
                        <div>
                          <p className="text-xs font-semibold text-foreground">
                            {s.publisher}
                          </p>
                          <p className="font-mono text-[11px] text-primary">
                            {s.url}
                          </p>
                        </div>
                        <ExternalLink className="size-3.5 shrink-0 text-muted-foreground" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

      </Tabs>
    </div>
  );
}
