# EVALUATION — Metodologi Kalibrasi Verdict, Pengujian & Batasan MVP

Dokumen ini memaparkan bagaimana **KLAIMSCAN AI** mengevaluasi klaim secara berbasis bukti (*evidence-grounded*), alasan desain pengamanan anti-halusinasi, cakupan pengujian otomatis, serta keterbatasan sistem pada fase MVP.

---

## 1. Kebijakan Kalibrasi Verdict (Verdict Calibration Policy)

Engine keputusan di [src/lib/pipeline/verdict-engine.ts](src/lib/pipeline/verdict-engine.ts) memisahkan secara ketat antara **Kebenaran Klaim Faktual** dengan **Sikap Penulis Postingan (`postStance`)**.

### Hierarki Bobot Bukti
- **`official_government`** (`3.0`): domain resmi instansi (`.go.id`, `.gov`, `.mil.id`, `.ac.id`, `who.int`, `un.org`).
- **`fact_checker`** (`2.5`): organisasi pemeriksa fakta (contoh `turnbackhoax.id`, `cekfakta.com`, `cekfakta.tempo.co`, `reuters.com`, `afp.com`, atau URL kanal `/cek-fakta` & `/cekfakta`).
- **`credible_media`** (`1.5`): redaksi berita arus utama yang dapat diaudit.
- **`public_source`** (`1.0`): sumber terbuka umum; **satu sumber publik tanpa koroborasi resmi/media kredibel dilarang menghasilkan `TRUE` atau `FALSE`**.

### Aturan Pengambilan Keputusan
1. **`UNVERIFIED` (Default Aman)**: dipilih apabila `containsCheckableClaim === false`, `relevantSources === 0`, atau bukti hanya berasal dari sumber tunggal non-otoritatif.
2. **`OUTDATED`**: dipilih ketika indikator konteks waktu lama (`mentionsOutdatedContext`) terdeteksi dari bukti tanpa bukti dukungan terkini.
3. **`FALSE`**: dipilih apabila bobot bukti pembantah (`contradicting`) dominan (`>= 1.5x supporting`) serta didukung minimal satu sumber `official_government`/`fact_checker` atau minimal 2 sumber independen.
4. **`MISLEADING`**: dipilih ketika bukti berstatus `partial_context` mendominasi atau ketika bukti kredibel yang mendukung dan membantah sama-sama muncul (*conflicting sources*).
5. **`TRUE`**: dipilih apabila terdapat bukti pendukung resmi, pemeriksa fakta, atau media kredibel tanpa bantahan terindeks.

### Mengapa Tidak Menampilkan Persentase Confidence LLM?
Model bahasa tidak memiliki kalibrasi probabilitas statistik yang sejajar dengan kebenaran faktual dunia nyata; angka seperti *"94% Hoaks"* memberi ilusi kepastian ilmiah palsu. Oleh sebab itu, KLAIMSCAN AI **secara sengaja melarang output skor persentase kepercayaan numerik** dan menggantinya dengan metrik bukti faktual transparan (`supportingCount`, `contradictingCount`, `officialOrFactCheckCount`, serta tautan sumber langsung).

---

## 2. Cakupan Pengujian Otomatis

| Area Uji | Berkas Uji | Cakupan Verifikasi |
| --- | --- | --- |
| Validasi & Sanitasi Gambar | [tests/unit/sanitize.test.ts](tests/unit/sanitize.test.ts) | Penolakan file palsu (non-image), batas ukuran **> 5 MB**, penghapusan PNG `tEXt`/`eXIf`, JPEG `APP1 EXIF`, WebP `EXIF` + flag `VP8X` |
| Skema Ekstraksi & Prompt Injection | [tests/unit/claim-extractor.test.ts](tests/unit/claim-extractor.test.ts) | Semua 5 nilai `postStance`, penolakan payload cacat via Zod, pembersihan tag injeksi & karakter kontrol, blokir SSRF pada `visiblePostUrl` |
| Anti-SSRF & URL Guard | [tests/unit/url-guard.test.ts](tests/unit/url-guard.test.ts) | Pemblokiran `127.0.0.1`, `169.254.169.254`, `localhost`, IP privat, userinfo tersisip, skema `javascript:`/`file:`, dan strip parameter `utm_*` |
| Retrieval & Fact Check Fallback | [tests/unit/evidence-retriever.test.ts](tests/unit/evidence-retriever.test.ts) | Klasifikasi tier domain, deduplikasi URL, dan graceful warning saat Google Fact Check API HTTP 503 |
| Pembanding Bukti & Anti-Halusinasi | [tests/unit/evidence-comparator.test.ts](tests/unit/evidence-comparator.test.ts) | Pemetaan rating fact-check dan penolakan ID sumber fiktif yang tidak ada pada kandidat asli |
| Logika Verdict | [tests/unit/verdict-engine.test.ts](tests/unit/verdict-engine.test.ts) | `UNVERIFIED` tanpa sumber / 1 `public_source`, aturan `@vereditum` (`FALSE` + `debunking_claim`), `TRUE`, `OUTDATED`, `MISLEADING`, nol skor confidence |
| Pembuatan Case Report & Trace | [tests/unit/report-generator.test.ts](tests/unit/report-generator.test.ts) | Pemisahan array `supportingEvidence`/`contradictingEvidence`, hash SHA-256 64-char, `persistedOnServer: false`, jaminan privasi & batasan |
| Rate Limiter | [tests/unit/rate-limit.test.ts](tests/unit/rate-limit.test.ts) | Batas sliding window per-IP, respons `retryAfterSeconds`, reset setelah jendela waktu, ekstraksi `x-forwarded-for` |
| API Route Integration | [tests/unit/api-routes.test.ts](tests/unit/api-routes.test.ts) | `/api/health` aman tanpa secret, `400` input invalid/>5MB, `429` rate limit, `503` missing API key tanpa mock, `500` error pipeline dgn redaksi secret, `200` pipeline mock |
| End-to-End UI Journey | [tests/e2e/dashboard.spec.ts](tests/e2e/dashboard.spec.ts) | Dashboard SOC, pemisahan `@vereditum`, switcher Demo `D-1`..`D-6`, preview Sample Uji, validasi file >5MB, 6 navigasi sidebar, Case Report Print/PDF & `/api/health` |

---

## 3. Batasan MVP yang Diketahui (Known Limitations)

1. **Konteks Gambar Terpotong**: jika screenshot tidak menampilkan tanggal, sumber, atau teks lengkap yang terbaca jelas, ekstraksi klaim memiliki konteks terbatas dan sistem cenderung menjaga status tetap `UNVERIFIED`.
2. **Ketergantungan Indeks Web Terbuka**: dokumen internal lembaga atau pengumuman terbaru yang belum terindeks mesin pencari / Fact Check API pada detik verifikasi tidak akan muncul dalam hasil pencarian.
3. **Rate Limit In-Memory**: implementasi rate limiter MVP memakai penyimpanan memori per instance Node.js (efektif untuk proses tunggal / hackathon; untuk skala produksi multi-region perlu disambungkan ke Upstash Redis / Vercel KV).
4. **Cakupan OSINT Terbatas**: tidak melakukan pengenalan wajah, forensik lokasi GPS EXIF (sengaja dihapus demi privasi), ataupun pelacakan identitas hukum pengunggah.
