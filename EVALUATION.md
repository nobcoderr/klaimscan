# EVALUATION — Metodologi Kalibrasi Verdict, Pengujian & Rencana Uji Live

Dokumen ini memaparkan bagaimana **KLAIMSCAN AI** mengevaluasi klaim secara berbasis bukti (*evidence-grounded*), pengamanan anti-halusinasi dan anti-spoofing pasca-audit P0/P1, cakupan pengujian otomatis, rencana uji API live manual, serta batasan sistem MVP.

---

## 1. Kebijakan Kalibrasi Verdict & Kepercayaan Sumber

Engine keputusan di [src/lib/pipeline/verdict-engine.ts](src/lib/pipeline/verdict-engine.ts) bekerja bersama klasifikasi sumber ketat di [src/lib/pipeline/evidence-retriever.ts](src/lib/pipeline/evidence-retriever.ts) dan penyelarasan proposisi di [src/lib/pipeline/evidence-comparator.ts](src/lib/pipeline/evidence-comparator.ts).

### Hierarki Bobot Bukti & Klasifikasi Hostname Ketat
- **`official_government`** (`3.0`): hanya hostname eksak otoritas internasional resmi (`who.int`, `un.org`, dst.) atau akhiran label-boundary sah (`.go.id`, `.mil.id`, `.gov`, `.gov.uk`, `.gov.au`, `.gov.sg`, `.gc.ca`), menolak `xn--` punycode maupun substring spoof seperti `kominfo.go.id.attacker.com`.
- **`fact_checker`** (`2.5`): domain terkurasi dalam `TRUSTED_FACT_CHECK_DOMAINS` (`turnbackhoax.id`, `cekfakta.com`, `cekfakta.tempo.co`, `snopes.com`, `factcheck.afp.com`, dll.) atau kanal `/cek-fakta` pada domain dalam `CURATED_CREDIBLE_MEDIA_DOMAINS`. Domain sembarang dengan path `/hoaks` tidak pernah dipercaya sebagai pemeriksa fakta.
- **`credible_media`** (`1.5`): hostname yang cocok secara ketat dengan daftar media terkurasi (subdomain UGC seperti `forum.`/`blog.` diturunkan ke `public_source`).
- **`public_source`** (`1.0`): sumber terbuka umum; tidak pernah cukup sendirian untuk menghasilkan verdict `TRUE`, `FALSE`, `MISLEADING`, atau `OUTDATED`.

### Aturan Pengambilan Keputusan Per Penerbit Independen
Setiap kategori (`supporting`, `contradicting`, `partial_context`) dideduplikasi terlebih dahulu berdasarkan **root penerbit independen** (`korlantas.polri.go.id` dan `humas.polri.go.id` → `polri.go.id`; `nasional.kompas.com` dan `kompas.com` → `kompas.com`):
1. **`UNVERIFIED` (Default Aman)**: dipilih apabila `containsCheckableClaim === false`, tidak ada sumber relevan (`irrelevant` tidak pernah dihitung), bukti hanya dari `public_source`, hanya berasal dari satu penerbit `credible_media` tanpa otoritas resmi/`fact_checker`, atau kondisi bukti masih ambigu.
2. **`OUTDATED`**: dipilih ketika indikator konteks waktu lama (`mentionsOutdatedContext`) muncul pada sumber non-publik relevan tanpa bukti pendukung terkini.
3. **`FALSE`**: dipilih apabila bobot pembantah independen dominan (`contradictScore >= supportScore * 1.5` DAN `contradictScore >= partialScore`) serta didukung minimal satu penerbit `official_government`/`fact_checker` atau minimal 2 penerbit `credible_media` independen.
4. **`MISLEADING`**: dipilih ketika bukti `partial_context` non-publik mendominasi atau ketika bukti kredibel pendukung dan pembantah saling bertentangan.
5. **`TRUE`**: dipilih apabila didukung penerbit `official_government`/`fact_checker` atau minimal 2 penerbit `credible_media` independen tanpa bantahan terverifikasi.

---

## 2. Cakupan Pengujian Otomatis

| Area Uji | Berkas Uji | Cakupan Verifikasi |
| --- | --- | --- |
| Validasi & Sanitasi Gambar | [tests/unit/sanitize.test.ts](tests/unit/sanitize.test.ts) | Penolakan file palsu (non-image), batas konsisten **4 MB**, portrait/landscape besar aman `<4,5 MB`, penggaris OCR *server-side* terkunci SHA-256, penghapusan PNG/JPEG/WebP EXIF & tEXt |
| Skema OCR & Normalisasi Klaim Text-First | [tests/unit/claim-extractor.test.ts](tests/unit/claim-extractor.test.ts) | Stage A OCR (headline, overlay gambar, caption, bbox), Stage B text-only (nol `input_image`), handle UI kosong, 5 nilai `postStance`, blokir SSRF `visiblePostUrl` |
| Anti-SSRF & URL Guard | [tests/unit/url-guard.test.ts](tests/unit/url-guard.test.ts) | Pemblokiran `localhost`, IPv4/IPv6 privat/link-local, userinfo `@`, `javascript:`/`file:`, strip parameter `utm_*` |
| Klasifikasi Sumber Ketat (P0) | [tests/unit/evidence-retriever.test.ts](tests/unit/evidence-retriever.test.ts) | Penolakan spoof `kominfo.go.id.attacker.com`, `fake-go.id`, path `/hoaks` pada domain sembarang, UGC `forum.detik.com`, prioritas excerpt nyata vs query placeholder |
| Proposisi & Waktu Fakta (P0) | [tests/unit/evidence-comparator.test.ts](tests/unit/evidence-comparator.test.ts) | Rating negasi (`Tidak Benar`, `Not True`, `Unverified`), eksklusi klarifikasi foto sampul (`image_authenticity` → `irrelevant`), penolakan konteks waktu salah, guard fallback `doesCandidateMatchProposition` |
| Koroborasi Penerbit & Verdict (P0) | [tests/unit/verdict-engine.test.ts](tests/unit/verdict-engine.test.ts) | Deduplikasi multi-URL 1 penerbit, pengecualian sumber `irrelevant`, penolakan `public_source`-only, dominasi `partial_context` mencegah `FALSE` keliru, aturan `@vereditum` |
| Regresi Text-First (Tests A–G) | [tests/unit/regression-cases.test.ts](tests/unit/regression-cases.test.ts) | Uji A (foto sampul berbeda, headline identik), B (headline di atas gambar), C (pemisahan headline & caption), D (*resmi ajukan* vs *niat*), E (eksklusi debunk lama & Komdigi `hoaks-foto` tanpa `VIRAL PHOTO FALSE`), F (tanpa teks → `UNVERIFIED`), G (`@vereditum` debunking) |
| Orkestrasi & Deadline Menyeluruh (P1) | [tests/unit/orchestrator.test.ts](tests/unit/orchestrator.test.ts) | `PipelineTimeoutError` ketika Vision melampaui budget, serta degradasi aman Step 4 ke fallback saat sisa waktu `< 3s` |
| Rate Limit, Proxy Trust & Kredit API (P0) | [tests/unit/rate-limit.test.ts](tests/unit/rate-limit.test.ts) | Penolakan header `x-forwarded-for` pada mode `none`, mode `vercel`/`cloudflare`/`forwarded-rightmost`, integrasi Upstash Redis REST + fallback, kuota AI global per jam, semaphore konkurensi, token opsional |
| API Route Security & Error Generik (P0/P1) | [tests/unit/api-routes.test.ts](tests/unit/api-routes.test.ts) | Error `500`/`504` generik dengan `errorId` tanpa membocorkan exception mentah, tahan spoofing `x-forwarded-for`, kuota global `429`, redaksi rahasia pada log server |
| Case Report & End-to-End UI | [tests/unit/report-generator.test.ts](tests/unit/report-generator.test.ts), [tests/e2e/dashboard.spec.ts](tests/e2e/dashboard.spec.ts) | Dashboard SOC, `@vereditum`, switcher Demo `D-1`..`D-6`, penolakan unggahan **> 4 MB**, pengiriman tunggal tanpa duplikat `ocrGuide`, navigasi penuh, Case Report PDF, `/api/health` |

---

## 3. Rencana Uji Integrasi API Live Manual (7 Skenario Wajib)

Setelah menyalakan server lokal atau produksi dengan `OPENAI_API_KEY` dan `FACTCHECK_API_KEY` aktif (`/api/health` menampilkan `"openAiConfigured": true`), uji 7 skenario berikut secara manual:

| # | Skenario | Contoh Input Screenshot Uji | Hasil & Perilaku yang Diharapkan |
| --- | --- | --- | --- |
| 1 | Hoaks terkonfirmasi dengan klarifikasi resmi | Unggahan klaim bantuan tunai mengatasnamakan kementerian / SIM seumur hidup dengan tautan tidak resmi | `claimVerdict = FALSE`, `postStance = asserting_claim`, terdapat rujukan `.go.id` / `turnbackhoax.id` pada *Contradicting Evidence* |
| 2 | Postingan membantah hoaks (*Debunking*) | Sample `@vereditum` (`Muat Sample Uji`) atau screenshot akun cek-fakta yang meluruskan hoaks | `claimVerdict = FALSE`, **tetapi** `postStance = debunking_claim` + alert pemisahan peran aktif agar akun klarifikasi tidak dituduh penyebar hoaks |
| 3 | Pengumuman resmi yang benar | Info resmi tarif maksimal BI-FAST Rp 2.500 per transaksi atau pengumuman resmi `.go.id` terindeks | `claimVerdict = TRUE` dengan dukungan sumber `official_government` / multi-media kredibel |
| 4 | Klaim kedaluwarsa (*Outdated*) | Cuplikan bencana/kebijakan lama yang dikemas ulang seolah pengumuman/kejadian hari ini | `claimVerdict = OUTDATED` dengan penandaan konteks waktu (`matchesTimeContext` / `mentionsOutdatedContext`) |
| 5 | Klaim tanpa bukti memadai | Rumor lokal spesifik yang belum pernah dirilis pemerintah maupun diliput media/fact-checker | `claimVerdict = UNVERIFIED`, nol sitasi rekayasa, pesan transparan kurangnya rujukan otoritatif |
| 6 | Hasil fact-check kurang relevan / fokus aspek berbeda | Artikel berita aktual yang disertai klarifikasi foto editan (mis. foto ilustrasi palsu pada berita nyata) | Klarifikasi foto saja tidak memaksa `FALSE` atas proposisi utama bila berita faktual utamanya terverifikasi; tidak ada artikel berbeda topik yang dioverride |
| 7 | URL sumber tiruan / manipulatif dalam teks | Screenshot berisi tautan palsu `kominfo.go.id.attacker.com` atau blog `/hoaks` | URL tiruan pada screenshot tetap diklasifikasikan `public_source` / diabaikan otoritasnya; tautan berbahaya `javascript:` / IP privat dibuang oleh URL guard |

---

## 4. Batasan MVP yang Diketahui (Known Limitations)

1. **Konteks Gambar Terpotong**: screenshot minim teks atau tanpa konteks pelaku/tanggal mendorong verdict ke `UNVERIFIED`.
2. **Ketercakupan Indeks Web Terbuka**: dokumen internal atau berita amat baru yang belum terindeks search engine / Google Fact Check API tidak dapat ditemukan saat pemeriksaan berjalan.
3. **Sinkronisasi Multi-Instance Tanpa Redis**: tanpa `UPSTASH_REDIS_REST_URL` & `UPSTASH_REDIS_REST_TOKEN`, pembatasan laju berjalan per instance serverless (sedangkan aktivasi Upstash menyinkronkannya secara global).
4. **Cakupan OSINT Terbatas**: tidak melakukan pengenalan wajah, forensik lokasi GPS EXIF (dihapus demi privasi), ataupun pelacakan identitas hukum pengunggah.
