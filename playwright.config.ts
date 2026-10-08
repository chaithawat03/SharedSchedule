import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

if (existsSync(".env.local")) process.loadEnvFile(".env.local");
const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (
  testDatabaseUrl &&
  !new URL(testDatabaseUrl).pathname.toLowerCase().includes("test")
) {
  throw new Error("TEST_DATABASE_URL must name a dedicated test database");
}

const baseURL = "http://127.0.0.1:3101";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: { baseURL, trace: "retain-on-failure" },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "chromium-mobile-320",
      use: { ...devices["Pixel 5"], viewport: { width: 320, height: 700 } },
    },
    {
      name: "chromium-mobile-390",
      use: { ...devices["Pixel 5"], viewport: { width: 390, height: 844 } },
    },
    {
      name: "webkit-mobile",
      use: { ...devices["iPhone 13"], viewport: { width: 375, height: 812 } },
    },
    {
      name: "chromium-tablet",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 768, height: 900 },
      },
    },
  ],
  webServer: testDatabaseUrl
    ? {
        command: "npm run start -- --port 3101",
        url: baseURL,
        reuseExistingServer: false,
        timeout: 120_000,
        env: { DATABASE_URL: testDatabaseUrl },
      }
    : undefined,
});
