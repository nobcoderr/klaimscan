"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { DEMO_CASES } from "@/data/demo-cases";
import type { InvestigationReport, ServerConfigStatus } from "@/lib/types";
import { AboutView } from "./about-view";
import { AnalysisResult, type ResultViewTab } from "./analysis-result";
import { CaseHistoryView } from "./case-history-view";
import { DemoFixtureSwitch } from "./demo-fixture-switch";
import { DropzoneScanner } from "./dropzone-scanner";
import { EvidenceRegistryView } from "./evidence-registry-view";
import { HomeView } from "./home-view";
import { MethodologyView } from "./methodology-view";
import { SiteHeader, type AppScreen } from "./site-header";

interface KlaimscanDashboardProps {
  initialServerConfig: ServerConfigStatus;
}

export function KlaimscanDashboard({
  initialServerConfig,
}: KlaimscanDashboardProps) {
  const [serverConfig] = React.useState(initialServerConfig);
  const [screen, setScreen] = React.useState<AppScreen>("home");
  const [resultTab, setResultTab] = React.useState<ResultViewTab>("assessment");

  const [sessionReports, setSessionReports] = React.useState<
    InvestigationReport[]
  >([]);
  const [sessionPreviews, setSessionPreviews] = React.useState<
    Record<string, string>
  >({});
  const previewsRef = React.useRef<Record<string, string>>({});
  const [activeCaseId, setActiveCaseId] = React.useState<string>(
    DEMO_CASES[0].caseId
  );

  React.useEffect(() => {
    previewsRef.current = sessionPreviews;
  }, [sessionPreviews]);

  React.useEffect(() => {
    return () => {
      for (const url of Object.values(previewsRef.current)) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  const allCases = React.useMemo(
    () => [...sessionReports, ...DEMO_CASES],
    [sessionReports]
  );

  const activeReport =
    allCases.find((item) => item.caseId === activeCaseId) ?? allCases[0];

  const openCase = (caseId: string, tab: ResultViewTab = "assessment") => {
    setActiveCaseId(caseId);
    setResultTab(tab);
    setScreen("result");
  };

  const handleAnalysisComplete = (
    report: InvestigationReport,
    ephemeralPreviewUrl?: string
  ) => {
    if (ephemeralPreviewUrl) {
      setSessionPreviews((prev) => ({
        ...prev,
        [report.caseId]: ephemeralPreviewUrl,
      }));
    }
    setSessionReports((prev) => [report, ...prev]);
    openCase(report.caseId, "assessment");
  };

  return (
    <div className="ks-grid min-h-screen bg-background text-foreground">
      <a
        href="#konten"
        className="skip-link"
      >
        Lewati ke konten
      </a>
      <SiteHeader
        screen={screen}
        serverConfig={serverConfig}
        onNavigate={setScreen}
      />

      <main
        id="konten"
        className="mx-auto w-full max-w-6xl scroll-mt-20 bg-background px-4 py-12 sm:px-6 sm:py-16"
      >
        {screen === "home" && (
          <div className="ks-rise">
            <HomeView
              onVerify={() => setScreen("verify")}
              onMethodology={() => setScreen("methodology")}
            />
          </div>
        )}

        {screen === "verify" && (
          <div className="ks-rise space-y-8">
            <header className="max-w-2xl space-y-3">
              <p className="font-mono text-xs tracking-[0.16em] text-primary">
                RUANG KERJA
              </p>
              <h1 className="font-heading text-4xl font-medium tracking-tight sm:text-5xl">
                Periksa klaim
              </h1>
              <p className="font-sans text-base leading-relaxed text-muted-foreground">
                Periksa klaim adalah langkah mengunggah screenshot dan menguji
                teks yang tertulis di dalamnya. Headline dan caption
                dibandingkan dengan sumber terbuka, lalu mendapat satu bacaan:
                hoaks, valid, menyesatkan, kedaluwarsa, atau butuh verifikasi.
              </p>
            </header>
            <DropzoneScanner
              serverConfig={serverConfig}
              onAnalysisComplete={handleAnalysisComplete}
              onSelectDemoCase={(id) => openCase(id)}
            />
            <div className="border-t border-border pt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => openCase(activeReport.caseId)}
              >
                Lihat hasil
              </Button>
            </div>
          </div>
        )}

        {screen === "result" && (
          <div className="ks-rise space-y-8">
            <header className="flex flex-wrap items-end justify-between gap-4">
              <div className="space-y-3">
                <p className="font-mono text-xs tracking-[0.16em] text-primary">
                  HASIL
                </p>
                <h1 className="font-heading text-4xl font-medium tracking-tight">
                  Hasil pemeriksaan
                </h1>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => setScreen("verify")}
              >
                Pemeriksaan baru
              </Button>
            </header>
            <div className="space-y-3">
              <p className="max-w-2xl font-sans text-sm leading-relaxed text-muted-foreground">
                Halaman ini menampilkan satu kasus saja. Daftar lengkap ada di
                Riwayat.
              </p>
              <DemoFixtureSwitch
                activeCaseId={activeCaseId}
                onSelect={(id) => openCase(id)}
              />
            </div>
            <AnalysisResult
              report={activeReport}
              screenshotPreviewUrl={
                sessionPreviews[activeReport.caseId] ??
                (activeReport.caseId === "KS-DEMO-001"
                  ? "/demo/vereditum-sim.jpg"
                  : undefined)
              }
              activeTab={resultTab}
              onTabChange={setResultTab}
            />
          </div>
        )}

        {screen === "history" && (
          <div className="ks-rise space-y-10">
            <header className="max-w-2xl space-y-3">
              <p className="font-mono text-xs tracking-[0.16em] text-primary">
                SESI BROWSER
              </p>
              <h1 className="font-heading text-4xl font-medium tracking-tight sm:text-5xl">
                Riwayat kasus
              </h1>
              <p className="font-sans text-base leading-relaxed text-muted-foreground">
                Riwayat menampilkan seluruh pemeriksaan pada sesi ini, termasuk
                enam fixture contoh. Pilih Buka pada satu baris untuk membuka
                hasil kasus itu saja.
              </p>
            </header>
            <CaseHistoryView
              cases={allCases}
              activeCaseId={activeCaseId}
              onSelectCase={(id) => openCase(id)}
            />
            <EvidenceRegistryView
              cases={allCases}
              onSelectCase={(id) => openCase(id)}
            />
          </div>
        )}

        {screen === "methodology" && (
          <div className="ks-rise">
            <MethodologyView />
          </div>
        )}
        {screen === "about" && (
          <div className="ks-rise">
            <AboutView
              serverConfig={serverConfig}
              onVerify={() => setScreen("verify")}
              onMethodology={() => setScreen("methodology")}
            />
          </div>
        )}
      </main>

    </div>
  );
}
