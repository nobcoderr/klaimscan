import { expect, test } from "@playwright/test";

test.describe("KLAIMSCAN AI Threat Intelligence Dashboard", () => {
  test("renders SOC dashboard, @vereditum role separation, demo cases, and all navigation views", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByText("Threat Intelligence Dashboard")).toBeVisible();
    await expect(page.getByText("CASES ANALYZED")).toBeVisible();
    await expect(page.getByText("FLAGGED CLAIMS")).toBeVisible();
    await expect(page.getByText("SOURCES FOUND")).toBeVisible();

    // Verify DEMO MODE label is explicit on fixture case
    await expect(page.getByText(/DEMO MODE — Fixture Data/i)).toBeVisible();

    // Verify @vereditum reference separation between Verdict (FALSE) and Post Stance (Debunking)
    await expect(page.getByText("FALSE • HOAKS")).toBeVisible();
    await expect(
      page.getByText("Pemisahan Klasifikasi Postingan vs Verdict Klaim Aktif")
    ).toBeVisible();
    await expect(page.getByText("Debunking (Membantah)").first()).toBeVisible();

    // Verify Text-First UI sections & mandatory disclaimer
    await expect(page.getByText("EXTRACTED HEADLINE")).toBeVisible();
    await expect(page.getByText("EXTRACTED CAPTION")).toBeVisible();
    await expect(page.getByText("NORMALIZED FACTUAL CLAIMS")).toBeVisible();
    await expect(page.getByText("FACT CHECK VERDICT")).toBeVisible();
    await expect(page.getByText("EVIDENCE SOURCES")).toBeVisible();
    await expect(
      page
        .getByText(
          "Verifikasi dilakukan terhadap klaim tekstual. Keaslian foto sampul tidak diperiksa."
        )
        .first()
    ).toBeVisible();
    await expect(page.getByText("VIRAL PHOTO FALSE")).toHaveCount(0);

    // Interactive OCR Text Highlight selection
    await expect(page.getByText("OCR Text Highlight")).toBeVisible();
    await page.getByRole("button", { name: "CAPTION", exact: true }).click();
    await expect(page.getByText("CAPTION TERPILIH:")).toBeVisible();

    // Load generated sample screenshot and verify preview renders on Dashboard
    await page.getByRole("button", { name: "Muat Sample Uji", exact: true }).click();
    await expect(
      page.getByAltText("Preview screenshot yang akan dianalisis")
    ).toBeVisible();

    // Switch through Demo Mode fixtures in sidebar (D-4 TRUE, D-5 UNVERIFIED, D-3 OUTDATED, D-1 FALSE)
    await page.getByRole("button", { name: "D-4", exact: true }).click();
    await expect(page.getByText("TRUE • TERVERIFIKASI")).toBeVisible();

    await page.getByRole("button", { name: "D-5", exact: true }).click();
    await expect(
      page.getByText("UNVERIFIED • BELUM TERVERIFIKASI")
    ).toBeVisible();

    await page.getByRole("button", { name: "D-3", exact: true }).click();
    await expect(page.getByText("OUTDATED • KEDALUWARSA")).toBeVisible();

    await page.getByRole("button", { name: "D-1", exact: true }).click();
    await expect(page.getByText("FALSE • HOAKS")).toBeVisible();

    // Navigate all primary SOC sidebar views
    const sidebarNav = page.getByRole("navigation", { name: "Navigasi utama" });

    await sidebarNav.getByRole("button", { name: /New Analysis/i }).click();
    await expect(page.getByText("New Intelligence Analysis")).toBeVisible();

    await sidebarNav.getByRole("button", { name: /Analysis Result/i }).click();
    await expect(
      page.getByText("Analysis Result — Claim vs Stance & Evidence")
    ).toBeVisible();

    await sidebarNav.getByRole("button", { name: /Evidence Timeline/i }).click();
    await expect(
      page.getByText("Evidence Timeline & Chronological Audit")
    ).toBeVisible();

    await sidebarNav.getByRole("button", { name: /Public Source Trace/i }).click();
    await expect(
      page.getByText("Public Source Trace (OSINT Terbatas)")
    ).toBeVisible();

    await sidebarNav.getByRole("button", { name: /Case Report/i }).click();
    await expect(
      page.getByText("Laporan Investigasi Pemeriksaan Fakta")
    ).toBeVisible();
    await expect(page.getByText(/SHA-256:/i)).toBeVisible();
    await expect(
      page.getByText(/Permanent image storage: No \(ephemeral\)/i)
    ).toBeVisible();
    await expect(
      page.getByText(/Batasan Metodologi, Jejak Publik & Privasi/i)
    ).toBeVisible();

    await sidebarNav.getByRole("button", { name: /Case History/i }).click();
    await expect(
      page.getByText("Case History & Demo Fixture Archive")
    ).toBeVisible();

    await sidebarNav.getByRole("button", { name: /Evidence Registry/i }).click();
    await expect(
      page.getByText("Evidence Sources Registry")
    ).toBeVisible();
  });

  test("rejects oversized (>5MB) screenshot upload before hitting backend", async ({
    page,
  }) => {
    await page.goto("/");

    const oversizedBuffer = Buffer.alloc(5 * 1024 * 1024 + 64, 0);
    oversizedBuffer[0] = 0x89;
    oversizedBuffer[1] = 0x50;
    oversizedBuffer[2] = 0x4e;
    oversizedBuffer[3] = 0x47;

    await page.locator('input[type="file"]').setInputFiles({
      name: "oversized.png",
      mimeType: "image/png",
      buffer: oversizedBuffer,
    });

    await expect(
      page.getByText(/Ukuran file melebihi batas maksimal 5 MB/i).first()
    ).toBeVisible();
  });

  test("health endpoint responds online without exposing secrets", async ({
    request,
  }) => {
    const res = await request.get("/api/health");
    expect(res.ok()).toBeTruthy();
    const json = await res.json();
    expect(json.status).toBe("online");
    expect(json.config).toHaveProperty("openAiConfigured");
    expect(json.config).toHaveProperty("factCheckConfigured");
    expect(JSON.stringify(json)).not.toContain("AIzaSy");
    expect(JSON.stringify(json)).not.toContain("sk-");
  });

  test("aligns OCR highlight boxes strictly onto rendered portrait screenshot bitmap without horizontal stretching", async ({
    page,
  }) => {
    let sawOcrGuide = false;
    await page.route("**/api/analyze*", async (route) => {
      const reqBody = route.request().postDataBuffer();
      if (reqBody && reqBody.toString("latin1").includes('name="ocrGuide"')) {
        sawOcrGuide = true;
      }

      const mockReport = {
        caseId: "KS-E2E-PORTRAIT",
        title: "Pernyataan mengenai rencana pemajakan rakyat kecil",
        checkedAt: "2026-11-11T00:10:00.000Z",
        isDemo: false,
        imageMetadata: {
          fileName: "portrait-sociomind.png",
          mimeType: "image/png",
          originalBytes: 4200,
          sanitizedBytes: 4200,
          metadataRemovedBytes: 0,
          strippedSegments: [],
          sha256: "e2e00001abcdef0123456789",
          persistedOnServer: false,
        },
        claimExtraction: {
          extractedText:
            "SOCIOMIND NEWS\nTiap Pidato Ngomongin Pajak, Rakyat Kecil Terus.",
          extractedHeadline:
            "Tiap Pidato Ngomongin Pajak, Rakyat Kecil Terus.",
          graphicOverlayTexts: ["SOCIOMIND NEWS"],
          extractedCaption: "TikTok & IG | @sociomind.co",
          captionTruncated: false,
          clarificationOrDebunkText: null,
          primaryClaim:
            "Pernyataan mengenai rencana pemajakan rakyat kecil termasuk tukang cukur dan tukang pijat",
          secondaryClaims: [],
          normalizedClaims: [
            {
              id: "NC-01",
              subject: "Pemerintah",
              predicateAction: "berencana memajaki",
              objectTarget: "tukang cukur dan tukang pijat",
              proposition:
                "Terdapat narasi rencana pemajakan rakyat kecil.",
              eventDate: null,
              legalOrAdministrativeStatus: null,
              sourceRole: "headline",
              semanticNote: null,
              requiredForFullConfirmation: true,
            },
          ],
          atomicClaims: [
            {
              id: "AC-01",
              category: "main_event",
              label: "Klaim Utama",
              proposition:
                "Terdapat narasi rencana pemajakan rakyat kecil.",
              requiredForFullConfirmation: true,
            },
          ],
          ocr: {
            extractedHeadline:
              "Tiap Pidato Ngomongin Pajak, Rakyat Kecil Terus.",
            graphicOverlayTexts: ["SOCIOMIND NEWS"],
            extractedCaption: "TikTok & IG | @sociomind.co",
            captionTruncated: false,
            publisherOrAccountName: "SOCIOMIND NEWS",
            visibleAccountHandle: "@sociomind.co",
            visiblePostUrl: null,
            visiblePublicationDate: null,
            clarificationOrDebunkText: null,
            rawTranscript: "SOCIOMIND NEWS\nTiap Pidato Ngomongin Pajak",
            language: "id",
            platform: "Instagram",
            ocrRegions: [
              {
                id: "OCR-01",
                role: "publisher",
                text: "SOCIOMIND NEWS",
                bbox: { x: 120, y: 500, width: 280, height: 30 },
              },
              {
                id: "OCR-02",
                role: "headline",
                text: "Tiap Pidato Ngomongin Pajak, Rakyat Kecil Terus.",
                bbox: { x: 120, y: 535, width: 760, height: 120 },
              },
            ],
          },
          textVerificationNotice:
            "Verifikasi dilakukan terhadap klaim tekstual. Keaslian foto sampul tidak diperiksa.",
          topicCategory: "Ekonomi & Pajak",
          claimDateMentioned: null,
          language: "id",
          platform: "Instagram",
          visibleAccountHandle: "@sociomind.co",
          visibleAccountName: "SOCIOMIND NEWS",
          visiblePostUrl: null,
          visibleTimestamp: null,
          postStance: "asserting_claim",
          postStanceSummary: "Unggahan menyampaikan kritik soal pajak.",
          containsCheckableClaim: true,
          searchQueries: ["dugaan pajak tukang cukur"],
        },
        evidenceSources: [],
        supportingEvidence: [],
        contradictingEvidence: [],
        partialContextEvidence: [],
        publicOriginTrace: {
          platform: "Instagram",
          visibleAccountHandle: "@sociomind.co",
          visibleAccountName: "SOCIOMIND NEWS",
          visiblePostUrl: null,
          visibleTimestamp: null,
          clarificationSources: [],
          timeline: [],
          privacyGuarantee: "Server tidak menyimpan gambar permanen.",
          attributionCaveat: "Terbatas pada jejak publik.",
        },
        verdict: {
          claimVerdict: "UNVERIFIED",
          verdictLabelId: "BELUM TERVERIFIKASI",
          postClassification: "Mengklaim / Menyebarkan",
          postStance: "asserting_claim",
          summary: "Belum ditemukan rujukan resmi untuk uji E2E.",
          explanation: "Belum ditemukan rujukan resmi untuk uji E2E.",
          qualifiedStatusLabels: [],
          atomicAssessments: [],
          evidenceMetrics: {
            totalRetrieved: 0,
            relevantSources: 0,
            supportingCount: 0,
            contradictingCount: 0,
            partialContextCount: 0,
            officialOrFactCheckCount: 0,
          },
        },
        pipelineSteps: [],
        limitations: [
          "Verifikasi dilakukan terhadap klaim tekstual. Keaslian foto sampul tidak diperiksa.",
        ],
        warnings: [],
      };

      const body =
        JSON.stringify({ type: "complete", report: mockReport }) + "\n";
      await route.fulfill({
        status: 200,
        contentType: "application/x-ndjson",
        body,
      });
    });

    await page.goto("/");

    const portraitBytes = await page.evaluate(async () => {
      const c = document.createElement("canvas");
      c.width = 270;
      c.height = 585;
      const ctx = c.getContext("2d")!;
      ctx.fillStyle = "#0F172A";
      ctx.fillRect(0, 0, c.width, c.height);
      ctx.fillStyle = "#1D4ED8";
      ctx.fillRect(10, 260, 250, 140);
      ctx.fillStyle = "#FFFFFF";
      ctx.font = "bold 18px sans-serif";
      ctx.fillText("SOCIOMIND NEWS", 30, 300);
      const blob = await new Promise<Blob>((r) =>
        c.toBlob((b) => r(b!), "image/png")
      );
      return Array.from(new Uint8Array(await blob.arrayBuffer()));
    });

    await page.locator('input[type="file"]').setInputFiles({
      name: "portrait-sociomind.png",
      mimeType: "image/png",
      buffer: Buffer.from(portraitBytes),
    });

    await page
      .getByRole("button", { name: /JALANKAN ANALISIS AI/i })
      .click();

    await expect(page.getByText("Screenshot Sesi Aktif")).toBeVisible();

    const imgLocator = page.getByAltText(
      "Screenshot yang dianalisis dengan sorotan OCR"
    );
    const publisherOverlay = page.getByRole("button", {
      name: "Sorot wilayah OCR PUBLISHER / AKUN",
    });

    await expect(imgLocator).toBeVisible();
    await expect(publisherOverlay).toBeVisible();

    const imgBox = await imgLocator.boundingBox();
    const overlayBox = await publisherOverlay.boundingBox();
    expect(imgBox).not.toBeNull();
    expect(overlayBox).not.toBeNull();
    if (imgBox && overlayBox) {
      // Portrait 270:585 at max height 440px -> width should stay narrow (~203px), NOT stretched wide
      expect(imgBox.width).toBeLessThan(260);
      expect(imgBox.height).toBeGreaterThan(360);

      // Highlight box x=120/1000, width=280/1000 MUST sit strictly inside rendered portrait image
      const expectedLeft = imgBox.x + imgBox.width * 0.12;
      const expectedTop = imgBox.y + imgBox.height * 0.5;
      const expectedWidth = imgBox.width * 0.28;
      expect(Math.abs(overlayBox.x - expectedLeft)).toBeLessThan(4);
      expect(Math.abs(overlayBox.y - expectedTop)).toBeLessThan(4);
      expect(Math.abs(overlayBox.width - expectedWidth)).toBeLessThan(4);
    }

    expect(sawOcrGuide).toBe(true);
  });
});
