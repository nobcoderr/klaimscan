import { chromium } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const outDir = path.join(process.cwd(), "docs", "screenshots");
fs.mkdirSync(outDir, { recursive: true });

function executablePath() {
  try {
    const bundled = chromium.executablePath();
    if (fs.existsSync(bundled)) return bundled;
  } catch {
    // Fall through to a local browser.
  }
  const localAppData = process.env.LOCALAPPDATA || "";
  const candidates = [
    path.join(localAppData, "ms-playwright", "chromium-1243", "chrome-win64", "chrome.exe"),
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ];
  return candidates.find((candidate) => fs.existsSync(candidate));
}

const browser = await chromium.launch({
  headless: true,
  executablePath: executablePath(),
});
const page = await browser.newPage({
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
});
await page.addInitScript(() => {
  const hide = () => {
    document.querySelectorAll("nextjs-portal").forEach((node) => node.remove());
  };
  new MutationObserver(hide).observe(document.documentElement, {
    childList: true,
    subtree: true,
  });
});

async function shot(name) {
  await page.waitForTimeout(700);
  await page.evaluate(() => {
    document.querySelectorAll("nextjs-portal").forEach((node) => node.remove());
    for (const node of document.querySelectorAll("button")) {
      const label = node.getAttribute("aria-label") ?? "";
      if (label.includes("Next.js")) node.remove();
    }
  });
  await page.screenshot({
    path: path.join(outDir, name),
    fullPage: true,
  });
}

async function openScreen(buttonName, headingName) {
  const button = page.getByRole("button", { name: buttonName, exact: true }).first();
  const heading = page.getByRole("heading", { level: 1, name: headingName });
  await button.click();
  try {
    await heading.waitFor({ timeout: 4000 });
  } catch {
    await button.click();
    await heading.waitFor();
  }
}

await page.goto("http://localhost:3001/", { waitUntil: "domcontentloaded" });
await page.getByRole("heading", { name: "Klaim di screenshot dibaca sebagai teks." }).waitFor();
await page.waitForTimeout(1500);
await shot("beranda.png");

await openScreen("Verifikasi", "Periksa klaim");
await shot("periksa-klaim.png");

await openScreen("Riwayat", "Riwayat kasus");
await shot("riwayat.png");

await page.getByRole("button", { name: "Buka KS-DEMO-001" }).click();
await page.getByRole("heading", { name: "Hasil pemeriksaan" }).waitFor();
await page.getByText("KS-DEMO-001").first().waitFor();
await shot("hasil-ringkasan.png");

for (const [tab, file] of [
  ["Bukti", "hasil-bukti.png"],
  ["Timeline", "hasil-timeline.png"],
  ["Jejak Publik", "hasil-jejak-publik.png"],
  ["Laporan", "hasil-laporan.png"],
]) {
  await page.getByRole("tab", { name: tab }).click();
  await page.getByRole("tab", { name: tab, selected: true }).waitFor();
  await shot(file);
}

await openScreen("Metodologi", "Metodologi");
await shot("metodologi.png");

await openScreen("Tentang", "Tentang");
await shot("tentang.png");

await browser.close();
console.log("saved", outDir);
