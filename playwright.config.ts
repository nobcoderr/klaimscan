import fs from "node:fs";
import path from "node:path";
import { chromium, defineConfig, devices } from "@playwright/test";

function resolveBrowserLaunchConfig() {
  const defaultPath = chromium.executablePath();
  if (fs.existsSync(defaultPath)) {
    return {};
  }

  const localAppData = process.env.LOCALAPPDATA || "";
  const fallbackPaths = [
    path.join(
      localAppData,
      "ms-playwright",
      "chromium-1243",
      "chrome-win64",
      "chrome.exe"
    ),
    "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
    "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  ];

  for (const candidate of fallbackPaths) {
    if (candidate && fs.existsSync(candidate)) {
      return { executablePath: candidate };
    }
  }

  return {};
}

const hasBuild = fs.existsSync(path.join(process.cwd(), ".next", "BUILD_ID"));

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:3000",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        launchOptions: resolveBrowserLaunchConfig(),
      },
    },
  ],
  webServer: {
    command: hasBuild
      ? "pnpm.cmd exec next start --port 3000"
      : "pnpm.cmd exec next dev --webpack --port 3000",
    url: "http://127.0.0.1:3000",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
