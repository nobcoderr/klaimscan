import { createInitialPipelineSteps } from "@/lib/pipeline/steps";
import type { InvestigationReport } from "@/lib/types";

export const DEMO_DATASET_BASELINE = {
  casesAnalyzed: 24,
  flaggedClaims: 9,
  sourcesFound: 61,
};

export const STANDARD_REPORT_LIMITATIONS = [
  "Verifikasi dilakukan terhadap klaim tekstual. Keaslian foto sampul tidak diperiksa.",
  "KLAIMSCAN AI tidak dapat dan tidak pernah mengklaim menemukan IP pribadi, alamat rumah, lokasi GPS presisi, atau identitas hukum pengunggah media sosial dari screenshot.",
  "Postingan publik paling awal yang teramati tidak serta-merta merupakan penulis asli atau pembuat pertama klaim.",
  "Verdict hanya mencerminkan sumber terbuka dan basis data fact-check yang berhasil terindeks pada saat pemeriksaan, tanpa skor probabilitas kepercayaan LLM buatan.",
  "Screenshot pengguna diproses in-memory setelah metadata EXIF/XMP dihapus dan tidak disimpan permanen di server.",
];

function completedDemoSteps(details: string[]) {
  return createInitialPipelineSteps().map((step, idx) => ({
    ...step,
    status: "completed" as const,
    durationMs: 180 + idx * 140,
    detail: details[idx] || "Selesai (DEMO MODE fixture)",
  }));
}

const BASE_DEMO_FIXTURE_CASES: InvestigationReport[] = [
  {
    caseId: "KS-DEMO-001",
    title: "Kapolri bakal berlakukan SIM seumur hidup",
    isDemo: true,
    demoCategoryLabel: "Debunking Post (Verdict FALSE / Stance Debunking)",
    checkedAt: "2026-11-10T09:15:00.000Z",
    analystNotes:
      "Fixture DEMO MODE: membedakan klaim FALSE dari akun pemeriksa fakta yang sedang membantah hoaks.",
    imageMetadata: {
      fileName: "vereditum-sim.jpg",
      mimeType: "image/jpeg",
      originalBytes: 104807,
      sanitizedBytes: 246100,
      metadataRemovedBytes: 2220,
      strippedSegments: ["PNG tEXt", "PNG iTXt"],
      sha256:
        "9b41e7f4c2b8a9d1e30519d8f34b72e1180c5c7f4d2038910a7d4a5e1f2c9801",
      persistedOnServer: false,
    },
    claimExtraction: {
      extractedText:
        "vereditum • The hoax, vs... Kapolri Bakal Berlakukan SIM Seumur Hidup, Dinilai Bisa Pangkas Birokrasi & Mencegah Praktik Pungli.",
      extractedHeadline:
        "Kapolri Bakal Berlakukan SIM Seumur Hidup, Dinilai Bisa Pangkas Birokrasi & Mencegah Praktik Pungli.",
      graphicOverlayTexts: ["HOAX"],
      extractedCaption: "The hoax, vs...",
      captionTruncated: false,
      clarificationOrDebunkText: "The hoax, vs... · HOAX",
      primaryClaim: "Kapolri akan memberlakukan SIM seumur hidup",
      secondaryClaims: [
        "Perubahan masa berlaku SIM tidak memerlukan biaya perpanjangan lagi",
      ],
      normalizedClaims: [
        {
          id: "NC-01",
          subject: "Surat Izin Mengemudi (SIM)",
          predicateAction: "akan memberlakukan SIM seumur hidup",
          objectTarget: "Pemegang SIM nasional",
          proposition: "Kapolri akan memberlakukan SIM seumur hidup",
          eventDate: "November 2026",
          legalOrAdministrativeStatus: "Regulasi tetap 5 tahun (UU No. 22 Tahun 2009)",
          sourceRole: "headline",
          semanticNote:
            "Headline memuat isu klaim yang diuji, sementara caption @vereditum menjelaskan bantahan resmi Korlantas Polri.",
          requiredForFullConfirmation: true,
        },
      ],
      atomicClaims: [
        {
          id: "AC-01",
          category: "main_event",
          label: "Klaim Kebijakan yang Diuji",
          proposition: "Kapolri akan memberlakukan SIM seumur hidup",
          requiredForFullConfirmation: true,
        },
      ],
      ocr: {
        extractedHeadline:
          "Kapolri Bakal Berlakukan SIM Seumur Hidup, Dinilai Bisa Pangkas Birokrasi & Mencegah Praktik Pungli.",
        graphicOverlayTexts: ["HOAX"],
        extractedCaption: "The hoax, vs...",
        captionTruncated: false,
        publisherOrAccountName: "Vereditum Fact Check",
        visibleAccountHandle: "@vereditum",
        visiblePostUrl: "https://instagram.com/vereditum",
        visiblePublicationDate: "1 hari yang lalu",
        clarificationOrDebunkText: "The hoax, vs... · HOAX",
        rawTranscript:
          "vereditum • The hoax, vs... Kapolri Bakal Berlakukan SIM Seumur Hidup, Dinilai Bisa Pangkas Birokrasi & Mencegah Praktik Pungli.",
        language: "id",
        platform: "Instagram",
        ocrRegions: [
          {
            id: "OCR-01",
            role: "publisher",
            text: "vereditum",
            bbox: { x: 90, y: 188, width: 280, height: 48 },
          },
          {
            id: "OCR-02",
            role: "caption",
            text: "The hoax, vs...",
            bbox: { x: 60, y: 258, width: 420, height: 48 },
          },
          {
            id: "OCR-03",
            role: "debunk_note",
            text: "HOAX",
            bbox: { x: 572, y: 373, width: 390, height: 150 },
          },
          {
            id: "OCR-04",
            role: "headline",
            text: "Kapolri Bakal Berlakukan SIM Seumur Hidup, Dinilai Bisa Pangkas Birokrasi & Mencegah Praktik Pungli.",
            bbox: { x: 170, y: 516, width: 700, height: 170 },
          },
        ],
      },
      textVerificationNotice:
        "Verifikasi dilakukan terhadap klaim tekstual. Keaslian foto sampul tidak diperiksa.",
      topicCategory: "Kebijakan Publik & Lalu Lintas",
      claimDateMentioned: "November 2026",
      language: "id",
      platform: "Instagram",
      visibleAccountHandle: "@vereditum",
      visibleAccountName: "Vereditum Fact Check",
      visiblePostUrl: "https://instagram.com/vereditum",
      visibleTimestamp: "3 jam lalu",
      postStance: "debunking_claim",
      postStanceSummary:
        "Akun @vereditum sedang membantah dan mengklarifikasi isu SIM seumur hidup, bukan menyebarkan hoaks.",
      containsCheckableClaim: true,
      searchQueries: [
        "klarifikasi Korlantas Polri SIM seumur hidup",
        "cek fakta SIM berlaku seumur hidup tanpa perpanjangan",
      ],
    },
    verdict: {
      claimVerdict: "FALSE",
      verdictLabelId: "Hoaks / Salah",
      postClassification: "Postingan Membantah Klaim (Debunking)",
      postStance: "debunking_claim",
      summary:
        "FALSE (Hoaks): Kapolri akan memberlakukan SIM seumur hidup",
      explanation:
        "Tiga sumber resmi dan pemeriksa fakta terindeks membantah klaim SIM seumur hidup. Korlantas Polri menegaskan masa berlaku SIM tetap 5 tahun sesuai UU No. 22 Tahun 2009. Namun postingan @vereditum berstatus Membantah Klaim (Debunking), sehingga akun tidak dilabeli sebagai pembuat hoaks.",
      evidenceMetrics: {
        totalRetrieved: 3,
        relevantSources: 3,
        supportingCount: 0,
        contradictingCount: 3,
        partialContextCount: 0,
        officialOrFactCheckCount: 3,
      },
    },
    supportingEvidence: [],
    contradictingEvidence: [
      {
        id: "SRC-01",
        title: "Portal Resmi Korps Lalu Lintas Polri — Informasi Regulasi SIM",
        url: "https://korlantas.polri.go.id/",
        domain: "korlantas.polri.go.id",
        publisher: "Korlantas Polri",
        publishedAt: "2026-10-14",
        snippet:
          "Ketentuan penerbitan dan perpanjangan SIM tetap berlaku selama 5 tahun sesuai Pasal 85 UU Nomor 22 Tahun 2009 tentang LLAJ.",
        relation: "contradicting",
        claimEvaluated:
          "Kapolri akan memberlakukan SIM seumur hidup",
        sourceTier: "official_government",
        origin: "demo_fixture",
        ratingText: "Klarifikasi Resmi",
        rationale:
          "Regulasi resmi Korlantas membantah klaim bahwa SIM berlaku seumur hidup.",
      },
      {
        id: "SRC-02",
        title: "Kanal Laporan Isu Hoaks Kementerian Komunikasi dan Digital",
        url: "https://www.komdigi.go.id/",
        domain: "komdigi.go.id",
        publisher: "Komdigi RI",
        publishedAt: "2026-10-18",
        snippet:
          "Klaim SIM berlaku seumur hidup tanpa perpanjangan termasuk kategori disinformasi yang berulang.",
        relation: "contradicting",
        claimEvaluated:
          "Kapolri akan memberlakukan SIM seumur hidup",
        sourceTier: "official_government",
        origin: "demo_fixture",
        ratingText: "Disinformasi",
        rationale:
          "Kementerian resmi menegaskan klaim merupakan informasi palsu.",
      },
      {
        id: "SRC-03",
        title: "Basis Data Cek Fakta MAFINDO — TurnBackHoax.id",
        url: "https://turnbackhoax.id/",
        domain: "turnbackhoax.id",
        publisher: "MAFINDO TurnBackHoax",
        publishedAt: "2026-10-19",
        snippet:
          "Narasi SIM seumur hidup gratis tidak sesuai dengan putusan hukum dan aturan perpanjangan SIM yang berlaku.",
        relation: "contradicting",
        claimEvaluated:
          "Kapolri akan memberlakukan SIM seumur hidup",
        sourceTier: "fact_checker",
        origin: "demo_fixture",
        ratingText: "Salah",
        rationale: "Pemeriksa fakta independen menilai klaim salah.",
      },
    ],
    partialContextEvidence: [],
    publicOriginTrace: {
      platform: "Instagram",
      visibleAccountHandle: "@vereditum",
      visibleAccountName: "Vereditum Fact Check",
      visiblePostUrl: "https://instagram.com/vereditum",
      visibleTimestamp: "3 jam lalu",
      clarificationSources: [
        {
          publisher: "Korlantas Polri",
          url: "https://korlantas.polri.go.id/",
          tier: "official_government",
          publishedAt: "2026-10-14",
        },
        {
          publisher: "Komdigi (Kementerian Komunikasi dan Digital)",
          url: "https://www.komdigi.go.id/",
          tier: "official_government",
          publishedAt: "2026-10-18",
        },
        {
          publisher: "MAFINDO / TurnBackHoax",
          url: "https://turnbackhoax.id/",
          tier: "fact_checker",
          publishedAt: "2026-10-19",
        },
      ],
      timeline: [
        {
          id: "tl-1",
          timestampLabel: "Terlihat di screenshot (3 jam lalu)",
          eventType: "post_observed",
          title: "Unggahan klarifikasi terdeteksi pada Instagram @vereditum",
          description:
            "Akun menampilkan label bantahan terhadap narasi berantai SIM seumur hidup.",
          sourceUrl: "https://instagram.com/vereditum",
        },
        {
          id: "tl-2",
          timestampLabel: "14 Okt 2026",
          eventType: "official_statement",
          title: "Penegasan resmi Korlantas Polri: masa berlaku SIM 5 tahun",
          description:
            "Korlantas Polri menyatakan belum ada kebijakan SIM seumur hidup mengacu UU LLAJ.",
          sourceUrl: "https://korlantas.polri.go.id/",
          verifiedDate: "2026-10-14",
        },
        {
          id: "tl-3",
          timestampLabel: "19 Okt 2026",
          eventType: "fact_check_prior",
          title: "Klasifikasi hoaks berulang TurnBackHoax",
          description:
            "Isu SIM seumur hidup berulang kali beredar dan diklasifikasikan sebagai disinformasi.",
          sourceUrl: "https://turnbackhoax.id/",
          verifiedDate: "2026-10-19",
        },
        {
          id: "tl-4",
          timestampLabel: "10 Nov 2026, 16:15 WIB",
          eventType: "verification_run",
          title: "Verifikasi KLAIMSCAN AI selesai (DEMO MODE)",
          description:
            "Klaim diberi verdict FALSE, sedangkan postingan @vereditum dicatat sebagai Debunking.",
          sourceUrl: null,
        },
      ],
      privacyGuarantee:
        "Hanya menganalisis handle dan URL publik yang terlihat pada screenshot serta sumber terbuka (OSINT). Tidak melacak IP pribadi, alamat rumah, lokasi presisi, atau identitas hukum.",
      attributionCaveat:
        "Postingan publik paling awal yang teramati tidak dianggap sebagai penulis asli klaim.",
    },
    evidenceSources: [],
    pipelineSteps: completedDemoSteps([
      "PNG valid · 2.2 KB metadata dibersihkan",
      "Instagram · Sikap: debunking_claim",
      "3 fixture rujukan resmi & fact-check",
      "3 sumber membantah klaim utama",
      "Verdict: FALSE · Post: Debunking",
      "Laporan & Public Trace siap",
    ]),
    limitations: STANDARD_REPORT_LIMITATIONS,
    warnings: ["DEMO MODE: Data contoh fixture untuk presentasi offline."],
  },
  {
    caseId: "KS-DEMO-002",
    title:
      "Tautan pendaftaran online bantuan sosial tunai Rp 900.000 berbasis KTP",
    isDemo: true,
    demoCategoryLabel: "Confirmed False Claim (Phishing / Hoaks)",
    checkedAt: "2026-11-10T07:40:00.000Z",
    imageMetadata: {
      fileName: "wa-forward-bansos-ktp.jpg",
      mimeType: "image/jpeg",
      originalBytes: 184120,
      sanitizedBytes: 179400,
      metadataRemovedBytes: 4720,
      strippedSegments: ["JPEG APP1 (EXIF/XMP)"],
      sha256:
        "3d8a02e579f4b180e27c6a01129a77e04f3d67a908b22e65d1c0a3418b19d224",
      persistedOnServer: false,
    },
    claimExtraction: {
      extractedText:
        "INFO RESMI: Cek penerima bansos tunai Rp900.000 cukup masukkan NIK KTP dan nomor Telegram aktif di tautan daftar-bansos-id[.]example.",
      extractedHeadline: "Cek Penerima Bansos Tunai Rp900.000 Berbasis KTP",
      extractedCaption:
        "INFO RESMI: Cek penerima bansos tunai Rp900.000 cukup masukkan NIK KTP dan nomor Telegram aktif di tautan daftar-bansos-id[.]example.",
      primaryClaim:
        "Pemerintah membagikan bansos Rp900.000 melalui tautan pendaftaran Telegram/KTP tidak resmi",
      secondaryClaims: [
        "Verifikasi bansos dilakukan dengan login akun Telegram pribadi",
      ],
      normalizedClaims: [
        {
          id: "NC-01",
          subject: "Pemerintah / Kementerian Sosial",
          predicateAction: "membuka pendaftaran bansos Rp900.000 via tautan Telegram",
          objectTarget: "Masyarakat pemegang KTP",
          proposition:
            "Pemerintah membagikan bansos Rp900.000 melalui tautan pendaftaran Telegram/KTP tidak resmi",
          eventDate: "November 2026",
          legalOrAdministrativeStatus: null,
          sourceRole: "combined",
          requiredForFullConfirmation: true,
        },
      ],
      textVerificationNotice:
        "Verifikasi dilakukan terhadap klaim tekstual. Keaslian foto sampul tidak diperiksa.",
      topicCategory: "Keamanan Siber & Phishing",
      claimDateMentioned: "November 2026",
      language: "id",
      platform: "WhatsApp",
      visibleAccountHandle: "Pesan Diteruskan Berkali-kali",
      visibleAccountName: null,
      visiblePostUrl: null,
      visibleTimestamp: "08:14 WIB",
      postStance: "asserting_claim",
      postStanceSummary:
        "Pesan berantai mempromosikan klaim palsu dan mengajak pengguna membuka tautan phishing.",
      containsCheckableClaim: true,
      searchQueries: [
        "klarifikasi Kemensos hoaks link pendaftaran bansos Telegram",
        "cekbansos.kemensos.go.id resmi penipuan bansos",
      ],
    },
    verdict: {
      claimVerdict: "FALSE",
      verdictLabelId: "Hoaks / Salah",
      postClassification: "Postingan Mengklaim / Menyebarkan (Asserting)",
      postStance: "asserting_claim",
      summary:
        "FALSE (Hoaks): Tautan pendaftaran bansos Rp900.000 meminta Telegram/OTP bukan kanal resmi Kemensos",
      explanation:
        "Kementerian Sosial RI menegaskan pengecekan penerima bansos hanya melalui portal resmi cekbansos.kemensos.go.id dan tidak pernah meminta login Telegram atau OTP.",
      evidenceMetrics: {
        totalRetrieved: 2,
        relevantSources: 2,
        supportingCount: 0,
        contradictingCount: 2,
        partialContextCount: 0,
        officialOrFactCheckCount: 2,
      },
    },
    supportingEvidence: [],
    contradictingEvidence: [
      {
        id: "SRC-01",
        title: "Portal Resmi Cek Bansos Kementerian Sosial RI",
        url: "https://cekbansos.kemensos.go.id/",
        domain: "cekbansos.kemensos.go.id",
        publisher: "Kemensos RI",
        publishedAt: "2026-11-01",
        snippet:
          "Pengecekan data penerima bantuan sosial dilakukan melalui sistem DTKS pada domain resmi .go.id tanpa pungutan atau tautan pihak ketiga.",
        relation: "contradicting",
        claimEvaluated:
          "Pemerintah membagikan bansos Rp900.000 melalui tautan pendaftaran Telegram/KTP tidak resmi",
        sourceTier: "official_government",
        origin: "demo_fixture",
        ratingText: "Situs Resmi",
        rationale:
          "Domain resmi membuktikan tautan non-.go.id pada screenshot adalah palsu.",
      },
      {
        id: "SRC-02",
        title: "Imbauan Keamanan Siber Phishing Bantuan Sosial — BSSN",
        url: "https://www.bssn.go.id/",
        domain: "bssn.go.id",
        publisher: "BSSN RI",
        publishedAt: "2026-10-25",
        snippet:
          "Modus rekayasa sosial tautan bansos yang meminta nomor telepon dan kode OTP bertujuan mengambil alih akun pengguna.",
        relation: "contradicting",
        claimEvaluated:
          "Pemerintah membagikan bansos Rp900.000 melalui tautan pendaftaran Telegram/KTP tidak resmi",
        sourceTier: "official_government",
        origin: "demo_fixture",
        ratingText: "Peringatan Phishing",
        rationale: "Pola klaim cocok dengan peringatan resmi phishing BSSN.",
      },
    ],
    partialContextEvidence: [],
    publicOriginTrace: {
      platform: "WhatsApp",
      visibleAccountHandle: "Pesan Diteruskan Berkali-kali",
      visibleAccountName: null,
      visiblePostUrl: null,
      visibleTimestamp: "08:14 WIB",
      clarificationSources: [
        {
          publisher: "Kementerian Sosial RI",
          url: "https://cekbansos.kemensos.go.id/",
          tier: "official_government",
          publishedAt: "2026-11-01",
        },
        {
          publisher: "BSSN / Aduan Siber",
          url: "https://www.bssn.go.id/",
          tier: "official_government",
          publishedAt: "2026-10-25",
        },
      ],
      timeline: [
        {
          id: "tl-wa-1",
          timestampLabel: "08:14 WIB",
          eventType: "post_observed",
          title: "Pesan berantai WhatsApp mengarahkan ke tautan eksternal",
          description:
            "Terlihat ajakan memasukkan NIK dan nomor Telegram aktif untuk pencairan dana.",
          sourceUrl: null,
        },
        {
          id: "tl-wa-2",
          timestampLabel: "01 Nov 2026",
          eventType: "official_statement",
          title: "Kanal tunggal pengecekan bansos Kemensos",
          description:
            "Kemensos hanya melayani pengecekan publik via domain .go.id tanpa pendaftaran tautan Telegram.",
          sourceUrl: "https://cekbansos.kemensos.go.id/",
          verifiedDate: "2026-11-01",
        },
      ],
      privacyGuarantee:
        "Hanya menganalisis informasi publik yang terlihat pada screenshot. Tidak melacak IP pribadi atau nomor pengirim pesan.",
      attributionCaveat:
        "Pesan terusan paling awal yang terlihat tidak dianggap sebagai pembuat awal hoaks.",
    },
    evidenceSources: [],
    pipelineSteps: completedDemoSteps([
      "JPEG valid · EXIF APP1 dihapus",
      "WhatsApp · Sikap: asserting_claim",
      "2 fixture resmi Kemensos & BSSN",
      "2 sumber membantah tautan",
      "Verdict: FALSE · Post: Asserting",
      "Laporan investigasi siap",
    ]),
    limitations: STANDARD_REPORT_LIMITATIONS,
    warnings: ["DEMO MODE: Data contoh fixture untuk presentasi offline."],
  },
  {
    caseId: "KS-DEMO-003",
    title: "Rekaman air laut surut diklaim sebagai kejadian tsunami hari ini",
    isDemo: true,
    demoCategoryLabel: "Outdated Claim (Konten Lama)",
    checkedAt: "2026-11-09T14:20:00.000Z",
    imageMetadata: {
      fileName: "tiktok-surut-pantai.webp",
      mimeType: "image/webp",
      originalBytes: 312900,
      sanitizedBytes: 310200,
      metadataRemovedBytes: 2700,
      strippedSegments: ["WebP EXIF"],
      sha256:
        "7a12b6e3c90d4a58fe9302e554d9ab08e291f8c4d102a74312349bc89d0145aa",
      persistedOnServer: false,
    },
    claimExtraction: {
      extractedText:
        "BREAKING: Warga panik air laut surut mendadak siang ini di pesisir selatan, pertanda gempa megathrust!",
      extractedHeadline: "Air Laut Surut Mendadak Siang Ini di Pesisir Selatan Pertanda Megathrust",
      extractedCaption:
        "BREAKING: Warga panik air laut surut mendadak siang ini di pesisir selatan, pertanda gempa megathrust!",
      primaryClaim:
        "Terjadi fenomena air laut surut mendadak akibat gempa megathrust di pesisir selatan hari ini",
      secondaryClaims: [],
      normalizedClaims: [
        {
          id: "NC-01",
          subject: "Wilayah pesisir selatan",
          predicateAction: "mengalami air laut surut mendadak akibat gempa megathrust",
          objectTarget: "Pesisir selatan Indonesia",
          proposition:
            "Terjadi fenomena air laut surut mendadak akibat gempa megathrust di pesisir selatan hari ini",
          eventDate: "Hari ini",
          legalOrAdministrativeStatus: null,
          sourceRole: "headline",
          requiredForFullConfirmation: true,
        },
      ],
      textVerificationNotice:
        "Verifikasi dilakukan terhadap klaim tekstual. Keaslian foto sampul tidak diperiksa.",
      topicCategory: "Kebencanaan & Lingkungan",
      claimDateMentioned: "Hari ini",
      language: "id",
      platform: "TikTok",
      visibleAccountHandle: "@update_viral_nusantara",
      visibleAccountName: "Update Viral",
      visiblePostUrl: null,
      visibleTimestamp: "5 jam lalu",
      postStance: "asserting_claim",
      postStanceSummary:
        "Unggahan membingkai cuplikan video lama sebagai peristiwa darurat yang sedang berlangsung hari ini.",
      containsCheckableClaim: true,
      searchQueries: [
        "klarifikasi BMKG video air laut surut megathrust",
        "cek fakta video lama tsunami diunggah ulang",
      ],
    },
    verdict: {
      claimVerdict: "OUTDATED",
      verdictLabelId: "Kedaluwarsa",
      postClassification: "Postingan Mengklaim / Menyebarkan (Asserting)",
      postStance: "asserting_claim",
      summary:
        "OUTDATED (Kedaluwarsa): Video merupakan peristiwa lama yang dikemas ulang sebagai kejadian hari ini",
      explanation:
        "Informasi terkini BMKG tidak mencatat adanya peringatan dini tsunami pada tanggal unggahan; rekaman berasal dari peristiwa arsip lama yang diunggah ulang tanpa konteks waktu.",
      evidenceMetrics: {
        totalRetrieved: 2,
        relevantSources: 2,
        supportingCount: 0,
        contradictingCount: 1,
        partialContextCount: 1,
        officialOrFactCheckCount: 2,
      },
    },
    supportingEvidence: [],
    contradictingEvidence: [
      {
        id: "SRC-01",
        title: "Portal Peringatan Dini & Gempa Bumi Resmi — BMKG",
        url: "https://www.bmkg.go.id/",
        domain: "bmkg.go.id",
        publisher: "BMKG RI",
        publishedAt: "2026-11-09",
        snippet:
          "Tidak terdapat aktivitas gempa pemicu tsunami maupun status darurat pesisir selatan pada tanggal unggahan.",
        relation: "contradicting",
        claimEvaluated:
          "Terjadi fenomena air laut surut mendadak akibat gempa megathrust di pesisir selatan hari ini",
        sourceTier: "official_government",
        origin: "demo_fixture",
        ratingText: "Tidak Ada Peringatan",
        rationale: "Data resmi BMKG menyangkal klaim kejadian hari ini.",
      },
    ],
    partialContextEvidence: [
      {
        id: "SRC-02",
        title: "Cek Fakta Arsip Video Bencana Lama — ANTARA",
        url: "https://www.antaranews.com/",
        domain: "antaranews.com",
        publisher: "ANTARA News",
        publishedAt: "2026-11-08",
        snippet:
          "Potongan rekaman air surut tersebut berasal dari kejadian tahun sebelumnya dan sering digunakan ulang tanpa konteks.",
        relation: "partial_context",
        claimEvaluated:
          "Terjadi fenomena air laut surut mendadak akibat gempa megathrust di pesisir selatan hari ini",
        sourceTier: "fact_checker",
        origin: "demo_fixture",
        ratingText: "Konteks Lama / Outdated",
        rationale: "Menunjukkan rekaman berasal dari arsip lama.",
      },
    ],
    publicOriginTrace: {
      platform: "TikTok",
      visibleAccountHandle: "@update_viral_nusantara",
      visibleAccountName: "Update Viral",
      visiblePostUrl: null,
      visibleTimestamp: "5 jam lalu",
      clarificationSources: [
        {
          publisher: "BMKG RI",
          url: "https://www.bmkg.go.id/",
          tier: "official_government",
          publishedAt: "2026-11-09",
        },
        {
          publisher: "ANTARA Anti-Hoax",
          url: "https://www.antaranews.com/",
          tier: "fact_checker",
          publishedAt: "2026-11-08",
        },
      ],
      timeline: [
        {
          id: "tl-tt-1",
          timestampLabel: "5 jam lalu",
          eventType: "post_observed",
          title: "Video berlabel BREAKING di TikTok @update_viral_nusantara",
          description: "Klip diberi narasi kejadian darurat hari ini.",
          sourceUrl: null,
        },
        {
          id: "tl-tt-2",
          timestampLabel: "09 Nov 2026",
          eventType: "official_statement",
          title: "Tidak ada peringatan dini tsunami aktif di BMKG",
          description: "Portal resmi BMKG tidak menunjukkan status bahaya terkait.",
          sourceUrl: "https://www.bmkg.go.id/",
          verifiedDate: "2026-11-09",
        },
      ],
      privacyGuarantee:
        "Hanya menganalisis handle publik yang terlihat pada screenshot dan sumber terbuka (OSINT).",
      attributionCaveat:
        "Akun pengunggah ulang pada screenshot belum tentu merupakan perekam asli video.",
    },
    evidenceSources: [],
    pipelineSteps: completedDemoSteps([
      "WebP valid · EXIF dihapus",
      "TikTok · Sikap: asserting_claim",
      "2 fixture BMKG & ANTARA",
      "Konteks waktu kedaluwarsa terdeteksi",
      "Verdict: OUTDATED",
      "Laporan investigasi siap",
    ]),
    limitations: STANDARD_REPORT_LIMITATIONS,
    warnings: ["DEMO MODE: Data contoh fixture untuk presentasi offline."],
  },
  {
    caseId: "KS-DEMO-004",
    title:
      "Biaya transfer antarbank via layanan BI-FAST maksimal Rp 2.500 per transaksi",
    isDemo: true,
    demoCategoryLabel: "Verified True Claim",
    checkedAt: "2026-11-08T11:05:00.000Z",
    imageMetadata: {
      fileName: "fb-info-bifast.png",
      mimeType: "image/png",
      originalBytes: 152400,
      sanitizedBytes: 151800,
      metadataRemovedBytes: 600,
      strippedSegments: ["PNG tEXt"],
      sha256:
        "f481c2e77a319c6b0e5d1f9b224d87c09e2f1a6b88d31059ce62b1031a8f9073",
      persistedOnServer: false,
    },
    claimExtraction: {
      extractedText:
        "Info layanan perbankan: Transfer antarbank lewat BI-FAST dikenakan tarif maksimal Rp2.500 per transaksi untuk nasabah ritel.",
      extractedHeadline: "Tarif Transfer Antarbank BI-FAST Maksimal Rp2.500 Per Transaksi",
      extractedCaption:
        "Info layanan perbankan: Transfer antarbank lewat BI-FAST dikenakan tarif maksimal Rp2.500 per transaksi untuk nasabah ritel.",
      primaryClaim:
        "Tarif transfer antarbank melalui layanan BI-FAST untuk nasabah maksimal Rp2.500 per transaksi",
      secondaryClaims: [],
      normalizedClaims: [
        {
          id: "NC-01",
          subject: "Layanan transfer BI-FAST Bank Indonesia",
          predicateAction: "menetapkan tarif maksimal Rp2.500 per transaksi",
          objectTarget: "Nasabah ritel perbankan",
          proposition:
            "Tarif transfer antarbank melalui layanan BI-FAST untuk nasabah maksimal Rp2.500 per transaksi",
          eventDate: null,
          legalOrAdministrativeStatus: "Regulasi Bank Indonesia",
          sourceRole: "headline",
          requiredForFullConfirmation: true,
        },
      ],
      textVerificationNotice:
        "Verifikasi dilakukan terhadap klaim tekstual. Keaslian foto sampul tidak diperiksa.",
      topicCategory: "Ekonomi & Perbankan",
      claimDateMentioned: null,
      language: "id",
      platform: "Facebook",
      visibleAccountHandle: "Komunitas Literasi Finansial",
      visibleAccountName: "Komunitas Literasi Finansial",
      visiblePostUrl: null,
      visibleTimestamp: "1 hari lalu",
      postStance: "neutral_discussion",
      postStanceSummary:
        "Unggahan membagikan informasi layanan perbankan secara informatif dan netral.",
      containsCheckableClaim: true,
      searchQueries: ["tarif resmi transfer BI-FAST Bank Indonesia 2500"],
    },
    verdict: {
      claimVerdict: "TRUE",
      verdictLabelId: "Terverifikasi / Benar",
      postClassification: "Diskusi / Informasi Netral (Neutral)",
      postStance: "neutral_discussion",
      summary:
        "TRUE (Terverifikasi): Tarif maksimal layanan BI-FAST ke nasabah sebesar Rp 2.500",
      explanation:
        "Ketentuan resmi Bank Indonesia menetapkan batas maksimal biaya transaksi BI-FAST dari peserta kepada nasabah ritel adalah Rp 2.500 per transaksi.",
      evidenceMetrics: {
        totalRetrieved: 1,
        relevantSources: 1,
        supportingCount: 1,
        contradictingCount: 0,
        partialContextCount: 0,
        officialOrFactCheckCount: 1,
      },
    },
    supportingEvidence: [
      {
        id: "SRC-01",
        title: "Informasi Sistem Pembayaran BI-FAST — Bank Indonesia",
        url: "https://www.bi.go.id/",
        domain: "bi.go.id",
        publisher: "Bank Indonesia",
        publishedAt: "2026-09-12",
        snippet:
          "Tarif BI-FAST dari peserta kepada nasabah ditetapkan paling tinggi sebesar Rp2.500 per transaksi.",
        relation: "supporting",
        claimEvaluated:
          "Tarif transfer antarbank melalui layanan BI-FAST untuk nasabah maksimal Rp2.500 per transaksi",
        sourceTier: "official_government",
        origin: "demo_fixture",
        ratingText: "Terverifikasi Resmi",
        rationale: "Sumber otoritatif Bank Indonesia mengonfirmasi klaim.",
      },
    ],
    contradictingEvidence: [],
    partialContextEvidence: [],
    publicOriginTrace: {
      platform: "Facebook",
      visibleAccountHandle: "Komunitas Literasi Finansial",
      visibleAccountName: "Komunitas Literasi Finansial",
      visiblePostUrl: null,
      visibleTimestamp: "1 hari lalu",
      clarificationSources: [
        {
          publisher: "Bank Indonesia",
          url: "https://www.bi.go.id/",
          tier: "official_government",
          publishedAt: "2026-09-12",
        },
      ],
      timeline: [
        {
          id: "tl-fb-1",
          timestampLabel: "1 hari lalu",
          eventType: "post_observed",
          title: "Unggahan edukasi di Facebook",
          description: "Menyebutkan tarif maksimal BI-FAST Rp2.500.",
          sourceUrl: null,
        },
        {
          id: "tl-fb-2",
          timestampLabel: "12 Sep 2026",
          eventType: "official_statement",
          title: "Konfirmasi tarif ritel BI-FAST Rp2.500",
          description: "Publikasi Bank Indonesia memverifikasi besaran tarif.",
          sourceUrl: "https://www.bi.go.id/",
          verifiedDate: "2026-09-12",
        },
      ],
      privacyGuarantee:
        "Hanya menganalisis informasi publik yang terlihat pada screenshot dan sumber terbuka (OSINT).",
      attributionCaveat:
        "Halaman pengunggah tidak diasumsikan sebagai pembuat regulasi asli.",
    },
    evidenceSources: [],
    pipelineSteps: completedDemoSteps([
      "PNG valid · metadata dibersihkan",
      "Facebook · Sikap: neutral_discussion",
      "1 fixture resmi Bank Indonesia",
      "1 sumber mendukung penuh",
      "Verdict: TRUE",
      "Laporan investigasi siap",
    ]),
    limitations: STANDARD_REPORT_LIMITATIONS,
    warnings: ["DEMO MODE: Data contoh fixture untuk presentasi offline."],
  },
  {
    caseId: "KS-DEMO-005",
    title: "Rumor penambahan 5 hari cuti bersama mendadak minggu depan",
    isDemo: true,
    demoCategoryLabel: "Unverified Claim (Bukti Tidak Cukup)",
    checkedAt: "2026-11-10T04:10:00.000Z",
    imageMetadata: {
      fileName: "x-rumor-cuti.png",
      mimeType: "image/png",
      originalBytes: 128900,
      sanitizedBytes: 128900,
      metadataRemovedBytes: 0,
      strippedSegments: [],
      sha256:
        "2f809b4e331c8b7e45f9a6b0d327e9c1b54a83e2f7c109482e5a13b74d60c890",
      persistedOnServer: false,
    },
    claimExtraction: {
      extractedText:
        "Katanya minggu depan ada tambahan cuti bersama nasional 5 hari karena agenda KTT. Ada yang sudah lihat SKB resminya?",
      extractedHeadline: "Tambahan Cuti Bersama Nasional 5 Hari Minggu Depan",
      extractedCaption:
        "Katanya minggu depan ada tambahan cuti bersama nasional 5 hari karena agenda KTT. Ada yang sudah lihat SKB resminya?",
      primaryClaim:
        "Pemerintah menetapkan tambahan cuti bersama nasional selama 5 hari pada minggu depan",
      secondaryClaims: [],
      normalizedClaims: [
        {
          id: "NC-01",
          subject: "Pemerintah RI",
          predicateAction: "menetapkan tambahan cuti bersama 5 hari",
          objectTarget: "Jadwal libur nasional minggu depan",
          proposition:
            "Pemerintah menetapkan tambahan cuti bersama nasional selama 5 hari pada minggu depan",
          eventDate: "Minggu depan (November 2026)",
          legalOrAdministrativeStatus: "Menunggu konfirmasi SKB 3 Menteri",
          sourceRole: "combined",
          requiredForFullConfirmation: true,
        },
      ],
      textVerificationNotice:
        "Verifikasi dilakukan terhadap klaim tekstual. Keaslian foto sampul tidak diperiksa.",
      topicCategory: "Pemerintahan & Ketenagakerjaan",
      claimDateMentioned: "Minggu depan (November 2026)",
      language: "id",
      platform: "X",
      visibleAccountHandle: "@warganet_tanya",
      visibleAccountName: "Warganet Tanya",
      visiblePostUrl: null,
      visibleTimestamp: "45 menit lalu",
      postStance: "neutral_discussion",
      postStanceSummary:
        "Akun mempertanyakan kebenaran rumor penambahan cuti bersama dalam diskusi publik.",
      containsCheckableClaim: true,
      searchQueries: [
        "SKB 3 Menteri perubahan cuti bersama November 2026",
        "Kemenpan RB tambahan cuti bersama 5 hari",
      ],
    },
    verdict: {
      claimVerdict: "UNVERIFIED",
      verdictLabelId: "Belum Terverifikasi",
      postClassification: "Diskusi / Informasi Netral (Neutral)",
      postStance: "neutral_discussion",
      summary:
        "UNVERIFIED (Belum Terverifikasi): Belum ditemukan SKB atau rujukan resmi yang mengonfirmasi maupun membantah",
      explanation:
        "Tidak ditemukan sumber resmi, dokumen SKB, atau artikel fact-check yang cukup untuk memverifikasi klaim ini. Sesuai prinsip anti-halusinasi, sistem menetapkan UNVERIFIED alih-alih menebak.",
      evidenceMetrics: {
        totalRetrieved: 0,
        relevantSources: 0,
        supportingCount: 0,
        contradictingCount: 0,
        partialContextCount: 0,
        officialOrFactCheckCount: 0,
      },
    },
    supportingEvidence: [],
    contradictingEvidence: [],
    partialContextEvidence: [],
    publicOriginTrace: {
      platform: "X",
      visibleAccountHandle: "@warganet_tanya",
      visibleAccountName: "Warganet Tanya",
      visiblePostUrl: null,
      visibleTimestamp: "45 menit lalu",
      clarificationSources: [],
      timeline: [
        {
          id: "tl-x-1",
          timestampLabel: "45 menit lalu",
          eventType: "post_observed",
          title: "Diskusi rumor beredar di X @warganet_tanya",
          description: "Akun menanyakan keberadaan SKB resmi.",
          sourceUrl: null,
        },
        {
          id: "tl-x-2",
          timestampLabel: "10 Nov 2026, 11:10 WIB",
          eventType: "verification_run",
          title: "Bukti tidak mencukupi — status UNVERIFIED",
          description:
            "Sistem menjaga agar klaim tanpa bukti resmi tidak divonis FALSE/TRUE secara sepihak.",
          sourceUrl: null,
        },
      ],
      privacyGuarantee:
        "Hanya menganalisis informasi publik yang terlihat pada screenshot.",
      attributionCaveat:
        "Akun penanya bukanlah sumber pembuat rumor dan postingan awal tidak otomatis pencipta isu.",
    },
    evidenceSources: [],
    pipelineSteps: completedDemoSteps([
      "PNG valid · tidak ada metadata",
      "X · Sikap: neutral_discussion",
      "0 dokumen SKB resmi ditemukan",
      "Tidak ada bukti pembanding memadai",
      "Fallback aman: UNVERIFIED",
      "Laporan investigasi siap",
    ]),
    limitations: STANDARD_REPORT_LIMITATIONS,
    warnings: [
      "DEMO MODE: Belum ditemukan bukti memadai sehingga status ditetapkan UNVERIFIED.",
    ],
  },
  {
    caseId: "KS-DEMO-006",
    title:
      "Kutipan pernyataan subsidi energi gratis penuh tanpa syarat di semua daerah",
    isDemo: true,
    demoCategoryLabel: "Misleading Quote (Post Quoting / Verdict MISLEADING)",
    checkedAt: "2026-11-09T19:00:00.000Z",
    imageMetadata: {
      fileName: "x-quote-subsidi.png",
      mimeType: "image/png",
      originalBytes: 141200,
      sanitizedBytes: 140800,
      metadataRemovedBytes: 400,
      strippedSegments: ["PNG tEXt"],
      sha256:
        "6c18b4a2e9d73f0192b58e41c33d08f174e8a92a11c05f432b8d9a1c3f6e4401",
      persistedOnServer: false,
    },
    claimExtraction: {
      extractedText:
        "Mengutip headline berita: 'Subsidi penuh berlaku mulai bulan depan untuk seluruh masyarakat.' Apakah artinya semua rumah tangga otomatis gratis?",
      extractedHeadline: "Subsidi Penuh Berlaku Mulai Bulan Depan Untuk Seluruh Masyarakat",
      extractedCaption:
        "Mengutip headline berita: 'Subsidi penuh berlaku mulai bulan depan untuk seluruh masyarakat.' Apakah artinya semua rumah tangga otomatis gratis?",
      primaryClaim:
        "Subsidi energi gratis penuh berlaku otomatis untuk seluruh masyarakat tanpa syarat kategori",
      secondaryClaims: [],
      normalizedClaims: [
        {
          id: "NC-01",
          subject: "Program subsidi energi pemerintah",
          predicateAction: "berlaku penuh otomatis tanpa syarat kategori",
          objectTarget: "Seluruh rumah tangga masyarakat",
          proposition:
            "Subsidi energi gratis penuh berlaku otomatis untuk seluruh masyarakat tanpa syarat kategori",
          eventDate: "Bulan depan",
          legalOrAdministrativeStatus: null,
          sourceRole: "headline",
          requiredForFullConfirmation: true,
        },
      ],
      textVerificationNotice:
        "Verifikasi dilakukan terhadap klaim tekstual. Keaslian foto sampul tidak diperiksa.",
      topicCategory: "Ekonomi & Kebijakan Publik",
      claimDateMentioned: "Bulan depan",
      language: "id",
      platform: "X",
      visibleAccountHandle: "@kutip_kebijakan",
      visibleAccountName: "Kutip Kebijakan",
      visiblePostUrl: null,
      visibleTimestamp: "6 jam lalu",
      postStance: "quoting_claim",
      postStanceSummary:
        "Akun mengutip potongan headline berita dan menanyakan cakupan syarat penerapannya.",
      containsCheckableClaim: true,
      searchQueries: [
        "klarifikasi Kementerian ESDM syarat penerima subsidi energi",
      ],
    },
    verdict: {
      claimVerdict: "MISLEADING",
      verdictLabelId: "Menyesatkan",
      postClassification: "Postingan Mengutip Klaim (Quoting)",
      postStance: "quoting_claim",
      summary:
        "MISLEADING (Menyesatkan): Potongan kutipan menghilangkan batasan kriteria penerima yang disyaratkan",
      explanation:
        "Program bantuan energi memang diumumkan, namun dokumen resmi membatasi penerima hanya pada kelompok rentan tertentu dalam DTKS sehingga klaim 'untuk seluruh masyarakat tanpa syarat' menyesatkan.",
      evidenceMetrics: {
        totalRetrieved: 1,
        relevantSources: 1,
        supportingCount: 0,
        contradictingCount: 0,
        partialContextCount: 1,
        officialOrFactCheckCount: 1,
      },
    },
    supportingEvidence: [],
    contradictingEvidence: [],
    partialContextEvidence: [
      {
        id: "SRC-01",
        title: "Siaran Pers Kebijakan Bantuan Energi Tepat Sasaran — ESDM",
        url: "https://www.esdm.go.id/",
        domain: "esdm.go.id",
        publisher: "Kementerian ESDM",
        publishedAt: "2026-11-05",
        snippet:
          "Penyaluran bantuan difokuskan secara bertahap bagi keluarga penerima manfaat terdata, bukan untuk seluruh golongan tanpa syarat.",
        relation: "partial_context",
        claimEvaluated:
          "Subsidi energi gratis penuh berlaku otomatis untuk seluruh masyarakat tanpa syarat kategori",
        sourceTier: "official_government",
        origin: "demo_fixture",
        ratingText: "Butuh Konteks Tambahan",
        rationale:
          "Program ada namun syarat penerimanya dipotong oleh potongan kutipan.",
      },
    ],
    publicOriginTrace: {
      platform: "X",
      visibleAccountHandle: "@kutip_kebijakan",
      visibleAccountName: "Kutip Kebijakan",
      visiblePostUrl: null,
      visibleTimestamp: "6 jam lalu",
      clarificationSources: [
        {
          publisher: "Kementerian ESDM",
          url: "https://www.esdm.go.id/",
          tier: "official_government",
          publishedAt: "2026-11-05",
        },
      ],
      timeline: [
        {
          id: "tl-q-1",
          timestampLabel: "6 jam lalu",
          eventType: "post_observed",
          title: "Unggahan mengutip potongan headline di X @kutip_kebijakan",
          description: "Sikap postingan adalah mengutip klaim (quoting_claim).",
          sourceUrl: null,
        },
        {
          id: "tl-q-2",
          timestampLabel: "05 Nov 2026",
          eventType: "official_statement",
          title: "Siaran pers resmi Kementerian ESDM memuat syarat kriteria",
          description: "Menjelaskan batasan kelompok penerima.",
          sourceUrl: "https://www.esdm.go.id/",
          verifiedDate: "2026-11-05",
        },
      ],
      privacyGuarantee:
        "Hanya menganalisis informasi publik yang terlihat pada screenshot.",
      attributionCaveat:
        "Akun pengutip tidak diatribusikan sebagai pembuat disinformasi maupun penulis awal headline.",
    },
    evidenceSources: [],
    pipelineSteps: completedDemoSteps([
      "PNG valid · metadata dibersihkan",
      "X · Sikap: quoting_claim",
      "1 fixture resmi Kementerian ESDM",
      "1 sumber konteks parsial",
      "Verdict: MISLEADING",
      "Laporan investigasi siap",
    ]),
    limitations: STANDARD_REPORT_LIMITATIONS,
    warnings: ["DEMO MODE: Data contoh fixture untuk presentasi offline."],
  },
];

export const DEMO_FIXTURE_CASES: InvestigationReport[] =
  BASE_DEMO_FIXTURE_CASES.map((item) => ({
    ...item,
    evidenceSources: [
      ...item.supportingEvidence,
      ...item.contradictingEvidence,
      ...item.partialContextEvidence,
    ],
  }));
