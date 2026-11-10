# KLAIMSCAN AI — Evidence-Based Disinformation Intelligence Platform

**Kategori:** Siber Sosial — Kartika Cyber Hackathon 2026  
**Arsitektur:** Next.js App Router + TypeScript + Tailwind CSS v4 + shadcn/ui + OpenAI Vision & `web_search` + Google Fact Check Tools API

## Fitur MVP (6/6)

1. **Upload Screenshot** — Dukungan JPG, PNG, WebP (maks. 10 MB) dengan drag-and-drop, preview instan, validasi magic-bytes, dan pembersihan metadata EXIF/XMP in-memory tanpa menyimpan gambar secara permanen.
2. **AI Claim Extraction** — Ekstraksi teks, klaim utama, akun/URL publik yang terlihat, dan **pemisahan wajib antara klasifikasi klaim dengan sikap postingan** (sehingga akun pemeriksa fakta yang membantah hoaks tidak dilabeli sebagai penyebar hoaks).
3. **Live Evidence Search** — Penelusuran paralel melalui OpenAI Responses API (`web_search`) dan Google Fact Check Tools API dengan filter URL tervalidasi.
4. **Evidence-Based Verdict** — Klasifikasi deterministik berbasis bukti nyata: `Hoaks`, `Terverifikasi`, `Menyesatkan`, `Kedaluwarsa`, atau `Belum Terverifikasi`.
5. **Public Origin Trace** — Pelacakan informasi publik yang terlihat (platform, handle, URL publik, kronologi verifikasi) tanpa pelacakan IP pribadi atau data privat.
6. **Laporan Investigasi** — Ringkasan forensik, daftar sumber ber-URL valid, hash SHA-256 gambar, timestamp WIB, dan ekspor laporan via Print/PDF.

## Konfigurasi Lingkungan (`.env.local`)

Salin `.env.example` menjadi `.env.local` (jangan pernah commit ke Git):

```env
OPENAI_API_KEY=isi_api_key_openai_kamu
OPENAI_VISION_MODEL=gpt-4.1-mini
OPENAI_SEARCH_MODEL=gpt-4.1-mini
FACTCHECK_API_KEY=isi_api_key_google_factcheck_kamu
```

## Perintah Pengembangan & Pengujian

```powershell
pnpm.cmd dev          # Jalankan server lokal di http://localhost:3000
pnpm.cmd typecheck    # Pemeriksaan tipe TypeScript
pnpm.cmd lint         # Pemeriksaan ESLint
pnpm.cmd test         # Jalankan unit test Vitest
pnpm.cmd test:e2e     # Jalankan E2E test Playwright
pnpm.cmd build        # Build produksi Next.js
```
