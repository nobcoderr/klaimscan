"use client";

import * as React from "react";
import Image from "next/image";
import {
  CheckCircle2,
  FileImage,
  Loader2,
  Lock,
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

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

function createSamplePngFile(): Promise<File> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement("canvas");
    canvas.width = 960;
    canvas.height = 540;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      reject(new Error("Canvas tidak tersedia"));
      return;
    }

    ctx.fillStyle = "#0F172A";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = "#1E293B";
    ctx.fillRect(48, 44, 864, 452);
    ctx.strokeStyle = "#334155";
    ctx.lineWidth = 2;
    ctx.strokeRect(48, 44, 864, 452);

    ctx.fillStyle = "#38BDF8";
    ctx.font = "bold 24px sans-serif";
    ctx.fillText("@vereditum • Klarifikasi Fakta", 88, 108);

    ctx.fillStyle = "#94A3B8";
    ctx.font = "18px sans-serif";
    ctx.fillText("Instagram • 3 jam lalu", 88, 140);

    ctx.fillStyle = "#EF4444";
    ctx.fillRect(88, 175, 220, 42);
    ctx.fillStyle = "#FFFFFF";
    ctx.font = "bold 20px sans-serif";
    ctx.fillText("HOAKS / KLARIFIKASI", 102, 203);

    ctx.fillStyle = "#F8FAFC";
    ctx.font = "bold 32px sans-serif";
    ctx.fillText("SIM Seumur Hidup Gratis Tanpa Perpanjangan", 88, 272);

    ctx.fillStyle = "#CBD5E1";
    ctx.font = "22px sans-serif";
    ctx.fillText(
      "TIDAK BENAR. Korlantas Polri menegaskan masa berlaku SIM",
      88,
      328
    );
    ctx.fillText(
      "tetap 5 tahun sesuai UU No. 22 Tahun 2009 tentang LLAJ.",
      88,
      364
    );

    ctx.fillStyle = "#34D399";
    ctx.font = "18px monospace";
    ctx.fillText(
      "Sumber: korlantas.polri.go.id | Sample Uji KLAIMSCAN AI",
      88,
      444
    );

    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Gagal membuat sample PNG"));
        return;
      }
      resolve(
        new File([blob], "sample-vereditum-sim.png", { type: "image/png" })
      );
    }, "image/png");
  });
}

interface DropzoneScannerProps {
  serverConfig: ServerConfigStatus;
  onAnalysisComplete: (report: InvestigationReport) => void;
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
      const msg = "Ukuran file melebihi batas maksimal 5 MB.";
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
      const sampleFile = await createSamplePngFile();
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
      onAnalysisComplete(completedReport);
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
    <Card className="border-[#254159] bg-[#0D2133]/90">
      <CardHeader className="flex flex-row items-center justify-between gap-4 border-b border-[#254159]/70 pb-4">
        <div>
          <CardTitle className="text-lg">New Intelligence Analysis</CardTitle>
          <p className="mt-1 text-xs text-[#8BA4C0]">
            Unggah screenshot postingan media sosial (PNG, JPG, WEBP maks. 5 MB)
            untuk ekstraksi klaim, penelusuran web langsung, dan laporan
            terverifikasi.
          </p>
        </div>
        <span className="font-mono text-xs tracking-widest text-[#45DDEB]">
          IMAGE INPUT
        </span>
      </CardHeader>

      <CardContent className="space-y-4 pt-5">
        {!serverConfig.openAiConfigured && (
          <Alert variant="warning">
            <Sparkles className="size-4 text-[#FBBF24]" />
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
              "group relative flex min-h-[220px] cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-8 text-center transition-all",
              isDragging
                ? "border-[#45DDEB] bg-[#45DDEB]/10"
                : "border-[#254159] bg-[#07111E]/60 hover:border-[#45DDEB]/65 hover:bg-[#0A192A]"
            )}
          >
            <div className="mb-3 flex size-12 items-center justify-center rounded-xl border border-[#45DDEB]/30 bg-[#0D2133] text-[#45DDEB] transition-transform group-hover:scale-105">
              <ScanLine className="size-6" />
            </div>
            <p className="font-heading text-lg font-semibold text-[#F3F8FF]">
              Drop screenshot to analyze
            </p>
            <p className="mt-1 text-xs text-[#8BA4C0]">
              Instagram • TikTok • Facebook • WhatsApp • Format PNG, JPG, WEBP
              (Maks. 5 MB)
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
                SELECT SCREENSHOT
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={(e) => {
                  e.stopPropagation();
                  void loadGeneratedSample();
                }}
              >
                <FileImage className="size-4 text-[#45DDEB]" />
                Muat Sample Uji
              </Button>
            </div>
          </div>
        ) : (
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-3">
              <div className="relative overflow-hidden rounded-xl border border-[#254159] bg-[#07111E]">
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
                    className="pointer-events-none absolute inset-0 bg-[#07111E]/25"
                  >
                    <div className="animate-scan-line absolute inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#45DDEB] to-transparent shadow-[0_0_18px_#45DDEB]" />
                  </div>
                )}

                <div className="flex items-center justify-between border-t border-[#254159] bg-[#0A1826]/95 px-3 py-2 text-xs">
                  <div className="flex items-center gap-2 truncate">
                    <FileImage className="size-3.5 shrink-0 text-[#45DDEB]" />
                    <span className="truncate font-mono text-[#F3F8FF]">
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
                  className="font-mono text-xs uppercase tracking-wider text-[#8BA4C0]"
                >
                  Konteks Analis (Opsional)
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
                      MEMINDAI &amp; VERIFIKASI...
                    </>
                  ) : (
                    <>
                      <ScanLine className="size-4" />
                      JALANKAN ANALISIS AI
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

            <div className="rounded-xl border border-[#254159] bg-[#07111E]/75 p-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="font-mono text-xs font-semibold uppercase tracking-wider text-[#45DDEB]">
                  Pipeline Verifikasi (01–06)
                </span>
                <span className="font-mono text-xs text-[#8BA4C0]">
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
                        "border-[#34D399]/35 bg-[#34D399]/6",
                      step.status === "active" &&
                        "border-[#45DDEB]/60 bg-[#45DDEB]/10",
                      step.status === "error" &&
                        "border-[#F87171]/50 bg-[#F87171]/10",
                      step.status === "pending" &&
                        "border-[#254159]/60 bg-[#0D2133]/40"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono font-semibold text-[#F3F8FF]">
                        {step.code} — {step.label}
                      </span>
                      {step.status === "completed" && (
                        <CheckCircle2 className="size-3.5 shrink-0 text-[#34D399]" />
                      )}
                      {step.status === "active" && (
                        <Loader2 className="size-3.5 shrink-0 animate-spin text-[#45DDEB]" />
                      )}
                    </div>
                    <p className="mt-0.5 text-[11px] text-[#8BA4C0]">
                      {step.detail || step.description}
                    </p>
                  </li>
                ))}
              </ol>

              {isAnalyzing && (
                <div className="mt-4 space-y-2 rounded-lg border border-[#45DDEB]/30 bg-[#0D2133]/70 p-3">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-[#45DDEB]">
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
            <AlertDescription className="text-[#F87171]/90">
              {errorMessage}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1 text-xs text-[#8BA4C0]">
          <span className="inline-flex items-center gap-1.5">
            <Lock className="size-3.5 text-[#34D399]" />
            Server-side validation · Metadata stripped · Tanpa penyimpanan
            permanen
          </span>
          <span className="font-mono text-[11px] text-[#8BA4C0]/80">
            Maks. 5 MB • Zero private IP tracking
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
