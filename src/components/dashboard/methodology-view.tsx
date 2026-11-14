"use client";

import { VerdictBadge } from "./verdict-badges";

const STEPS = [
  {
    index: "01",
    title: "Masukan",
    body: "Berkas yang diterima adalah screenshot PNG, JPG, atau WEBP, paling besar 4 MB. Tanda tangan berkas diperiksa, lalu metadata EXIF dan XMP dihapus sebelum teks dibaca.",
  },
  {
    index: "02",
    title: "Pembacaan teks",
    body: "OCR berjalan dua tahap. Tahap pertama menyalin headline, teks overlay, dan caption beserta posisinya. Tahap kedua memecah teks itu menjadi proposisi: subjek, tindakan, objek, dan keterangan waktu bila tertulis.",
  },
  {
    index: "03",
    title: "Penelusuran",
    body: "Proposisi dicari bersamaan di MAFINDO Yudistira, Google Fact Check, dan web terbuka. Yudistira membantu menemukan pemeriksaan yang sudah ada. Status angka di basis data itu tidak diubah menjadi hoaks, valid, menyesatkan, atau belum terverifikasi.",
  },
  {
    index: "04",
    title: "Perbandingan",
    body: "Setiap sumber mendapat satu posisi terhadap klaim: mendukung, membantah, konteks parsial, bukti belum cukup, atau dikecualikan. Sumber yang hanya membahas keaslian gambar, atau klarifikasi dari periode lain, masuk kelompok yang dikecualikan.",
  },
  {
    index: "05",
    title: "Verdict",
    body: "Mesin verdict memakai posisi bukti yang membahas proposisi, peristiwa, dan waktu yang sama. Niat mengundurkan diri tidak disamakan dengan pengunduran diri yang sudah resmi, dan rencana program tidak disamakan dengan program yang sudah berjalan. Artikel yang hanya menguji foto tidak membatalkan klaim tekstual.",
  },
  {
    index: "06",
    title: "Hasil",
    body: "Hasil disusun sebagai ringkasan, daftar bukti, linimasa, dan jejak publik. Setiap bagian memuat tautan sumber dan identitas pemeriksaan.",
  },
];

const VERDICTS = [
  {
    verdict: "TRUE" as const,
    body: "Valid. Sumber relevan yang terindeks mendukung klaim tekstual yang diuji.",
  },
  {
    verdict: "FALSE" as const,
    body: "Hoaks. Sumber relevan yang terindeks membantah klaim tekstual yang diuji.",
  },
  {
    verdict: "MISLEADING" as const,
    body: "Sebagian muatan punya jejak, tetapi keseluruhan klaim menyesatkan karena konteks, kutipan, atau cakupan yang tidak utuh.",
  },
  {
    verdict: "OUTDATED" as const,
    body: "Klaim merujuk peristiwa atau status yang sudah tidak berlaku pada periode yang sedang diuji.",
  },
  {
    verdict: "UNVERIFIED" as const,
    body: "Butuh verifikasi. Bukti yang terindeks belum cukup, atau teksnya belum cukup jelas. Ketiadaan bukti tidak diubah menjadi hoaks.",
  },
];

export function MethodologyView() {
  return (
    <article className="mx-auto max-w-3xl space-y-16">
      <header className="space-y-5">
        <p className="font-mono text-xs tracking-[0.16em] text-primary">
          METODE
        </p>
        <h1 className="font-heading text-5xl font-medium tracking-tight sm:text-6xl">
          Metodologi
        </h1>
        <p className="font-sans text-lg leading-relaxed text-muted-foreground">
          Enam tahap mengubah screenshot menjadi verdict. Urutannya tetap:
          berkas, teks, penelusuran, perbandingan, keputusan, lalu laporan.
        </p>
      </header>

      <ol className="space-y-10">
        {STEPS.map((step) => (
          <li key={step.index} className="grid gap-3 border-t border-border pt-8 sm:grid-cols-[4.5rem_minmax(0,1fr)] sm:gap-8">
            <p className="font-mono text-sm text-primary">{step.index}</p>
            <div>
              <h2 className="font-heading text-3xl font-medium tracking-tight">
                {step.title}
              </h2>
              <p className="mt-3 font-sans text-base leading-relaxed text-muted-foreground">
                {step.body}
              </p>
            </div>
          </li>
        ))}
      </ol>

      <section className="space-y-6 border-t border-border pt-10">
        <h2 className="font-heading text-3xl font-medium tracking-tight">
          Tiga bacaan
        </h2>
        <p className="font-sans text-base leading-relaxed text-muted-foreground">
          Hoaks hanya muncul bila bukti membantah. Valid hanya muncul bila bukti
          mendukung. Butuh verifikasi dipakai bila bukti belum cukup. Klaim
          menyesatkan dan kedaluwarsa tidak dimasukkan ke salah satu dari
          ketiganya.
        </p>
      </section>

      <section className="space-y-6 border-t border-border pt-10">
        <h2 className="font-heading text-3xl font-medium tracking-tight">
          Lima verdict
        </h2>
        <p className="font-sans text-base leading-relaxed text-muted-foreground">
          Satu klaim menerima satu verdict. Label di bawah adalah arti masing-masing
          status pada hasil pemeriksaan.
        </p>
        <ul className="space-y-4">
          {VERDICTS.map((item) => (
            <li
              key={item.verdict}
              className="grid gap-3 border border-border bg-card p-4 sm:grid-cols-[220px_minmax(0,1fr)] sm:items-center"
            >
              <VerdictBadge verdict={item.verdict} />
              <p className="font-sans text-sm leading-relaxed text-muted-foreground">
                {item.body}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </article>
  );
}
