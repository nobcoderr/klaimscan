import { expect, test } from "@playwright/test";

test.describe("KLAIMSCAN AI Threat Intelligence Dashboard", () => {
  test("renders SOC dashboard, @vereditum role separation, all 6 core surfaces, and upload sample preview", async ({
    page,
  }) => {
    await page.goto("/");

    await expect(page.getByText("Threat Intelligence Dashboard")).toBeVisible();
    await expect(page.getByText("CASES ANALYZED")).toBeVisible();
    await expect(page.getByText("FLAGGED CLAIMS")).toBeVisible();
    await expect(page.getByText("SOURCES FOUND")).toBeVisible();

    // Verify @vereditum reference separation between Verdict (FALSE) and Post Stance (Debunking)
    await expect(page.getByText("FALSE • HOAKS")).toBeVisible();
    await expect(
      page.getByText("Pemisahan Klasifikasi Postingan vs Verdict Klaim Aktif")
    ).toBeVisible();
    await expect(page.getByText("Debunking (Membantah)").first()).toBeVisible();

    // Load generated sample screenshot and verify preview renders
    await page.getByRole("button", { name: "Muat Sample Uji", exact: true }).click();
    await expect(
      page.getByAltText("Preview screenshot yang akan dianalisis")
    ).toBeVisible();

    // Navigate all primary SOC sidebar views
    const sidebarNav = page.getByRole("navigation", { name: "Navigasi utama" });

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

    await sidebarNav.getByRole("button", { name: /Case History/i }).click();
    await expect(
      page.getByText("Case History & Demo Fixture Archive")
    ).toBeVisible();

    await sidebarNav.getByRole("button", { name: /Evidence Registry/i }).click();
    await expect(
      page.getByText("Evidence Sources Registry")
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
