"use client";

import * as React from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Fingerprint,
  Globe2,
  Highlighter,
  Layers,
  Lock,
  Printer,
  ShieldAlert,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  type EvidenceSource,
  type EvidenceTargetAspect,
  type InvestigationReport,
  type OcrRegionRole,
  type OcrTextRegion,
  type TemporalVerificationStatus,
  TEXT_VERIFICATION_NOTICE,
} from "@/lib/types";
import { cn, formatWibTimestamp } from "@/lib/utils";
import {
  EvidenceRelationBadge,
  getVerdictStyle,
  PostStanceBadge,
  SourceTierBadge,
  VerdictBadge,
} from "./verdict-badges";

export type ResultViewTab = "assessment" | "timeline" | "trace" | "report";

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
    case "official_legal_status":
      return "Aspek: Proses Formal / Hukum";
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
): "verified" | "threat" | "warning" | "default" {
  const upper = label.toUpperCase();
  if (upper.includes("FALSE")) return "threat";
  if (upper.includes("CONFIRMED") || upper.includes("AUTHENTIC")) {
    return "verified";
  }
  if (upper.includes("MISLEADING") || upper.includes("OUTDATED")) {
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
        <div className="rounded-xl border border-dashed border-[#254159] bg-[#07111E]/45 p-4 text-xs text-[#8BA4C0]">
          {emptyLabel}
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((src) => (
            <div
              key={`${src.id}-${src.url}`}
              className="rounded-xl border border-[#254159] bg-[#07111E]/75 p-4 transition-colors hover:border-[#45DDEB]/45"
            >
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs text-[#45DDEB]">
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
                      <Badge variant="outline">Tgl: {src.publishedAt}</Badge>
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
                  <h5 className="font-heading text-sm font-semibold text-[#F3F8FF]">
                    {src.title}
                  </h5>
                </div>
                <a
                  href={src.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-md border border-[#254159] bg-[#0D2133] px-2.5 py-1 font-mono text-xs text-[#45DDEB] hover:border-[#45DDEB]/60"
                >
                  <span>{src.domain}</span>
                  <ExternalLink className="size-3" />
                </a>
              </div>

              <p className="mt-2 text-xs leading-relaxed text-[#8BA4C0]">
                {src.snippet}
              </p>
              <p className="mt-2 border-t border-[#254159]/50 pt-2 text-xs text-[#F3F8FF]/85">
                <strong className="font-mono text-[#45DDEB]">
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
    <div className="flex flex-col justify-between rounded-xl border border-[#254159] bg-[#07111E]/85 p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Highlighter className="size-4 text-[#45DDEB]" />
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#45DDEB]">
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
        className="relative flex w-full justify-center overflow-hidden rounded-lg border border-[#254159] bg-[#040B14] p-2"
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
                        ? "z-20 border-2 border-[#45DDEB] bg-[#45DDEB]/20 shadow-[0_0_20px_rgba(69,221,235,0.55)]"
                        : "z-10 border border-[#34D399]/55 bg-[#34D399]/10 hover:border-[#45DDEB]"
                    )}
                  >
                    {isSelected && (
                      <span
                        className={cn(
                          "pointer-events-none absolute whitespace-nowrap rounded bg-[#07111E]/95 px-1.5 py-0.5 font-mono text-[9px] font-bold text-[#45DDEB] shadow",
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
          <div className="relative aspect-[16/10] w-full bg-[#050E19]">
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center px-4 text-center font-mono text-[10px] tracking-wider text-[#8BA4C0]/40">
              AREA FOTO SAMPUL DIABAIKAN • VERIFIKASI KLAIM TEKSTUAL SAJA
            </div>
            {regions.map((region) => {
              const isSelected = activeRegion?.id === region.id;
              return (
                <button
                  key={region.id}
                  type="button"
                  onClick={() => onSelectRegion(region.id)}
                  style={{
                    left: `${(region.bbox.x / 10).toFixed(1)}%`,
                    top: `${(region.bbox.y / 10).toFixed(1)}%`,
                    width: `${(region.bbox.width / 10).toFixed(1)}%`,
                    height: `${(region.bbox.height / 10).toFixed(1)}%`,
                  }}
                  className={cn(
                    "absolute flex cursor-pointer items-center justify-start overflow-hidden rounded px-2 text-left transition-all",
                    isSelected
                      ? "z-20 border-2 border-[#45DDEB] bg-[#45DDEB]/20 text-[#F3F8FF] shadow-[0_0_18px_rgba(69,221,235,0.4)]"
                      : "z-10 border border-[#254159] bg-[#0D2133]/75 text-[#8BA4C0] hover:border-[#45DDEB]/60"
                  )}
                >
                  <span className="truncate font-mono text-[10px]">
                    [{formatOcrRoleLabel(region.role)}] {region.text}
                  </span>
                </button>
              );
            })}
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
                      ? "border-[#45DDEB] bg-[#113148] text-[#45DDEB]"
                      : "border-[#254159] bg-[#040B14] text-[#8BA4C0] hover:text-[#F3F8FF]"
                  )}
                >
                  {formatOcrRoleLabel(region.role)}
                </button>
              );
            })}
          </div>
          {activeRegion && (
            <div className="rounded-lg border border-[#45DDEB]/35 bg-[#040B14]/90 px-3 py-2 text-xs">
              <span className="font-mono text-[10px] font-semibold uppercase text-[#45DDEB]">
                {formatOcrRoleLabel(activeRegion.role)} TERPILIH:
              </span>
              <p className="mt-0.5 text-[#F3F8FF]">{activeRegion.text}</p>
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

  const handlePrint = () => {
    if (onTabChange) {
      onTabChange("report");
    }
    setTimeout(() => {
      window.print();
    }, 120);
  };

  return (
    <div className="space-y-5">
      {report.isDemo && (
        <Alert variant="cyber" className="no-print">
          <AlertTriangle className="size-4 text-[#45DDEB]" />
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

      {/* Dual Split Cards matching SOC Dashboard */}
      <div className="no-print grid gap-4 md:grid-cols-2">
        <Card className={cn("border", verdictStyle.borderClass)}>
          <CardContent className="flex flex-col justify-between gap-4 pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div
                  className={cn(
                    "flex size-9 items-center justify-center rounded-lg border",
                    verdictStyle.borderClass,
                    verdictStyle.bgClass,
                    verdictStyle.colorClass
                  )}
                >
                  <VerdictIcon className="size-5" />
                </div>
                <div>
                  <p className="font-heading text-base font-semibold text-[#F3F8FF]">
                    Claim Assessment
                  </p>
                  <p className="font-mono text-[11px] text-[#8BA4C0]">
                    {report.caseId}{" "}
                    {report.isDemo ? "• DEMO FIXTURE" : "• LIVE EVIDENCE"}
                  </p>
                </div>
              </div>
              <VerdictBadge verdict={report.verdict.claimVerdict} />
            </div>

            <p className="text-sm font-medium leading-relaxed text-[#F3F8FF]">
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

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#254159]/70 pt-3">
              <div
                className={cn(
                  "inline-flex items-center gap-1.5 font-mono text-xs font-semibold tracking-wider",
                  verdictStyle.colorClass
                )}
              >
                <VerdictIcon className="size-4" />
                <span>{verdictStyle.shortCode}</span>
              </div>
              <div className="flex items-center gap-2 text-xs text-[#8BA4C0]">
                <span>Sikap postingan:</span>
                <PostStanceBadge stance={report.verdict.postStance} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border-[#254159]">
          <CardContent className="flex flex-col justify-between gap-4 pt-5">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="flex size-9 items-center justify-center rounded-lg border border-[#34D399]/35 bg-[#34D399]/10 text-[#34D399]">
                  <FileText className="size-5" />
                </div>
                <div>
                  <p className="font-heading text-base font-semibold text-[#F3F8FF]">
                    Evidence Trail
                  </p>
                  <p className="font-mono text-[11px] text-[#8BA4C0]">
                    {report.supportingEvidence.length} mendukung ·{" "}
                    {report.contradictingEvidence.length} membantah ·{" "}
                    {report.partialContextEvidence.length} konteks
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handlePrint}
              >
                <Printer className="size-3.5 text-[#45DDEB]" />
                Print / PDF
              </Button>
            </div>

            <p className="text-sm leading-relaxed text-[#8BA4C0]">
              {report.publicOriginTrace.clarificationSources.length > 0
                ? `Rujukan terindeks: ${report.publicOriginTrace.clarificationSources
                    .map((s) => s.publisher)
                    .join(", ")}`
                : "Belum ditemukan rujukan resmi atau artikel fact-check yang memadai."}
            </p>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#254159]/70 pt-3">
              {report.verdict.evidenceMetrics.officialOrFactCheckCount > 0 ? (
                <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold tracking-wider text-[#34D399]">
                  <ShieldCheck className="size-4" />
                  EVIDENCE RETRIEVED (
                  {report.verdict.evidenceMetrics.officialOrFactCheckCount})
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 font-mono text-xs font-semibold tracking-wider text-[#45DDEB]">
                  <Clock className="size-4" />
                  INSUFFICIENT EVIDENCE • UNVERIFIED
                </span>
              )}
              <span className="font-mono text-xs text-[#8BA4C0]">
                {formatWibTimestamp(report.checkedAt)}
              </span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Explicit Debunking Stance Separation Alert */}
      {report.claimExtraction.postStance === "debunking_claim" && (
        <Alert variant="verified" className="no-print">
          <UserCheck className="size-4 text-[#34D399]" />
          <AlertTitle>
            Pemisahan Klasifikasi Postingan vs Verdict Klaim Aktif
          </AlertTitle>
          <AlertDescription className="text-[#F3F8FF]/90">
            Klaim faktual berstatus{" "}
            <strong className="text-[#F87171]">
              {report.verdict.claimVerdict}
            </strong>
            , sedangkan akun publik{" "}
            <code className="font-mono text-[#45DDEB]">
              {report.claimExtraction.visibleAccountHandle || "pada screenshot"}
            </code>{" "}
            berperan{" "}
            <strong className="text-[#34D399]">
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
        <TabsList className="no-print w-full justify-start overflow-x-auto">
          <TabsTrigger value="assessment">Analysis Result</TabsTrigger>
          <TabsTrigger value="timeline">Evidence Timeline</TabsTrigger>
          <TabsTrigger value="trace">Public Source Trace</TabsTrigger>
          <TabsTrigger value="report">Case Report (Print/PDF)</TabsTrigger>
        </TabsList>

        <TabsContent value="assessment" className="no-print space-y-4">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle>
                  Analysis Result — Claim vs Stance &amp; Evidence
                </CardTitle>
                <Badge variant="default">TEXT-FIRST NEWS VERIFICATION</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              {/* Mandatory Text-First Notice */}
              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#45DDEB]/35 bg-[#0A1D2F] px-3.5 py-2.5 text-xs">
                <span className="font-medium text-[#F3F8FF]">
                  {verificationNotice}
                </span>
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
                      "rounded-lg border border-[#254159] bg-[#07111E]/80 p-4 transition-colors",
                      ocrRegions.some(
                        (r) =>
                          r.role === "headline" || r.role === "graphic_overlay"
                      ) && "cursor-pointer hover:border-[#45DDEB]/65"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#45DDEB]">
                        EXTRACTED HEADLINE
                      </p>
                      <span className="font-mono text-[10px] text-[#8BA4C0]">
                        Teks Utama / Overlay Gambar
                      </span>
                    </div>
                    <p className="mt-2 text-sm font-semibold leading-relaxed text-[#F3F8FF]">
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
                      "rounded-lg border border-[#254159] bg-[#07111E]/80 p-4 transition-colors",
                      ocrRegions.some((r) => r.role === "caption") &&
                        "cursor-pointer hover:border-[#45DDEB]/65"
                    )}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#45DDEB]">
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
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#F3F8FF]/90">
                      {extractedCaption ||
                        "Tidak terdapat caption terpisah yang terbaca pada screenshot."}
                    </p>
                    {report.claimExtraction.clarificationOrDebunkText && (
                      <div className="mt-2.5 rounded-md border border-[#34D399]/35 bg-[#34D399]/10 px-2.5 py-1.5 text-xs text-[#34D399]">
                        <strong>Catatan Klarifikasi Terlihat:</strong>{" "}
                        {report.claimExtraction.clarificationOrDebunkText}
                      </div>
                    )}
                    <details className="mt-2.5">
                      <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-wider text-[#8BA4C0]">
                        Lihat Transkrip OCR Lengkap
                      </summary>
                      <p className="mt-1.5 whitespace-pre-wrap text-xs text-[#8BA4C0]">
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
              <div className="rounded-xl border border-[#254159] bg-[#07111E]/75 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Layers className="size-4 text-[#45DDEB]" />
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#45DDEB]">
                      NORMALIZED FACTUAL CLAIMS
                    </p>
                  </div>
                  <span className="font-mono text-[11px] text-[#8BA4C0]">
                    Ekstraksi Proposisi Berbasis Teks (Tanpa Inferensi Foto)
                  </span>
                </div>

                {normalizedClaims.length > 0 ? (
                  <div className="mt-3 grid gap-3 md:grid-cols-2">
                    {normalizedClaims.map((nc) => (
                      <div
                        key={nc.id}
                        className="rounded-lg border border-[#254159]/90 bg-[#040B14]/80 p-3.5"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono text-xs font-semibold text-[#45DDEB]">
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
                        <p className="mt-2 text-xs font-semibold text-[#F3F8FF]">
                          {nc.proposition}
                        </p>
                        <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1 border-t border-[#254159]/50 pt-2 text-[11px] text-[#8BA4C0]">
                          <div>
                            <dt className="font-mono text-[10px] uppercase">
                              Subjek
                            </dt>
                            <dd className="text-[#F3F8FF]/90">{nc.subject}</dd>
                          </div>
                          <div>
                            <dt className="font-mono text-[10px] uppercase">
                              Tindakan / Status
                            </dt>
                            <dd className="text-[#F3F8FF]/90">
                              {nc.predicateAction}
                            </dd>
                          </div>
                          <div>
                            <dt className="font-mono text-[10px] uppercase">
                              Objek / Target
                            </dt>
                            <dd className="text-[#F3F8FF]/90">
                              {nc.objectTarget}
                            </dd>
                          </div>
                          <div>
                            <dt className="font-mono text-[10px] uppercase">
                              Status Formal/Hukum
                            </dt>
                            <dd className="text-[#F3F8FF]/90">
                              {nc.legalOrAdministrativeStatus || "Tidak disebut"}
                            </dd>
                          </div>
                        </dl>
                        {nc.semanticNote && (
                          <p className="mt-2 rounded bg-[#0D2133] px-2 py-1 text-[11px] text-[#FBBF24]">
                            {nc.semanticNote}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-[#8BA4C0]">
                    Proposisi utama: {report.claimExtraction.primaryClaim}
                  </p>
                )}

                {report.verdict.atomicAssessments &&
                  report.verdict.atomicAssessments.length > 0 && (
                    <div className="mt-4 border-t border-[#254159]/70 pt-3">
                      <p className="font-mono text-[10px] uppercase tracking-wider text-[#8BA4C0]">
                        Status Verifikasi Per Proposisi Atomik
                      </p>
                      <div className="mt-2 grid gap-2.5 md:grid-cols-2">
                        {report.verdict.atomicAssessments.map((item) => (
                          <div
                            key={item.id}
                            className="rounded-lg border border-[#254159]/80 bg-[#040B14]/70 p-3"
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-mono text-xs text-[#45DDEB]">
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
                            <p className="mt-1.5 text-xs font-medium text-[#F3F8FF]">
                              {item.proposition}
                            </p>
                            <p className="mt-1 text-[11px] text-[#8BA4C0]">
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
              <div className="rounded-xl border border-[#254159] bg-[#07111E]/75 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#45DDEB]">
                    FACT CHECK VERDICT
                  </p>
                  <VerdictBadge verdict={report.verdict.claimVerdict} />
                </div>
                <p className="mt-2 text-sm leading-relaxed text-[#F3F8FF]">
                  {report.verdict.explanation}
                </p>
                <p className="mt-2 text-xs text-[#8BA4C0]">
                  <strong className="text-[#F3F8FF]">Sikap postingan:</strong>{" "}
                  {report.verdict.postClassification} —{" "}
                  {report.claimExtraction.postStanceSummary}
                </p>
              </div>

              <Separator />

              {/* 5. EVIDENCE SOURCES */}
              <div className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#45DDEB]">
                    EVIDENCE SOURCES
                  </p>
                  <span className="font-mono text-[11px] text-[#8BA4C0]">
                    {report.supportingEvidence.length} mendukung ·{" "}
                    {report.contradictingEvidence.length} membantah ·{" "}
                    {report.partialContextEvidence.length} konteks
                  </span>
                </div>

                {report.evidenceSources.length === 0 ? (
                  <Alert variant="cyber">
                    <ShieldAlert className="size-4 text-[#45DDEB]" />
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
                      accentClass="text-[#34D399]"
                    />
                    <EvidenceGroupList
                      title="Contradicting Evidence (Membantah Klaim)"
                      emptyLabel="Tidak ada sumber terindeks yang membantah klaim ini."
                      items={report.contradictingEvidence}
                      accentClass="text-[#F87171]"
                    />
                  </div>
                )}

                {report.partialContextEvidence.length > 0 && (
                  <EvidenceGroupList
                    title="Partial / Outdated Context Evidence"
                    emptyLabel=""
                    items={report.partialContextEvidence}
                    accentClass="text-[#FBBF24]"
                  />
                )}

                {report.evidenceSources.some(
                  (s) => s.relation === "irrelevant"
                ) && (
                  <details className="rounded-xl border border-[#254159] bg-[#07111E]/65 p-4">
                    <summary className="cursor-pointer font-mono text-xs font-semibold uppercase tracking-wider text-[#8BA4C0]">
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
                            className="rounded-lg border border-[#254159]/70 bg-[#040B14]/70 p-3 text-xs text-[#8BA4C0]"
                          >
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-mono text-[#45DDEB]">
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
                            <p className="mt-1 font-medium text-[#F3F8FF]">
                              {src.title}
                            </p>
                            <p className="mt-1">{src.rationale}</p>
                          </div>
                        ))}
                    </div>
                  </details>
                )}
              </div>

              {/* 6 & 7 Quick Summary Cards: VERIFICATION TIMELINE & PUBLIC SOURCE TRACE */}
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-xl border border-[#254159] bg-[#07111E]/70 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#45DDEB]">
                      VERIFICATION TIMELINE
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onTabChange?.("timeline")}
                      className="h-7 px-2 font-mono text-[11px] text-[#45DDEB]"
                    >
                      Buka Timeline
                      <ArrowRight className="size-3" />
                    </Button>
                  </div>
                  <p className="mt-1.5 text-xs text-[#8BA4C0]">
                    {report.publicOriginTrace.timeline.length} titik jejak
                    kronologis tercatat (postingan teramati, sumber rujukan, &amp;
                    audit AI).
                  </p>
                </div>

                <div className="rounded-xl border border-[#254159] bg-[#07111E]/70 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[#45DDEB]">
                      PUBLIC SOURCE TRACE
                    </p>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => onTabChange?.("trace")}
                      className="h-7 px-2 font-mono text-[11px] text-[#45DDEB]"
                    >
                      Buka Trace
                      <ArrowRight className="size-3" />
                    </Button>
                  </div>
                  <p className="mt-1.5 text-xs text-[#8BA4C0]">
                    Platform: {report.publicOriginTrace.platform} · Handle:{" "}
                    {report.publicOriginTrace.visibleAccountHandle ||
                      "Tidak terlihat"}
                  </p>
                </div>
              </div>

              <div className="rounded-xl border border-[#254159] bg-[#07111E]/70 p-4">
                <p className="font-mono text-xs uppercase tracking-wider text-[#FBBF24]">
                  Batasan Analisis (Clear Limitations)
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#8BA4C0]">
                  {report.limitations.map((lim, idx) => (
                    <li key={idx}>{lim}</li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="timeline" className="no-print space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Evidence Timeline &amp; Chronological Audit</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-[#8BA4C0]">
                Urutan kronologis peristiwa publik yang teramati pada
                screenshot, publikasi klarifikasi/fact-check terindeks, dan
                waktu pemeriksaan KLAIMSCAN AI.
              </p>

              <ol className="relative ml-2 space-y-4 border-l border-[#254159] pl-6">
                {report.publicOriginTrace.timeline.map((evt) => (
                  <li key={evt.id} className="relative">
                    <span
                      className={cn(
                        "absolute -left-[29px] top-1 flex size-3 rounded-full border-2 border-[#07111E]",
                        evt.eventType === "official_statement"
                          ? "bg-[#34D399]"
                          : evt.eventType === "fact_check_prior"
                            ? "bg-[#45DDEB]"
                            : evt.eventType === "verification_run"
                              ? "bg-[#FBBF24]"
                              : "bg-[#8BA4C0]"
                      )}
                    />
                    <div className="rounded-lg border border-[#254159] bg-[#07111E]/75 p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-mono text-xs text-[#45DDEB]">
                          {evt.timestampLabel}
                        </span>
                        {evt.sourceUrl && (
                          <a
                            href={evt.sourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-mono text-[11px] text-[#34D399] hover:underline"
                          >
                            <Globe2 className="size-3" />
                            Buka Sumber
                          </a>
                        )}
                      </div>
                      <p className="mt-1 font-heading text-sm font-semibold text-[#F3F8FF]">
                        {evt.title}
                      </p>
                      <p className="mt-1 text-xs text-[#8BA4C0]">
                        {evt.description}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trace" className="no-print space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Public Source Trace (OSINT Terbatas)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <Alert variant="cyber">
                <Lock className="size-4 text-[#45DDEB]" />
                <AlertTitle>Batasan Privasi &amp; Non-Atribusi</AlertTitle>
                <AlertDescription className="space-y-1">
                  <p>{report.publicOriginTrace.privacyGuarantee}</p>
                  <p className="font-medium text-[#FBBF24]">
                    {report.publicOriginTrace.attributionCaveat}
                  </p>
                </AlertDescription>
              </Alert>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="rounded-lg border border-[#254159] bg-[#07111E]/80 p-3">
                  <span className="font-mono text-[10px] uppercase text-[#8BA4C0]">
                    Platform Terlihat
                  </span>
                  <p className="mt-1 font-heading text-sm font-semibold text-[#F3F8FF]">
                    {report.publicOriginTrace.platform}
                  </p>
                </div>
                <div className="rounded-lg border border-[#254159] bg-[#07111E]/80 p-3">
                  <span className="font-mono text-[10px] uppercase text-[#8BA4C0]">
                    Username / Handle Publik
                  </span>
                  <p className="mt-1 font-mono text-sm text-[#45DDEB]">
                    {report.publicOriginTrace.visibleAccountHandle ||
                      "Tidak terlihat"}
                  </p>
                </div>
                <div className="rounded-lg border border-[#254159] bg-[#07111E]/80 p-3">
                  <span className="font-mono text-[10px] uppercase text-[#8BA4C0]">
                    Indikator Waktu Terlihat
                  </span>
                  <p className="mt-1 font-mono text-sm text-[#F3F8FF]">
                    {report.publicOriginTrace.visibleTimestamp ||
                      "Tidak tercantum"}
                  </p>
                </div>
                <div className="rounded-lg border border-[#254159] bg-[#07111E]/80 p-3">
                  <span className="font-mono text-[10px] uppercase text-[#8BA4C0]">
                    URL Publik Terlihat
                  </span>
                  {report.publicOriginTrace.visiblePostUrl ? (
                    <a
                      href={report.publicOriginTrace.visiblePostUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 block truncate font-mono text-xs text-[#45DDEB] underline"
                    >
                      {report.publicOriginTrace.visiblePostUrl}
                    </a>
                  ) : (
                    <p className="mt-1 font-mono text-xs text-[#8BA4C0]">
                      Tidak terlihat pada screenshot
                    </p>
                  )}
                </div>
              </div>

              <div>
                <h4 className="mb-2 font-heading text-sm font-semibold text-[#F3F8FF]">
                  Sumber Publik &amp; Klarifikasi Terobservasi
                </h4>
                {report.publicOriginTrace.clarificationSources.length === 0 ? (
                  <p className="text-xs text-[#8BA4C0]">
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
                        className="flex items-center justify-between rounded-lg border border-[#254159] bg-[#07111E]/75 p-3 hover:border-[#45DDEB]/60"
                      >
                        <div>
                          <p className="text-xs font-semibold text-[#F3F8FF]">
                            {s.publisher}
                          </p>
                          <p className="font-mono text-[11px] text-[#45DDEB]">
                            {s.url}
                          </p>
                        </div>
                        <ExternalLink className="size-3.5 shrink-0 text-[#8BA4C0]" />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Dedicated Print-to-PDF Case Report */}
        <TabsContent
          value="report"
          forceMount
          className={cn(
            activeTab !== "report" ? "hidden print:block" : "block"
          )}
        >
          <Card className="print-surface border-[#254159]">
            <CardHeader className="border-b border-[#254159] pb-4">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <p className="font-mono text-xs uppercase tracking-widest text-[#45DDEB] print-muted">
                    KLAIMSCAN AI • TEXT-FIRST AUDITABLE CASE REPORT{" "}
                    {report.isDemo ? "• DEMO FIXTURE" : ""}
                  </p>
                  <CardTitle className="mt-1 text-xl">
                    Laporan Investigasi Pemeriksaan Fakta
                  </CardTitle>
                  <p className="mt-1 font-mono text-xs text-[#8BA4C0] print-muted">
                    Case ID: {report.caseId} · Timestamp Analisis:{" "}
                    {formatWibTimestamp(report.checkedAt)}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="cyber"
                  onClick={handlePrint}
                  className="no-print"
                >
                  <Printer className="size-4" />
                  Cetak / Simpan PDF
                </Button>
              </div>
            </CardHeader>

            <CardContent className="space-y-5 pt-5">
              <div className="rounded-lg border border-[#45DDEB]/40 p-3 text-xs font-medium print-surface">
                {verificationNotice}
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-[#254159] p-4 print-surface">
                  <p className="font-mono text-[11px] uppercase text-[#8BA4C0] print-muted">
                    Klaim Tekstual &amp; Verdict Faktual
                  </p>
                  <p className="mt-1 font-heading text-lg font-bold">
                    {report.verdict.claimVerdict} (
                    {report.verdict.verdictLabelId})
                  </p>
                  <p className="mt-2 text-sm">
                    {report.claimExtraction.primaryClaim}
                  </p>
                  <p className="mt-2 text-xs text-[#8BA4C0] print-muted">
                    <strong>Headline:</strong> {extractedHeadline}
                  </p>
                  {extractedCaption && (
                    <p className="mt-1 text-xs text-[#8BA4C0] print-muted">
                      <strong>Caption:</strong> {extractedCaption}
                    </p>
                  )}
                  {report.verdict.qualifiedStatusLabels &&
                    report.verdict.qualifiedStatusLabels.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {report.verdict.qualifiedStatusLabels.map((label) => (
                          <Badge
                            key={`print-${label}`}
                            variant={getQualifiedLabelVariant(label)}
                          >
                            {label}
                          </Badge>
                        ))}
                      </div>
                    )}
                </div>

                <div className="rounded-lg border border-[#254159] p-4 print-surface">
                  <p className="font-mono text-[11px] uppercase text-[#8BA4C0] print-muted">
                    Post Stance &amp; Public Trace
                  </p>
                  <p className="mt-1 font-heading text-lg font-bold">
                    {report.verdict.postClassification}
                  </p>
                  <p className="mt-2 font-mono text-xs text-[#8BA4C0] print-muted">
                    Platform: {report.publicOriginTrace.platform} · Akun:{" "}
                    {report.publicOriginTrace.visibleAccountHandle ||
                      "Tidak terlihat"}{" "}
                    · Waktu:{" "}
                    {report.publicOriginTrace.visibleTimestamp || "N/A"}
                  </p>
                  {report.publicOriginTrace.visiblePostUrl && (
                    <p className="mt-1 break-all font-mono text-[11px] text-[#45DDEB] print-muted">
                      URL terlihat: {report.publicOriginTrace.visiblePostUrl}
                    </p>
                  )}
                </div>
              </div>

              <div className="rounded-lg border border-[#254159] p-4 print-surface">
                <p className="font-mono text-[11px] uppercase text-[#8BA4C0] print-muted">
                  Penjelasan &amp; Ringkasan Bukti
                </p>
                <p className="mt-2 text-sm leading-relaxed">
                  {report.verdict.explanation}
                </p>
                {report.analystNotes && (
                  <p className="mt-2 border-t border-[#254159]/50 pt-2 text-xs text-[#8BA4C0] print-muted">
                    <strong>Catatan Analis:</strong> {report.analystNotes}
                  </p>
                )}
              </div>

              {report.verdict.atomicAssessments &&
                report.verdict.atomicAssessments.length > 0 && (
                  <div className="rounded-lg border border-[#254159] p-4 print-surface">
                    <p className="font-mono text-[11px] uppercase text-[#8BA4C0] print-muted">
                      Rincian Proposisi Atomik &amp; Aspek Verifikasi
                    </p>
                    <div className="mt-2 space-y-2">
                      {report.verdict.atomicAssessments.map((item) => (
                        <div
                          key={`print-ac-${item.id}`}
                          className="border-b border-[#254159]/40 pb-2 text-xs last:border-b-0 last:pb-0"
                        >
                          <div className="font-semibold">
                            [{item.id}] {item.label}: {item.statusLabel}
                          </div>
                          <div>{item.proposition}</div>
                          <div className="text-[11px] text-[#8BA4C0] print-muted">
                            {item.rationale}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              <div>
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-heading text-sm font-semibold">
                    Bukti Pendukung &amp; Pembantah Terverifikasi (
                    {report.evidenceSources.length})
                  </h4>
                  <div className="flex flex-wrap gap-1.5 font-mono text-[11px]">
                    <Badge variant="verified">
                      Supporting: {report.supportingEvidence.length}
                    </Badge>
                    <Badge variant="threat">
                      Contradicting: {report.contradictingEvidence.length}
                    </Badge>
                    <Badge variant="warning">
                      Partial Context: {report.partialContextEvidence.length}
                    </Badge>
                  </div>
                </div>
                {report.evidenceSources.length === 0 ? (
                  <p className="text-sm text-[#8BA4C0] print-muted">
                    Tidak ditemukan sumber bukti terverifikasi yang memadai;
                    verdict ditetapkan sebagai UNVERIFIED.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>ID</TableHead>
                        <TableHead>Kategori &amp; Aspek</TableHead>
                        <TableHead>Penerbit &amp; Tgl</TableHead>
                        <TableHead>Klaim Dievaluasi, Judul &amp; URL Sumber</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {report.evidenceSources.map((src) => (
                        <TableRow key={`${src.id}-${src.url}`}>
                          <TableCell className="font-mono text-xs">
                            {src.id}
                          </TableCell>
                          <TableCell className="font-mono text-xs">
                            <div>{src.relation}</div>
                            {src.targetAspect && (
                              <div className="text-[11px] text-[#8BA4C0] print-muted">
                                {src.targetAspect}
                              </div>
                            )}
                            {src.temporalStatus &&
                              src.temporalStatus !== "unclear" && (
                                <div className="text-[11px] text-[#8BA4C0] print-muted">
                                  {src.temporalStatus}
                                </div>
                              )}
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="font-medium">{src.publisher}</div>
                            <div className="font-mono text-[11px] text-[#8BA4C0] print-muted">
                              {src.publishedAt || "Tgl tidak tercantum"}
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">
                            <div className="font-medium">{src.title}</div>
                            <div className="mt-0.5 text-[11px] text-[#8BA4C0] print-muted">
                              Klaim: {src.claimEvaluated}
                            </div>
                            <a
                              href={src.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-0.5 block break-all font-mono text-[11px] text-[#45DDEB] underline"
                            >
                              {src.url}
                            </a>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </div>

              <div className="rounded-lg border border-[#254159] p-4 print-surface">
                <p className="font-mono text-[11px] uppercase text-[#8BA4C0] print-muted">
                  Batasan Metodologi, Jejak Publik &amp; Privasi (Clear Limitations)
                </p>
                <p className="mt-2 text-xs text-[#FBBF24] print-muted">
                  {report.publicOriginTrace.attributionCaveat}
                </p>
                <p className="mt-1 text-xs text-[#8BA4C0] print-muted">
                  {report.publicOriginTrace.privacyGuarantee}
                </p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-xs text-[#8BA4C0] print-muted">
                  {report.limitations.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
                {report.warnings.length > 0 && (
                  <ul className="mt-2 border-t border-[#254159]/50 pt-2 text-[11px] text-[#8BA4C0] print-muted">
                    {report.warnings.map((warn, idx) => (
                      <li key={idx}>Catatan Sistem: {warn}</li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="rounded-lg border border-[#254159] p-3 font-mono text-[11px] text-[#8BA4C0] print-surface print-muted">
                <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
                  <span className="inline-flex items-center gap-1">
                    <Fingerprint className="size-3.5" />
                    SHA-256: {report.imageMetadata.sha256}
                  </span>
                  <span>
                    Metadata removed:{" "}
                    {report.imageMetadata.metadataRemovedBytes} bytes
                  </span>
                  <span>
                    <CheckCircle2 className="mr-1 inline size-3" />
                    Permanent image storage: No (ephemeral)
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
