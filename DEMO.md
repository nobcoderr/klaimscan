# DEMO GUIDE — KLAIMSCAN AI (Offline Fixtures & Live Verification)

Panduan ini dirancang untuk demonstrasi di panggung **Kartika Cyber Hackathon 2026** baik dalam skenario **koneksi internet aktif (Live AI)** maupun **tanpa koneksi / presentasi offline (DEMO MODE)**.

---

## 1. Enam Permukaan SOC Dashboard

Pada panel navigasi kiri (maupun bar cepat di bagian atas), tersedia akses langsung ke 6 permukaan inti MVP + arsip kasus & sumber bukti:

1. **Dashboard** — Ringkasan KPI telemetri (`CASES ANALYZED`, `FLAGGED CLAIMS`, `SOURCES FOUND`), dropzone unggahan screenshot, serta ringkasan hasil investigasi aktif.
2. **New Analysis** — Area unggah screenshot PNG/JPG/WebP (maks. 4 MB), tombol **Muat Sample Uji**, kolom opsional *Konteks Analis*, animasi pemindaian, dan status pipeline real-time tahap 01–06.
3. **Analysis Result** — Pemisahan **Claim Assessment (Verdict Faktual)** vs **Evidence Trail**, peringatan pemisahan peran untuk postingan *Debunking*, serta daftar terpisah **Supporting Evidence** vs **Contradicting Evidence**.
4. **Evidence Timeline** — Audit kronologis dari pengamatan postingan pada screenshot, tanggal klarifikasi resmi/fact-check terindeks, hingga waktu pemeriksaan sistem.
5. **Public Source Trace** — Handle publik yang terlihat, URL publik terlihat, rujukan klarifikasi, jaminan privasi (tanpa pelacakan IP pribadi), dan peringatan non-atribusi penulis asli.
6. **Case Report** — Tampilan siap cetak **Print / Save PDF** berisi SHA-256 screenshot, metadata yang dibersihkan, seluruh URL terverifikasi, catatan analis, dan batasan metodologi.

---

## 2. Skenario Demo Offline (Fixture Terlabeli Jelas)

Gunakan panel **Demo Mode Fixtures (`D-1` s.d. `D-6`)** di sidebar kiri untuk menunjukkan 6 skenario wajib tanpa mencampuradukkan data demo dengan bukti live:

| Tombol | Case ID | Skenario | Verdict Klaim | Post Stance | Poin Presentasi |
| --- | --- | --- | --- | --- | --- |
| `D-1` | `KS-DEMO-001` | Akun `@vereditum` membantah hoaks SIM seumur hidup | `FALSE` | `debunking_claim` | Menunjukkan AI tidak salah menuduh akun klarifikasi sebagai penyebar hoaks |
| `D-2` | `KS-DEMO-002` | Pesan berantai WhatsApp link pendaftaran bansos Rp900rb | `FALSE` | `asserting_claim` | Menunjukkan penolakan tautan phishing terhadap kanal resmi `.go.id` (Kemensos & BSSN) |
| `D-3` | `KS-DEMO-003` | Klip video TikTok air laut surut diklaim kejadian hari ini | `OUTDATED` | `asserting_claim` | Menunjukkan deteksi daur ulang konten lama (`BMKG` & `ANTARA`) |
| `D-4` | `KS-DEMO-004` | Info biaya transfer BI-FAST maksimal Rp2.500 | `TRUE` | `neutral_discussion` | Menunjukkan konfirmasi klaim benar oleh rujukan resmi Bank Indonesia |
| `D-5` | `KS-DEMO-005` | Rumor penambahan 5 hari cuti bersama minggu depan | `UNVERIFIED` | `neutral_discussion` | Menunjukkan prinsip anti-halusinasi: default `UNVERIFIED` saat bukti resmi nihil |
| `D-6` | `KS-DEMO-006` | Kutipan sebagian headline subsidi energi gratis tanpa syarat | `MISLEADING` | `quoting_claim` | Menunjukkan pemotongan konteks kebijakan (`partial_context` Kementerian ESDM) |

---

## 3. Skenario Demo Unggah & Analisis Live (Ketika API Key Aktif)

1. Pastikan `.env.local` memiliki `OPENAI_API_KEY` aktif (lencana header kanan atas akan berbunyi **`SYSTEM ONLINE • LIVE AI READY`**).
2. Klik **`Muat Sample Uji`** (membuat PNG uji `@vereditum` secara dinamis di browser) atau seret file screenshot sosial media (JPG/PNG/WebP `<= 4 MB`) ke dropzone.
3. (Opsional) Isi catatan konteks analis, misalnya *"Diterima dari grup WhatsApp publik, periksa apakah ada klarifikasi resmi"* lalu klik **`JALANKAN ANALISIS AI`**.
4. Amati progres streaming 6 tahap (`01 Image Sanitization` s.d. `06 Case Report Generator`) yang ditandai sebagai **`LIVE EVIDENCE`** (bukan `DEMO FIXTURE`).
5. Buka tab **Case Report (Print/PDF)** dan klik **`Cetak / Simpan PDF`** untuk melihat dokumen laporan audit yang bersih tanpa elemen navigasi gelap.
