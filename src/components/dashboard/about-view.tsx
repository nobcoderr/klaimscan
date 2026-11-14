"use client";

import { Button } from "@/components/ui/button";
import type { ServerConfigStatus } from "@/lib/types";

interface AboutViewProps {
  serverConfig: ServerConfigStatus;
  onVerify: () => void;
  onMethodology: () => void;
}

export function AboutView({
  serverConfig,
  onVerify,
  onMethodology,
}: AboutViewProps) {
  return (
    <article className="mx-auto max-w-3xl space-y-14">
      <header className="space-y-4">
        <p className="font-mono text-xs tracking-[0.16em] text-primary">
          KLAIMSCAN AI
        </p>
        <h1 className="font-heading text-5xl font-medium tracking-tight sm:text-6xl">
          Tentang
        </h1>
        <p className="text-base leading-relaxed text-muted-foreground">
          KLAIMSCAN membantu membaca klaim pada screenshot yang beredar, lalu
          menempatkannya di samping sumber terbuka. Hasilnya adalah berkas
          pemeriksaan, bukan putusan hukum dan bukan skor akurasi.
        </p>
      </header>

      <section className="space-y-4 border-t border-border pt-8">
        <h2 className="font-heading text-2xl font-semibold">Yang dihasilkan</h2>
        <ul className="list-disc space-y-3 pl-5 text-sm leading-relaxed text-muted-foreground sm:text-base">
          <li>Teks headline, overlay, dan caption yang terbaca.</li>
          <li>Proposisi faktual yang bisa diuji satu per satu.</li>
          <li>Sumber pendukung, pembantah, dan yang belum cukup.</li>
          <li>Jejak waktu dan tautan publik yang terindeks.</li>
        </ul>
      </section>

      <section className="space-y-4 border-t border-border pt-8">
        <h2 className="font-heading text-2xl font-semibold">Kesiapan pipeline</h2>
        <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
          Kunci API tidak dikirim ke browser. Status di bawah hanya menyatakan
          apakah server sudah dikonfigurasi.
        </p>
        <dl className="divide-y divide-border border border-border">
          <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <dt>OpenAI Vision dan penelusuran web</dt>
            <dd className="font-mono text-xs text-primary">
              {serverConfig.openAiConfigured ? "Terkonfigurasi" : "Mode demo"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <dt>Google Fact Check Tools API</dt>
            <dd className="font-mono text-xs text-muted-foreground">
              {serverConfig.factCheckConfigured
                ? "Terkonfigurasi"
                : "Opsional, nonaktif"}
            </dd>
          </div>
          <div className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
            <dt>MAFINDO Yudistira</dt>
            <dd className="font-mono text-xs text-muted-foreground">
              {serverConfig.mafindoConfigured
                ? "Terkonfigurasi"
                : "Opsional, nonaktif"}
            </dd>
          </div>
          <div className="space-y-1 px-4 py-3 font-mono text-xs text-muted-foreground">
            <div>Vision model: {serverConfig.visionModel}</div>
            <div>Search model: {serverConfig.searchModel}</div>
          </div>
        </dl>
        <div className="flex flex-wrap gap-3 pt-2">
          <Button type="button" variant="cyber" onClick={onVerify}>
            Periksa Klaim
          </Button>
          <Button type="button" variant="outline" onClick={onMethodology}>
            Baca metodologi
          </Button>
        </div>
      </section>
    </article>
  );
}
