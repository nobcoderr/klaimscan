# DEPLOYMENT — Panduan Deploy ke Vercel (MVP Hackathon)

**KLAIMSCAN AI** dirancang sebagai aplikasi **Next.js 16 App Router** yang kompatibel penuh dengan **Vercel Serverless Functions** tanpa ketergantungan pada server Python eksternal, database persisten, atau penyimpanan objek untuk gambar pengguna.

---

## 1. Spesifikasi Runtime Produksi

- **Framework Preset**: Next.js
- **Node.js Version**: `20.x` atau `22.x`
- **API Route Runtime**: `export const runtime = "nodejs"` dan `export const maxDuration = 60` pada [src/app/api/analyze/route.ts](src/app/api/analyze/route.ts), dikawal oleh batas eksekusi menyeluruh `ANALYZE_PIPELINE_DEADLINE_MS` (`48000` ms) agar pipeline selesai atau mengalami degradasi aman sebelum batas platform `60s`.
- **Upload Limit Konsisten**: Batas unggahan adalah **5 MB** per screenshot (`MAX_IMAGE_BYTES = 5 * 1024 * 1024`) di antarmuka browser maupun validasi server.
- **Image Optimization**: `images: { unoptimized: true }` di [next.config.ts](next.config.ts) agar preview client blob URL bekerja konsisten tanpa pemrosesan eksternal tambahan.
- **Keamanan Respons**: `next.config.ts` otomatis menambahkan `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, dan `Permissions-Policy`.

---

## 2. Variabel Lingkungan di Vercel Dashboard

Masuk ke **Project Settings → Environment Variables** di Vercel, lalu tambahkan variabel berikut untuk lingkungan *Production* (dan *Preview* bila perlu):

| Name | Required | Default / Example Value (Jangan Pakai Secret di Repo) |
| --- | --- | --- |
| `OPENAI_API_KEY` | Ya (untuk analisis live) | Masukkan kunci OpenAI API Anda melalui UI Vercel |
| `OPENAI_VISION_MODEL` | Opsional | `gpt-5.4-mini` |
| `OPENAI_SEARCH_MODEL` | Opsional | `gpt-5.4-mini` |
| `FACTCHECK_API_KEY` | Opsional | Kunci Google Cloud Fact Check Tools API Anda |
| `ANALYZE_PUBLIC_ACCESS_ENABLED` | Opsional | `true` (`false` menonaktifkan `/api/analyze` sementara DEMO MODE tetap aktif) |
| `ANALYZE_ACCESS_TOKEN` | Opsional (disarankan pasca-demo) | Token rahasia opsional (`x-klaimscan-access-token` / Bearer) untuk membatasi akses publik |
| `ANALYZE_RATE_LIMIT_MAX` | Opsional | `12` permintaan per jendela waktu per bucket klien |
| `ANALYZE_RATE_LIMIT_WINDOW_MS` | Opsional | `60000` (1 menit) |
| `ANALYZE_GLOBAL_HOURLY_LIMIT` | Opsional | `60` eksekusi AI berbayar per jam (perlindungan biaya API) |
| `ANALYZE_MAX_CONCURRENT` | Opsional | `4` eksekusi pipeline paralel per instance |
| `ANALYZE_PIPELINE_DEADLINE_MS` | Opsional | `48000` ms batas menyeluruh di bawah `maxDuration = 60` |
| `TRUSTED_PROXY_MODE` | Opsional | `none` (otomatis `vercel` bila `VERCEL=1` untuk membaca `x-vercel-forwarded-for` saja) |
| `UPSTASH_REDIS_REST_URL` | Opsional (disarankan produksi) | URL REST Upstash Redis untuk rate limit terdistribusi multi-instance |
| `UPSTASH_REDIS_REST_TOKEN` | Opsional (disarankan produksi) | Token REST Upstash Redis |

> **Peringatan Keamanan**: Jangan menaruh API key berawalan `NEXT_PUBLIC_`. Seluruh pemanggilan API eksternal hanya terjadi di sisi server (`src/lib/env.ts` & `src/app/api/**`), dan header `x-forwarded-for` mentah tidak pernah dipercayai secara langsung oleh rate limiter.

---

## 3. Perlindungan Biaya & Abuse di Deployment Publik

1. **Multi-Instance Rate Limiting**: Hubungkan `UPSTASH_REDIS_REST_URL` dan `UPSTASH_REDIS_REST_TOKEN` agar penghitung laju per-klien maupun kuota global per jam sinkron di seluruh instance serverless Vercel. Bila variabel Upstash belum diisi, sistem otomatis fallback aman ke *in-memory limiter* per instance.
2. **Validasi Header Proxy Terkontrol**: Di Vercel, rate limiter hanya membaca `x-vercel-forwarded-for` yang divalidasi dengan `net.isIP`, sehingga rotasi header `x-forwarded-for` oleh bot tidak dapat melewati batas kuota.
3. **Batas Biaya Global & Konkurensi**: `ANALYZE_GLOBAL_HOURLY_LIMIT` hanya dihitung untuk unggahan valid yang benar-benar memanggil OpenAI API, didampingi semaphore `ANALYZE_MAX_CONCURRENT` dan opsi matikan cepat (`ANALYZE_PUBLIC_ACCESS_ENABLED=false`).
4. **Error Generik Aman**: Respons HTTP `4xx`/`5xx` dan stream NDJSON mengembalikan pesan generik beserta `errorId` (mis. `ERR-1A2B3C4D`), sementara diagnostik yang telah disanitasi dicatat hanya di log server terstruktur.

---

## 4. Langkah Deploy

1. Verifikasi build lokal sebelum deploy:
   ```bash
   pnpm typecheck
   pnpm lint
   pnpm test
   pnpm build
   ```
2. Pastikan `.env.local` dan `env.local` **tidak masuk ke Git** (sudah diabaikan pada `.gitignore`, sementara `.env.example` tetap di-track tanpa nilai rahasia).
3. Deploy ke Vercel melalui dashboard **Add New → Project** atau `vercel --prod`.

---

## 5. Verifikasi Pasca-Deploy

Setelah URL produksi aktif:

1. **Cek Endpoint Kesehatan**:
   Buka `https://<domain-anda>.vercel.app/api/health` dan pastikan JSON mengembalikan:
   - `"status": "online"`
   - `"openAiConfigured": true`
   - `"publicAnalyzeEnabled": true`
   - `"distributedRateLimitConfigured"` sesuai konfigurasi Upstash Anda
   - Pastikan **tidak ada** potongan key di respons JSON.
2. **Uji Antarmuka Offline/Fixture & Upload Preview**:
   - Pastikan lencana kanan atas menampilkan **`SYSTEM ONLINE • LIVE AI READY`**.
   - Klik `Muat Sample Uji` dan jalankan **`JALANKAN ANALISIS AI`**, lalu verifikasi laporan menampilkan badge `LIVE EVIDENCE`, URL resmi clickable, SHA-256 screenshot, serta opsi cetak **Print / Save PDF**.
3. **Cek Log Vercel**: Pastikan waktu eksekusi tetap di bawah `ANALYZE_PIPELINE_DEADLINE_MS` (`48s`) dan error terstruktur dapat dilacak dengan `errorId`.
