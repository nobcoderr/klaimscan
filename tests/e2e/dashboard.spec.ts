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
});
