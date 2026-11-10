"use client";

import * as React from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  ExternalLink,
  FileText,
  Fingerprint,
  Globe2,
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
import type { EvidenceSource, InvestigationReport } from "@/lib/types";
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
  activeTab?: ResultViewTab;
  onTabChange?: (tab: ResultViewTab) => void;
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
                    {src.publishedAt && (
                      <Badge variant="outline">Tgl: {src.publishedAt}</Badge>
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

export function AnalysisResult({
  report,
  activeTab = "assessment",
  onTabChange,
}: AnalysisResultProps) {
  const verdictStyle = getVerdictStyle(report.verdict.claimVerdict);
  const VerdictIcon = verdictStyle.Icon;

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

      {/* Detailed Forensic Investigation Tabs covering Result, Timeline, Public Trace, Case Report */}
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
              <CardTitle>Analysis Result — Claim vs Stance &amp; Evidence</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-[#254159] bg-[#07111E]/75 p-4">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-[#45DDEB]">
                    Teks &amp; Indikator Terlihat pada Screenshot
                  </p>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-[#F3F8FF]">
                    {report.claimExtraction.extractedText}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2 text-xs text-[#8BA4C0]">
                    <Badge variant="outline">
                      Topik: {report.claimExtraction.topicCategory}
                    </Badge>
                    {report.claimExtraction.claimDateMentioned && (
                      <Badge variant="outline">
                        Indikator Waktu:{" "}
                        {report.claimExtraction.claimDateMentioned}
                      </Badge>
                    )}
                  </div>
                </div>

                <div className="space-y-3 rounded-lg border border-[#254159] bg-[#07111E]/75 p-4">
                  <p className="font-mono text-[11px] uppercase tracking-wider text-[#45DDEB]">
                    Penjelasan Verdict &amp; Sikap Postingan
                  </p>
                  <p className="text-sm leading-relaxed text-[#F3F8FF]">
                    {report.verdict.explanation}
                  </p>
                  <p className="text-xs text-[#8BA4C0]">
                    <strong className="text-[#F3F8FF]">Sikap postingan:</strong>{" "}
                    {report.verdict.postClassification} —{" "}
                    {report.claimExtraction.postStanceSummary}
                  </p>
                </div>
              </div>

              <Separator />

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
                    KLAIMSCAN AI • AUDITABLE CASE REPORT{" "}
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
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-lg border border-[#254159] p-4 print-surface">
                  <p className="font-mono text-[11px] uppercase text-[#8BA4C0] print-muted">
                    Klaim Dianalisis &amp; Verdict Faktual
                  </p>
                  <p className="mt-1 font-heading text-lg font-bold">
                    {report.verdict.claimVerdict} (
                    {report.verdict.verdictLabelId})
                  </p>
                  <p className="mt-2 text-sm">
                    {report.claimExtraction.primaryClaim}
                  </p>
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
                        <TableHead>Kategori</TableHead>
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
                            {src.relation}
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
