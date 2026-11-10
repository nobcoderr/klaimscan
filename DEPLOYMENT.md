# DEPLOYMENT — Panduan Deploy ke Vercel (MVP Hackathon)

**KLAIMSCAN AI** dirancang sebagai aplikasi **Next.js 16 App Router** yang kompatibel penuh dengan **Vercel Serverless Functions** tanpa ketergantungan pada server Python eksternal, database persisten, atau penyimpanan objek untuk gambar pengguna.

---

## 1. Spesifikasi Runtime Produksi

- **Framework Preset**: Next.js
- **Node.js Version**: `20.x` atau `22.x`
- **API Route Runtime**: `export const runtime = "nodejs"` dan `export const maxDuration = 60` pada [src/app/api/analyze/route.ts](src/app/api/analyze/route.ts) untuk mengakomodasi panggilan paralel Vision + Web Search + Comparison.
- **Image Optimization**: `images: { unoptimized: true }` di [next.config.ts](next.config.ts) agar preview client blob URL bekerja konsisten tanpa pemrosesan eksternal tambahan.
- **Keamanan Respons**: `next.config.ts` otomatis menambahkan `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, dan `Permissions-Policy`.

---

## 2. Variabel Lingkungan di Vercel Dashboard

Masuk ke **Project Settings → Environment Variables** di Vercel, lalu tambahkan variabel berikut untuk lingkungan *Production* (dan *Preview* bila perlu):

| Name | Required | Example Value (Jangan Pakai Secret di Repo) |
| --- | --- | --- |
| `OPENAI_API_KEY` | Ya (untuk analisis live) | Masukkan kunci OpenAI API Anda melalui UI Vercel |
| `OPENAI_VISION_MODEL` | Opsional | `gpt-4.1-mini` |
| `OPENAI_SEARCH_MODEL` | Opsional | `gpt-4.1-mini` |
| `FACTCHECK_API_KEY` | Opsional | Kunci Google Cloud Fact Check Tools API Anda |

> **Peringatan Keamanan**: Jangan menaruh API key berawalan `NEXT_PUBLIC_`. Seluruh pemanggilan API eksternal hanya terjadi di sisi server (`src/lib/env.ts` & `src/app/api/**`).

---

## 3. Langkah Deploy

### Via Vercel CLI / Git Integration

1. Hubungkan repositori Git proyek ini ke Vercel atau jalankan dari direktori proyek:
   ```bash
   pnpm build
   ```
2. Pastikan `.env.local` dan `env.local` **tidak masuk ke Git** (sudah diabaikan pada `.gitignore`, sementara `.env.example` tetap di-track tanpa nilai rahasia).
3. Deploy ke Vercel melalui dashboard **Add New → Project** atau `vercel --prod`.

---

## 4. Verifikasi Pasca-Deploy

Setelah URL produksi aktif:

1. **Cek Endpoint Kesehatan**:
   Buka `https://<domain-anda>.vercel.app/api/health` dan pastikan JSON mengembalikan:
   - `"status": "online"`
   - `"openAiConfigured": true` (bila `OPENAI_API_KEY` telah diset)
   - Pastikan **tidak ada** potongan key di respons JSON.
2. **Uji Antarmuka Offline/Fixture & Upload Preview**:
   - Pastikan lencana kanan atas menampilkan **`SYSTEM ONLINE • LIVE AI READY`**.
   - Klik `Muat Sample Uji` dan jalankan **`JALANKAN ANALISIS AI`**, lalu verifikasi laporan menampilkan badge `LIVE EVIDENCE`, URL resmi clickable, SHA-256 screenshot, serta opsi cetak **Print / Save PDF**.
3. **Cek Log Vercel (`maxDuration`)**:
   - Pada paket Vercel Hobby, batas maksimum durasi fungsi serverless umumnya dibatasi sesuai tier akun. Pipeline KLAIMSCAN AI menerapkan timeout per tahap (25s Vision, 25s Web Search paralel dengan 8s Fact Check API, 20s Comparison) untuk meminimalkan risiko HTTP timeout.
