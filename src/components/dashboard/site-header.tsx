"use client";

import * as React from "react";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import type { ServerConfigStatus } from "@/lib/types";
import { cn } from "@/lib/utils";

export type AppScreen =
  | "home"
  | "verify"
  | "result"
  | "history"
  | "methodology"
  | "about";

const NAV_ITEMS: Array<{ id: Exclude<AppScreen, "result">; label: string }> = [
  { id: "home", label: "Beranda" },
  { id: "verify", label: "Verifikasi" },
  { id: "history", label: "Riwayat" },
  { id: "methodology", label: "Metodologi" },
  { id: "about", label: "Tentang" },
];

interface SiteHeaderProps {
  screen: AppScreen;
  serverConfig: ServerConfigStatus;
  onNavigate: (screen: AppScreen) => void;
}

function navButtonClass(active: boolean) {
  return cn(
    "inline-flex h-11 cursor-pointer items-center border-b-2 px-1 text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring",
    active
      ? "border-primary text-foreground"
      : "border-transparent text-muted-foreground hover:text-foreground"
  );
}

function PipelineStatus({ serverConfig }: { serverConfig: ServerConfigStatus }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button
          type="button"
          className="inline-flex h-11 cursor-pointer items-center gap-2 px-1 text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
        >
          <span
            className={cn(
              "inline-block size-2",
              serverConfig.openAiConfigured ? "bg-primary" : "bg-verdict-mislead"
            )}
            aria-hidden="true"
          />
          Kesiapan pipeline
        </button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kesiapan pipeline</DialogTitle>
          <DialogDescription>
            Pemeriksaan konfigurasi server. Kunci API tidak dikirim ke browser.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 text-sm">
          <div className="flex items-center justify-between gap-3 border border-border bg-background px-3 py-3">
            <span>OpenAI Vision dan penelusuran web</span>
            <Badge variant={serverConfig.openAiConfigured ? "verified" : "warning"}>
              {serverConfig.openAiConfigured ? "Terkonfigurasi" : "Mode demo"}
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-3 border border-border bg-background px-3 py-3">
            <span>Google Fact Check Tools API</span>
            <Badge
              variant={serverConfig.factCheckConfigured ? "verified" : "secondary"}
            >
              {serverConfig.factCheckConfigured
                ? "Terkonfigurasi"
                : "Opsional, nonaktif"}
            </Badge>
          </div>
          <div className="flex items-center justify-between gap-3 border border-border bg-background px-3 py-3">
            <span>MAFINDO Yudistira</span>
            <Badge
              variant={serverConfig.mafindoConfigured ? "verified" : "secondary"}
            >
              {serverConfig.mafindoConfigured
                ? "Terkonfigurasi"
                : "Opsional, nonaktif"}
            </Badge>
          </div>
          <div className="border border-border bg-background px-3 py-3 font-mono text-xs text-muted-foreground">
            <div>Vision model: {serverConfig.visionModel}</div>
            <div>Search model: {serverConfig.searchModel}</div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function SiteHeader({
  screen,
  serverConfig,
  onNavigate,
}: SiteHeaderProps) {
  const [open, setOpen] = React.useState(false);
  const activeNav = screen === "result" ? "verify" : screen;

  React.useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const go = (next: AppScreen) => {
    setOpen(false);
    onNavigate(next);
  };

  return (
    <header className="no-print sticky top-0 z-40 border-b border-border/80 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <div className="flex items-center gap-4 lg:gap-8">
          <button
            type="button"
            onClick={() => go("home")}
            className="inline-flex cursor-pointer items-center gap-2 outline-none focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          >
            <span className="ks-mark inline-block h-5 w-1 bg-primary" aria-hidden="true" />
            <span className="font-heading text-lg font-bold tracking-tight">
              KLAIMSCAN
            </span>
          </button>

          <nav className="hidden items-center gap-4 lg:flex" aria-label="Navigasi utama">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.id)}
                aria-current={activeNav === item.id ? "page" : undefined}
                className={navButtonClass(activeNav === item.id)}
              >
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          <div className="hidden md:block">
            <PipelineStatus serverConfig={serverConfig} />
          </div>
          <Button type="button" variant="cyber" size="sm" onClick={() => go("verify")}>
            Periksa Klaim
          </Button>
          <button
            type="button"
            className="inline-flex size-11 cursor-pointer items-center justify-center border border-border text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring lg:hidden"
            aria-expanded={open}
            aria-controls="menu-mobile"
            aria-label={open ? "Tutup menu" : "Buka menu"}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? <X className="size-4" /> : <Menu className="size-4" />}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="menu-mobile"
          aria-label="Navigasi utama"
          className="border-t border-border bg-background px-4 py-4 lg:hidden"
        >
          <div className="flex flex-col">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => go(item.id)}
                aria-current={activeNav === item.id ? "page" : undefined}
                className="flex h-12 cursor-pointer items-center text-left text-base text-foreground outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
              >
                {item.label}
              </button>
            ))}
            <div className="border-t border-border pt-3 md:hidden">
              <PipelineStatus serverConfig={serverConfig} />
            </div>
          </div>
        </nav>
      )}
    </header>
  );
}
