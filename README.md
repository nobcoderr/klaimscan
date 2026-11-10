# KLAIMSCAN AI — Evidence-Based Disinformation Intelligence Platform

**KLAIMSCAN AI** adalah platform intelijen verifikasi disinformasi (*Cyber Threat Intelligence Dashboard*) berbasis web untuk memeriksa keabsahan klaim pada screenshot unggahan media sosial secara terstruktur, teraudit, dan berbasis bukti terbuka (*open-source evidence*).

Dibangun untuk **Kartika Cyber Hackathon 2026 — Kategori Siber Sosial** (MVP Target: 10–15 November 2026).

---

## Kemampuan Utama MVP

1. **Screenshot Upload & Server-Side Sanitization**
   - Menerima gambar **PNG, JPG, atau WebP hingga 5 MB** dengan preview langsung di browser.
   - Validasi *magic bytes* di server, penghapusan segmen metadata EXIF/XMP/tEXt/eXIf secara *in-memory*, komputasi hash **SHA-256**, dan **zero permanent storage** untuk gambar pengguna.
2. **AI Vision Extraction & Post-Stance Isolation**
   - Mengekstrak teks terlihat, klaim faktual utama, platform, handle publik, URL publik terlihat, dan indikator tanggal via OpenAI Responses API (`OPENAI_VISION_MODEL`).
   - Memisahkan **5 sikap postingan**: `asserting_claim`, `debunking_claim`, `quoting_claim`, `neutral_discussion`, dan `unclear_context` sehingga akun pemeriksa fakta (contoh `@vereditum`) tidak pernah dilabeli sebagai pembuat hoaks.
3. **Live Web Evidence Search & Fact Check API**
   - Penelusuran web langsung menggunakan OpenAI Responses API `web_search` (`OPENAI_SEARCH_MODEL`) serta integrasi opsional **Google Fact Check Tools API** (`FACTCHECK_API_KEY`).
   - Hanya menampilkan URL nyata yang berasal dari respons API dan lolos penjagaan anti-SSRF (`url-guard.ts`).
4. **Evidence-Based Verdict Engine (Zero Fabricated Confidence)**
   - Mendukung status: `FALSE`, `TRUE`, `MISLEADING`, `OUTDATED`, dan `UNVERIFIED`.
   - Default aman ke `UNVERIFIED` jika bukti resmi atau pemeriksaan fakta independen tidak mencukupi. Tidak pernah menampilkan persentase kepercayaan numerik buatan LLM.
5. **Public Origin Trace (OSINT Terbatas)**
   - Menampilkan handle/URL publik yang terlihat pada screenshot, daftar sumber klarifikasi, dan kronologi waktu verifikasi secara transparan.
   - **Batasan privasi eksplisit**: tidak pernah mengklaim mengetahui IP pribadi, alamat rumah, lokasi GPS presisi, atau identitas hukum pengunggah; postingan publik paling awal yang teramati tidak dianggap penulis asli klaim.
6. **Print-Friendly Case Report**
   - Laporan forensik lengkap (klaim, post stance, verdict, bukti pendukung vs pembantah, URL klik-langsung, tanggal verifikasi, public trace, SHA-256, timestamp WIB, dan batasan metodologi) dengan tata letak cetak **Print / Save PDF**.

---

## Tech Stack

- **Framework**: Next.js 16 (App Router) + TypeScript
- **Styling & UI**: Tailwind CSS v4 + shadcn/ui (Radix UI) + Lucide Icons
- **AI & Search**: OpenAI Responses API (Vision + `web_search`), Google Fact Check Tools API
- **Validation & Security**: Zod, custom binary EXIF stripper, SSRF URL guard, sliding-window IP rate limiter
- **Testing**: Vitest (unit & API integration) + Playwright (end-to-end UI)

---

## Persiapan & Cara Menjalankan Secara Lokal

### Prasyarat

- **Node.js** `>= 20.9`
- **pnpm** (`>= 9`, pada Windows gunakan `pnpm.cmd` jika PowerShell memblokir eksekusi skrip `.ps1`)

### 1. Instalasi Dependensi

```bash
pnpm install
# Windows PowerShell:
pnpm.cmd install
```

### 2. Konfigurasi Variabel Lingkungan

Salin `.env.example` menjadi `.env.local` dan isi API key Anda (jangan pernah meng-commit `.env.local` ke Git):

```bash
cp .env.example .env.local
```

Variabel pada `.env.local`:

| Variabel | Wajib? | Keterangan | Default |
| --- | --- | --- | --- |
| `OPENAI_API_KEY` | Ya (untuk analisis live) | OpenAI API Key untuk model vision & `web_search` | Kosong (mengaktifkan DEMO MODE) |
| `OPENAI_VISION_MODEL` | Opsional | Membaca dan menganalisis screenshot via OpenAI Responses API vision | `gpt-5.4-mini` |
| `OPENAI_SEARCH_MODEL` | Opsional | Mencari bukti dan klarifikasi melalui internet via OpenAI `web_search` | `gpt-5.4-mini` |
| `FACTCHECK_API_KEY` | Opsional | Google Fact Check Tools API key | Kosong (fallback ke `web_search`) |

> Catatan: Apabila `OPENAI_API_KEY` belum diisi atau tidak aktif, antarmuka tetap berjalan penuh dalam **DEMO MODE** menggunakan 6 dataset fixture yang dilabeli jelas di [tests/fixtures/cases.ts](tests/fixtures/cases.ts), sementara endpoint live `/api/analyze` mengembalikan `503 OPENAI_NOT_CONFIGURED` tanpa memalsukan data.

### 3. Menjalankan Mode Pengembangan

```bash
pnpm dev
# Windows PowerShell:
pnpm.cmd dev
```

Buka `http://localhost:3000`.

### 4. Pengujian & Build Produksi

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm build
pnpm test:e2e
```

---

## Struktur Direktori Utama

```text
src/
├── app/
│   ├── api/analyze/route.ts       # Endpoint multipart upload + rate limit + streaming NDJSON
│   ├── api/health/route.ts        # Status kesiapan konfigurasi server tanpa membocorkan secret
│   ├── globals.css                # Token tema Cyber SOC & print stylesheet PDF
│   ├── layout.tsx                 # Root layout dark SOC theme + Toaster
│   └── page.tsx                   # Server Component entry point
├── components/
│   ├── dashboard/                 # Threat Intelligence Dashboard, Dropzone, Result, Timeline, Trace, Report
│   └── ui/                        # Komponen shadcn/ui terkurasi
├── data/
│   └── demo-cases.ts              # Re-export data fixture DEMO MODE terlabeli
└── lib/
    ├── env.ts                     # Resolusi aman env server-side & deteksi placeholder
    ├── image/sanitize.ts          # Validasi ukuran <=5MB, magic-bytes, strip EXIF/PNG/WebP, SHA-256
    ├── pipeline/                  # 6 tahap orkestrasi AI, evidence search, komparasi, verdict, trace, report
    └── security/                  # Rate limiter, SSRF URL guard, sanitasi pesan error API
tests/
├── fixtures/                      # Kasus DEMO MODE + generator buffer gambar uji
├── unit/                          # Vitest unit & route handler tests
└── e2e/                           # Playwright dashboard, upload preview, dan health checks
```

---

## Dokumentasi Tambahan

- [ARCHITECTURE.md](ARCHITECTURE.md) — Arsitektur 6-tahap, batas kepercayaan (*trust boundaries*), keamanan & privasi.
- [DEMO.md](DEMO.md) — Panduan demo live dan offline untuk presentasi Hackathon.
- [EVALUATION.md](EVALUATION.md) — Kebijakan kalibrasi verdict, matriks pengujian otomatis, dan batasan MVP.
- [DEPLOYMENT.md](DEPLOYMENT.md) — Panduan deploy ke Vercel dan verifikasi pasca-deploy.
