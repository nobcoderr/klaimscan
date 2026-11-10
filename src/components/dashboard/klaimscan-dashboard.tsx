"use client";

import * as React from "react";
import {
  Activity,
  Clock,
  Database,
  FileSearch,
  FileText,
  History,
  LayoutDashboard,
  Menu,
  Printer,
  Radar,
  ScanSearch,
  Shield,
  ShieldAlert,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { DEMO_CASES, DEMO_DATASET_BASELINE } from "@/data/demo-cases";
import type { InvestigationReport, ServerConfigStatus } from "@/lib/types";
import { cn } from "@/lib/utils";
import { AnalysisResult, type ResultViewTab } from "./analysis-result";
import { CaseHistoryView } from "./case-history-view";
import { DropzoneScanner } from "./dropzone-scanner";
import { EvidenceRegistryView } from "./evidence-registry-view";

type SidebarSection =
  | "dashboard"
  | "new-analysis"
  | "analysis-result"
  | "evidence-timeline"
  | "public-trace"
  | "case-report"
  | "case-history"
  | "evidence-sources";

interface KlaimscanDashboardProps {
  initialServerConfig: ServerConfigStatus;
}

const SIDEBAR_ITEMS: Array<{
  id: SidebarSection;
  label: string;
  code: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = [
  { id: "dashboard", label: "Dashboard", code: "01", Icon: LayoutDashboard },
  { id: "new-analysis", label: "New Analysis", code: "02", Icon: ScanSearch },
  {
    id: "analysis-result",
    label: "Analysis Result",
    code: "03",
    Icon: FileText,
  },
  {
    id: "evidence-timeline",
    label: "Evidence Timeline",
    code: "04",
    Icon: Clock,
  },
  { id: "public-trace", label: "Public Source Trace", code: "05", Icon: Radar },
  { id: "case-report", label: "Case Report", code: "06", Icon: Printer },
  { id: "case-history", label: "Case History", code: "07", Icon: History },
  {
    id: "evidence-sources",
    label: "Evidence Registry",
    code: "08",
    Icon: Database,
  },
];

export function KlaimscanDashboard({
  initialServerConfig,
}: KlaimscanDashboardProps) {
  const [serverConfig] = React.useState(initialServerConfig);
  const [section, setSection] = React.useState<SidebarSection>("dashboard");
  const [resultTab, setResultTab] = React.useState<ResultViewTab>("assessment");
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

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
    allCases.find((c) => c.caseId === activeCaseId) ?? allCases[0];

  const kpiCasesAnalyzed =
    DEMO_DATASET_BASELINE.casesAnalyzed + sessionReports.length;
  const kpiFlaggedClaims =
    DEMO_DATASET_BASELINE.flaggedClaims +
    sessionReports.filter(
      (r) =>
        r.verdict.claimVerdict === "FALSE" ||
        r.verdict.claimVerdict === "MISLEADING"
    ).length;
  const kpiSourcesFound =
    DEMO_DATASET_BASELINE.sourcesFound +
    sessionReports.reduce((sum, r) => sum + r.evidenceSources.length, 0);

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
    setActiveCaseId(report.caseId);
    setResultTab("assessment");
    setSection("analysis-result");
  };

  const handleOpenCase = (
    caseId: string,
    preferredTab: ResultViewTab = "assessment"
  ) => {
    setActiveCaseId(caseId);
    setResultTab(preferredTab);
    if (preferredTab === "trace") {
      setSection("public-trace");
    } else if (preferredTab === "timeline") {
      setSection("evidence-timeline");
    } else if (preferredTab === "report") {
      setSection("case-report");
    } else {
      setSection("analysis-result");
    }
  };

  const handleNavClick = (next: SidebarSection) => {
    setSection(next);
    if (next === "public-trace") {
      setResultTab("trace");
    } else if (next === "evidence-timeline") {
      setResultTab("timeline");
    } else if (next === "case-report") {
      setResultTab("report");
    } else if (next === "dashboard" || next === "analysis-result") {
      setResultTab("assessment");
    }
    setMobileMenuOpen(false);
  };

  const handleResultTabChange = (tab: ResultViewTab) => {
    setResultTab(tab);
    if (section !== "dashboard") {
      if (tab === "trace") setSection("public-trace");
      else if (tab === "timeline") setSection("evidence-timeline");
      else if (tab === "report") setSection("case-report");
      else setSection("analysis-result");
    }
  };

  return (
    <div className="soc-grid-bg min-h-screen bg-[#07111E] text-[#F3F8FF]">
      {/* Top SOC Header Bar */}
      <header className="no-print sticky top-0 z-40 border-b border-[#254159] bg-[#07111E]/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              size="icon"
              variant="outline"
              className="lg:hidden"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="Toggle navigasi sidebar"
            >
              {mobileMenuOpen ? (
                <X className="size-4" />
              ) : (
                <Menu className="size-4" />
              )}
            </Button>

            <div className="flex size-9 items-center justify-center rounded-lg border border-[#45DDEB]/40 bg-[#0D2133] text-[#45DDEB] shadow-[0_0_16px_rgba(69,221,235,0.18)]">
              <Shield className="size-5" />
            </div>
            <div>
              <div className="flex items-center gap-1.5 font-heading text-lg font-bold tracking-tight">
                <span>KLAIMSCAN</span>
                <span className="text-[#45DDEB]">AI</span>
              </div>
              <p className="font-mono text-[10px] tracking-[0.2em] text-[#8BA4C0]">
                DISINFORMATION INTELLIGENCE
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Dialog>
              <DialogTrigger asChild>
                <button
                  type="button"
                  className="inline-flex cursor-pointer items-center gap-2 rounded-full border border-[#254159] bg-[#0D2133] px-3 py-1.5 font-mono text-xs transition-colors hover:border-[#45DDEB]/50"
                >
                  <span
                    className={cn(
                      "size-2 rounded-full",
                      serverConfig.openAiConfigured
                        ? "bg-[#34D399] shadow-[0_0_8px_#34D399]"
                        : "bg-[#FBBF24] shadow-[0_0_8px_#FBBF24]"
                    )}
                  />
                  <span className="text-[#34D399]">SYSTEM ONLINE</span>
                  <span className="hidden text-[#8BA4C0] sm:inline">
                    {serverConfig.openAiConfigured
                      ? "• LIVE AI READY"
                      : "• DEMO MODE"}
                  </span>
                </button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Status Kesiapan Pipeline AI</DialogTitle>
                  <DialogDescription>
                    Pemeriksaan konfigurasi variabel lingkungan server (API key
                    tidak pernah diekspos ke browser).
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between rounded-lg border border-[#254159] bg-[#07111E] px-3 py-2.5">
                    <span>OpenAI Vision &amp; Web Search</span>
                    <Badge
                      variant={
                        serverConfig.openAiConfigured ? "verified" : "warning"
                      }
                    >
                      {serverConfig.openAiConfigured
                        ? "Terkonfigurasi"
                        : "Demo Mode (Key Belum Diisi)"}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between rounded-lg border border-[#254159] bg-[#07111E] px-3 py-2.5">
                    <span>Google Fact Check Tools API</span>
                    <Badge
                      variant={
                        serverConfig.factCheckConfigured
                          ? "verified"
                          : "secondary"
                      }
                    >
                      {serverConfig.factCheckConfigured
                        ? "Terkonfigurasi"
                        : "Opsional / Nonaktif"}
                    </Badge>
                  </div>
                  <div className="rounded-lg border border-[#254159] bg-[#07111E] px-3 py-2.5 font-mono text-xs text-[#8BA4C0]">
                    <div>Vision model: {serverConfig.visionModel}</div>
                    <div>Search model: {serverConfig.searchModel}</div>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1440px]">
        {/* Dark SOC Sidebar */}
        <aside
          className={cn(
            "no-print fixed inset-y-16 left-0 z-30 w-64 shrink-0 overflow-y-auto border-r border-[#254159] bg-[#07111E]/95 p-4 backdrop-blur-md transition-transform lg:static lg:block lg:translate-x-0",
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <div className="mb-3 px-2 font-mono text-[10px] uppercase tracking-[0.2em] text-[#8BA4C0]">
            SOC Navigation
          </div>
          <nav className="space-y-1.5" aria-label="Navigasi utama">
            {SIDEBAR_ITEMS.map(({ id, label, code, Icon }) => {
              const active = section === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleNavClick(id)}
                  className={cn(
                    "flex w-full cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-all",
                    active
                      ? "border-[#45DDEB]/45 bg-[#112940] text-[#45DDEB] shadow-[0_0_16px_rgba(69,221,235,0.1)]"
                      : "border-transparent text-[#8BA4C0] hover:border-[#254159] hover:bg-[#0D2133] hover:text-[#F3F8FF]"
                  )}
                >
                  <span className="flex items-center gap-2.5 font-medium">
                    <Icon className="size-4" />
                    {label}
                  </span>
                  <span className="font-mono text-[10px] opacity-70">
                    {code}
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="mt-6 rounded-xl border border-[#254159] bg-[#0D2133]/80 p-3.5">
            <div className="flex items-center justify-between">
              <p className="font-mono text-[10px] uppercase tracking-wider text-[#45DDEB]">
                Demo Mode Fixtures
              </p>
              <Badge variant="warning" className="px-1.5 py-0 text-[10px]">
                FIXTURE
              </Badge>
            </div>
            <p className="mt-1.5 font-mono text-xs font-semibold text-[#F3F8FF]">
              {activeReport.caseId}
            </p>
            <p className="mt-1 line-clamp-2 text-xs text-[#8BA4C0]">
              {activeReport.claimExtraction.primaryClaim}
            </p>
            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {DEMO_CASES.map((demo, idx) => (
                <button
                  key={demo.caseId}
                  type="button"
                  title={demo.demoCategoryLabel || demo.title}
                  onClick={() => handleOpenCase(demo.caseId, "assessment")}
                  className={cn(
                    "cursor-pointer rounded border px-1.5 py-1 font-mono text-[10px] transition-colors",
                    activeCaseId === demo.caseId
                      ? "border-[#45DDEB]/60 bg-[#45DDEB]/15 text-[#45DDEB]"
                      : "border-[#254159] bg-[#07111E] text-[#8BA4C0] hover:text-[#F3F8FF]"
                  )}
                >
                  D-{idx + 1}
                </button>
              ))}
            </div>
          </div>
        </aside>

        {/* Main Operations Workspace */}
        <main className="min-w-0 flex-1 px-4 py-6 lg:px-8">
          {/* Quick Top Operation Strip */}
          <div className="no-print mb-5 flex flex-wrap items-center gap-2">
            {(
              [
                { id: "dashboard", label: "DASHBOARD" },
                { id: "new-analysis", label: "NEW ANALYSIS" },
                { id: "analysis-result", label: "ANALYSIS RESULT" },
                { id: "evidence-timeline", label: "EVIDENCE TIMELINE" },
                { id: "public-trace", label: "PUBLIC TRACE" },
                { id: "case-report", label: "CASE REPORT" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => handleNavClick(item.id)}
                className={cn(
                  "cursor-pointer rounded-lg px-3 py-1.5 font-mono text-xs font-medium tracking-wider transition-colors",
                  section === item.id
                    ? "border border-[#45DDEB]/40 bg-[#113148] text-[#45DDEB]"
                    : "text-[#8BA4C0] hover:bg-[#0D2133] hover:text-[#F3F8FF]"
                )}
              >
                {item.label}
              </button>
            ))}
          </div>

          {/* Section Header */}
          <div className="no-print mb-6">
            <p className="font-mono text-xs font-semibold tracking-[0.18em] text-[#45DDEB]">
              INTELLIGENCE OPERATIONS / 001
            </p>
            <h1 className="mt-1 font-heading text-2xl font-bold tracking-tight text-[#F3F8FF] sm:text-3xl">
              Threat Intelligence Dashboard
            </h1>
            <p className="mt-1 text-sm text-[#8BA4C0]">
              Verifikasi klaim berita berbasis teks (OCR headline &amp; caption)
              dengan sumber resmi dan penelusuran terbuka (Kategori Siber Sosial)
            </p>
          </div>

          {section === "dashboard" && (
            <div className="space-y-6">
              {/* 3 KPI Telemetry Cards */}
              <div className="no-print grid gap-4 md:grid-cols-3">
                <Card>
                  <CardContent className="pt-5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs tracking-wider text-[#8BA4C0]">
                        CASES ANALYZED
                      </span>
                      <FileSearch className="size-4 text-[#45DDEB]" />
                    </div>
                    <div className="mt-2 font-heading text-3xl font-bold text-[#F3F8FF]">
                      {String(kpiCasesAnalyzed).padStart(3, "0")}
                    </div>
                    <p className="mt-1 text-xs text-[#8BA4C0]">
                      Demo dataset
                      {sessionReports.length > 0
                        ? ` + ${sessionReports.length} live sesi ini`
                        : ""}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs tracking-wider text-[#8BA4C0]">
                        FLAGGED CLAIMS
                      </span>
                      <ShieldAlert className="size-4 text-[#34D399]" />
                    </div>
                    <div className="mt-2 font-heading text-3xl font-bold text-[#F3F8FF]">
                      {String(kpiFlaggedClaims).padStart(3, "0")}
                    </div>
                    <p className="mt-1 text-xs text-[#8BA4C0]">
                      Demo dataset
                      {sessionReports.length > 0
                        ? ` + ${sessionReports.filter((r) => r.verdict.claimVerdict === "FALSE" || r.verdict.claimVerdict === "MISLEADING").length} live sesi ini`
                        : ""}
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="pt-5">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs tracking-wider text-[#8BA4C0]">
                        SOURCES FOUND
                      </span>
                      <Activity className="size-4 text-[#45DDEB]" />
                    </div>
                    <div className="mt-2 font-heading text-3xl font-bold text-[#F3F8FF]">
                      {String(kpiSourcesFound).padStart(3, "0")}
                    </div>
                    <p className="mt-1 text-xs text-[#8BA4C0]">
                      Demo dataset
                      {sessionReports.length > 0
                        ? ` + ${sessionReports.reduce((sum, r) => sum + r.evidenceSources.length, 0)} live sesi ini`
                        : ""}
                    </p>
                  </CardContent>
                </Card>
              </div>

              <div className="no-print">
                <DropzoneScanner
                  serverConfig={serverConfig}
                  onAnalysisComplete={handleAnalysisComplete}
                  onSelectDemoCase={(id) => handleOpenCase(id, "assessment")}
                />
              </div>

              <AnalysisResult
                report={activeReport}
                screenshotPreviewUrl={sessionPreviews[activeReport.caseId]}
                activeTab={resultTab}
                onTabChange={handleResultTabChange}
              />
            </div>
          )}

          {section === "new-analysis" && (
            <div className="space-y-6">
              <DropzoneScanner
                serverConfig={serverConfig}
                onAnalysisComplete={handleAnalysisComplete}
                onSelectDemoCase={(id) => handleOpenCase(id, "assessment")}
              />
            </div>
          )}

          {(section === "analysis-result" ||
            section === "evidence-timeline" ||
            section === "public-trace" ||
            section === "case-report") && (
            <AnalysisResult
              report={activeReport}
              screenshotPreviewUrl={sessionPreviews[activeReport.caseId]}
              activeTab={resultTab}
              onTabChange={handleResultTabChange}
            />
          )}

          {section === "case-history" && (
            <CaseHistoryView
              cases={allCases}
              activeCaseId={activeCaseId}
              onSelectCase={(id) => handleOpenCase(id, "assessment")}
            />
          )}

          {section === "evidence-sources" && (
            <EvidenceRegistryView
              cases={allCases}
              onSelectCase={(id) => handleOpenCase(id, "assessment")}
            />
          )}
        </main>
      </div>
    </div>
  );
}
