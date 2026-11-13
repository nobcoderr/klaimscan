"use client";

import * as React from "react";
import Image from "next/image";
import {
  CheckCircle2,
  FileImage,
  Loader2,
  ScanLine,
  Sparkles,
  Upload,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { createInitialPipelineSteps } from "@/lib/pipeline/steps";
import type {
  InvestigationReport,
  PipelineStepState,
  ServerConfigStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

const ACCEPTED_MIME_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
]);

const ACCEPTED_EXTENSIONS = /\.(png|jpe?g|webp)$/i;

const MAX_UPLOAD_BYTES = 4 * 1024 * 1024; // 4 MB (menjaga body multipart < 4.5 MB batas Vercel)

async function loadSampleScreenshot(): Promise<File> {
  const response = await fetch("/demo/vereditum-sim.jpg");
  if (!response.ok) {
    throw new Error("Sample tidak tersedia");
  }
  const blob = await response.blob();
  return new File([blob], "vereditum-sim.jpg", {
    type: blob.type || "image/jpeg",
  });
}

interface DropzoneScannerProps {
  serverConfig: ServerConfigStatus;
  onAnalysisComplete: (
    report: InvestigationReport,
    ephemeralPreviewUrl?: string
  ) => void;
  onSelectDemoCase: (caseId: string) => void;
}

export function DropzoneScanner({
  serverConfig,
  onAnalysisComplete,
  onSelectDemoCase,
}: DropzoneScannerProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [analystNotes, setAnalystNotes] = React.useState("");
  const [isDragging, setIsDragging] = React.useState(false);
  const [isAnalyzing, setIsAnalyzing] = React.useState(false);
  const [steps, setSteps] = React.useState<PipelineStepState[]>(() =>
    createInitialPipelineSteps()
  );
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileSelection = (file: File | null | undefined) => {
    if (!file) return;
    setErrorMessage(null);

    const hasAcceptedMime = ACCEPTED_MIME_TYPES.has(file.type);
    const hasAcceptedExt = !file.type && ACCEPTED_EXTENSIONS.test(file.name);

    if (!hasAcceptedMime && !hasAcceptedExt) {
      const msg =
        "Format file tidak didukung. Unggah screenshot berformat PNG, JPG, atau WEBP.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (file.size > MAX_UPLOAD_BYTES) {
      const msg =
        "Ukuran file melebihi batas maksimal 4 MB (batas request platform 4,5 MB). Kompres atau potong screenshot terlebih dahulu.";
      setErrorMessage(msg);
      toast.error(msg);
      return;
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    const nextUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(nextUrl);
    setSteps(createInitialPipelineSteps());
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    handleFileSelection(file);
  };

  const clearSelection = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    setAnalystNotes("");
    setSteps(createInitialPipelineSteps());
    setErrorMessage(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const loadGeneratedSample = async () => {
    try {
      const sampleFile = await loadSampleScreenshot();
      handleFileSelection(sampleFile);
      toast.success("Sample screenshot @vereditum siap diuji.");
    } catch {
      toast.error("Tidak dapat membuat sample gambar di browser ini.");
    }
  };

  const runAnalysis = async () => {
    if (!selectedFile) {
      toast.error("Pilih atau jatuhkan screenshot terlebih dahulu.");
      return;
    }

    setIsAnalyzing(true);
    setErrorMessage(null);
    setSteps(
      createInitialPipelineSteps().map((s, idx) => ({
        ...s,
        status: idx === 0 ? "active" : "pending",
      }))
    );

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      if (analystNotes.trim()) {
        formData.append("analystNotes", analystNotes.trim());
      }

      const response = await fetch("/api/analyze?stream=true", {
        method: "POST",
        headers: {
          Accept: "application/x-ndjson",
        },
        body: formData,
      });

      if (!response.ok) {
        const errJson = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          errJson.error ||
            `Analisis gagal dengan status HTTP ${response.status}.`
        );
      }

      if (!response.body) {
        throw new Error("Stream respons tidak tersedia dari server.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completedReport: InvestigationReport | null = null;

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          const event = JSON.parse(trimmed) as
            | { type: "progress"; steps: PipelineStepState[] }
            | { type: "complete"; report: InvestigationReport }
            | { type: "error"; message: string };

          if (event.type === "progress") {
            setSteps(event.steps);
          } else if (event.type === "complete") {
            completedReport = event.report;
            setSteps(event.report.pipelineSteps);
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }

      if (!completedReport) {
        throw new Error(
          "Pipeline selesai tanpa menghasilkan laporan investigasi."
        );
      }

      toast.success(
        `Analisis selesai (${completedReport.verdict.claimVerdict})`
      );
      const handedPreviewUrl = URL.createObjectURL(selectedFile);
      onAnalysisComplete(completedReport, handedPreviewUrl);
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : "Gagal memproses screenshot.";
      setErrorMessage(msg);
      setSteps((prev) =>
        prev.map((s) =>
          s.status === "active" ? { ...s, status: "error", detail: msg } : s
        )
      );
      toast.error(msg);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const completedCount = steps.filter((s) => s.status === "completed").length;
  const progressValue = Math.round((completedCount / steps.length) * 100);

  return (
    <Card className="border-border bg-card/90">
      <CardHeader className="border-b border-border pb-4">
        <CardTitle>Unggah screenshot</CardTitle>
        <p className="text-sm leading-relaxed text-muted-foreground">
          PNG, JPG, atau WEBP. Maksimal 4 MB.
        </p>
      </CardHeader>

      <CardContent className="space-y-4 pt-5">
        {!serverConfig.openAiConfigured && (
          <Alert variant="warning">
            <Sparkles className="size-4 text-verdict-mislead" />
            <AlertTitle>
              DEMO MODE Aktif — OPENAI_API_KEY Belum Diisi
            </AlertTitle>
            <AlertDescription className="flex flex-wrap items-center justify-between gap-3">
              <span>
                Upload preview &amp; sanitasi bekerja penuh, sementara analisis AI
                langsung memerlukan <code>OPENAI_API_KEY</code> di{" "}
                <code>.env.local</code> / <code>env.local</code>. Data fixture di
                bawah dilabeli jelas sebagai <strong>DEMO MODE</strong> dan
                tidak pernah disamarkan sebagai bukti live.
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => onSelectDemoCase("KS-DEMO-001")}
              >
                Lihat Fixture @vereditum
              </Button>
            </AlertDescription>
          </Alert>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          aria-label="Pilih file screenshot"
          onChange={(e) => handleFileSelection(e.target.files?.[0])}
        />

        {!previewUrl ? (
          <div
            onClick={() => inputRef.current?.click()}
            onDragOver={(e) => {
              e.preventDefault();
              setIsDragging(true);
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={cn(
              "group relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center border border-dashed px-6 py-10 text-center transition-colors outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring",
              isDragging
                ? "border-primary bg-primary/10"
                : "border-border bg-background hover:border-primary/70"
            )}
          >
            <div className="mb-4 flex size-12 items-center justify-center border border-primary/40 text-primary">
              <ScanLine className="size-6" />
            </div>
            <p className="font-heading text-xl font-semibold text-foreground">
              Letakkan screenshot di sini
            </p>
            <p className="mt-2 text-sm text-muted-foreground">
              Instagram, TikTok, Facebook, WhatsApp
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              PNG, JPG, atau WEBP. Maksimal 4 MB.
            </p>
            <div className="mt-5 flex flex-wrap items-center justify-center gap-2.5">
              <Button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  inputRef.current?.click();
                }}
              >
                <Upload className="size-4" />
                Pilih screenshot
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  void loadGeneratedSample();
                }}
              >
                <FileImage className="size-4 text-primary" />
                Muat Sample Uji
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-xl border border-border bg-background">
                <Image
                  src={previewUrl}
                  alt="Preview screenshot yang akan dianalisis"
                  width={960}
                  height={540}
                  unoptimized
                  className="max-h-[340px] w-full object-contain"
                />

                {isAnalyzing && (
                  <div
                    aria-hidden="true"
                    className="pointer-events-none absolute inset-0 bg-background/25"
                  >
                    <div className="animate-scan-line absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-primary to-transparent shadow-sm" />
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-border bg-card/95 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <FileImage className="size-3.5 shrink-0 text-primary" />
                    <span className="truncate font-mono text-foreground">
                      {selectedFile?.name}
                    </span>
                    <Badge variant="secondary">
                      {selectedFile
                        ? `${Math.max(1, Math.round(selectedFile.size / 1024))} KB`
                        : ""}
                    </Badge>
                  </div>
                  {!isAnalyzing && (
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={clearSelection}
                    >
                      <X className="size-3.5" />
                      Ganti
                    </Button>
                  )}
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="analyst-notes"
                  className="text-sm text-muted-foreground"
                >
                  Catatan analis, opsional
                </label>
                <Textarea
                  id="analyst-notes"
                  value={analystNotes}
                  onChange={(e) => setAnalystNotes(e.target.value)}
                  placeholder="Contoh: Screenshot diterima dari grup WhatsApp keluarga, perlu cek apakah sudah ada klarifikasi resmi..."
                  disabled={isAnalyzing}
                  className="min-h-[68px]"
                />
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <Button
                  type="button"
                  variant="cyber"
                  onClick={runAnalysis}
                  disabled={isAnalyzing}
                >
                  {isAnalyzing ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Memeriksa klaim...
                    </>
                  ) : (
                    <>
                      <ScanLine className="size-4" />
                      Periksa klaim ini
                    </>
                  )}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => onSelectDemoCase("KS-DEMO-001")}
                  disabled={isAnalyzing}
                >
                  Lihat Demo @vereditum
                </Button>
              </div>
            </div>

            <div
              className="rounded-md border border-border bg-background p-4"
              aria-live="polite"
              aria-busy={isAnalyzing}
              aria-label="Progres pemeriksaan"
            >
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-primary">
                  Langkah pemeriksaan
                </span>
                <span className="font-mono text-xs text-muted-foreground">
                  {progressValue}%
                </span>
              </div>
              <Progress value={progressValue} className="mb-4" />

              <ol className="space-y-2.5">
                {steps.map((step) => (
                  <li
                    key={step.id}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-xs transition-colors",
                      step.status === "completed" &&
                        "border-verdict-true/35 bg-verdict-true/6",
                      step.status === "active" &&
                        "border-primary/60 bg-primary/10",
                      step.status === "error" &&
                        "border-verdict-false/50 bg-verdict-false/10",
                      step.status === "pending" &&
                        "border-border/60 bg-card/40"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-foreground">
                        {step.code} — {step.label}
                      </span>
                      {step.status === "completed" && (
                        <CheckCircle2 className="size-3.5 shrink-0 text-verdict-true" />
                      )}
                      {step.status === "active" && (
                        <Loader2 className="size-3.5 shrink-0 animate-spin text-primary" />
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-muted-foreground">
                      {step.detail || step.description}
                    </p>
                  </li>
                ))}
              </ol>

              {isAnalyzing && (
                <div className="mt-4 space-y-2 rounded-lg border border-primary/30 bg-card/70 p-3">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-primary">
                    Menyusun Berkas Investigasi...
                  </p>
                  <Skeleton className="h-3 w-4/5" />
                  <Skeleton className="h-3 w-3/5" />
                </div>
              )}
            </div>
          </div>
        )}

        {errorMessage && (
          <Alert variant="destructive">
            <AlertTitle>Analisis Tidak Dapat Dilanjutkan</AlertTitle>
            <AlertDescription className="text-verdict-false/90">
              {errorMessage}
            </AlertDescription>
          </Alert>
        )}

        <p className="text-xs text-muted-foreground">
          Maksimal 4 MB. Tidak melacak IP pribadi.
        </p>
      </CardContent>
    </Card>
  );
}
