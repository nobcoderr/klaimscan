"use client";

import { Button } from "@/components/ui/button";

const WORKFLOW = [
  {
    index: "01",
    title: "Unggah screenshot",
    body: "PNG, JPG, atau WEBP, maksimal 4 MB. Metadata gambar dihapus sebelum teks dibaca.",
  },
  {
    index: "02",
    title: "Baca teks yang terlihat",
    body: "OCR mengambil headline, overlay, dan caption. Klaim dinormalisasi dari teks itu, bukan dari foto sampul.",
  },
  {
    index: "03",
    title: "Bandingkan sumber terbuka",
    body: "Sumber yang terindeks dipetakan sebagai mendukung, membantah, konteks parsial, atau belum cukup.",
  },
  {
    index: "04",
    title: "Tetapkan verdict",
    body: "Hoaks bila bukti membantah, valid bila bukti mendukung, butuh verifikasi bila bukti belum cukup. Menyesatkan dan kedaluwarsa tetap terpisah.",
  },
];

interface HomeViewProps {
  onVerify: () => void;
  onMethodology: () => void;
}

export function HomeView({ onVerify, onMethodology }: HomeViewProps) {
  return (
    <div className="space-y-20 sm:space-y-28">
      <section className="grid items-end gap-12 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.7fr)] lg:gap-16">
        <div className="border-l-2 border-primary pl-5 sm:pl-7">
          <p className="font-mono text-xs tracking-[0.18em] text-primary">
            VERIFIKASI TEKS-DULU
          </p>
          <h1 className="mt-4 max-w-3xl font-heading text-5xl font-medium leading-[1.02] tracking-tight text-foreground sm:text-7xl">
            Klaim di screenshot dibaca sebagai teks.
          </h1>
          <p className="mt-6 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg">
            Unggah tangkapan layar. KLAIMSCAN mengekstrak headline dan caption,
            lalu membandingkannya dengan sumber terbuka yang terindeks.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button type="button" variant="cyber" size="lg" onClick={onVerify}>
              Periksa Klaim
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              onClick={onMethodology}
            >
              Metodologi
            </Button>
          </div>
        </div>

        <aside className="border border-border bg-card p-6 sm:p-8">
          <p className="font-mono text-xs tracking-[0.16em] text-muted-foreground">
            YANG DIPERIKSA
          </p>
          <dl className="mt-6 space-y-6">
            <div>
              <dt className="text-sm text-foreground">Headline dan caption</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Teks pada gambar berita, overlay, dan keterangan unggahan.
              </dd>
            </div>
            <div className="border-t border-border pt-6">
              <dt className="text-sm text-foreground">Sumber terbuka</dt>
              <dd className="mt-1 text-sm leading-relaxed text-muted-foreground">
                Rujukan yang berhasil diambil, lengkap dengan tautan dan alasan
                pemetaannya.
              </dd>
            </div>
          </dl>
        </aside>
      </section>

      <section className="space-y-8">
        <div className="max-w-2xl">
          <h2 className="font-heading text-4xl font-medium tracking-tight">
            Tiga bacaan.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Hoaks, valid, dan butuh verifikasi tidak saling menggantikan.
            Klaim yang belum cukup bukti tidak disebut hoaks.
          </p>
        </div>
        <ol className="grid gap-px border border-border bg-border md:grid-cols-3">
          <li className="bg-card p-6">
            <p className="font-heading text-3xl font-medium text-verdict-false">
              Hoaks
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Sumber yang selaras membantah klaim yang tertulis.
            </p>
          </li>
          <li className="bg-card p-6">
            <p className="font-heading text-3xl font-medium text-verdict-true">
              Valid
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Sumber yang selaras mendukung klaim yang tertulis.
            </p>
          </li>
          <li className="bg-card p-6">
            <p className="font-heading text-3xl font-medium text-verdict-open">
              Butuh verifikasi
            </p>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
              Teks belum cukup jelas, atau bukti yang terindeks belum cukup
              untuk memilih hoaks atau valid.
            </p>
          </li>
        </ol>
      </section>

      <section className="space-y-8">
        <div className="max-w-2xl">
          <h2 className="font-heading text-4xl font-medium tracking-tight">
            Empat langkah, satu berkas.
          </h2>
          <p className="mt-3 text-base leading-relaxed text-muted-foreground">
            Alur yang sama berjalan pada setiap screenshot: validasi berkas,
            pembacaan teks, perbandingan bukti, lalu penetapan bacaan.
          </p>
        </div>
        <ol className="grid gap-px border border-border bg-border sm:grid-cols-2 xl:grid-cols-4">
          {WORKFLOW.map((step) => (
            <li key={step.index} className="bg-card p-6">
              <p className="font-mono text-xs text-primary">{step.index}</p>
              <h3 className="mt-4 font-heading text-2xl font-medium">
                {step.title}
              </h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </li>
          ))}
        </ol>
      </section>
    </div>
  );
}
