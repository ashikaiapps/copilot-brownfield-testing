import { defineConfig, devices } from "@playwright/test";

const hosted = Boolean(process.env.BASE_URL);

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  failOnFlakyTests: Boolean(process.env.CI),
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 1 : 0,
  reporter: [["list"], ["html", { open: "never" }], ["json", { outputFile: "test-results/results.json" }]],
  use: {
    baseURL: process.env.BASE_URL || "http://127.0.0.1:4173",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: hosted
    ? [{ name: "hosted", testMatch: "hosted.spec.mjs", use: { ...devices["Desktop Chrome"] } }]
    : [
        { name: "desktop", testMatch: "presentation.spec.mjs", use: { ...devices["Desktop Chrome"] } },
        { name: "mobile", testMatch: "presentation.spec.mjs", use: { ...devices["Pixel 7"] } },
      ],
  webServer: hosted
    ? undefined
    : {
        command: "npm start",
        url: "http://127.0.0.1:4173",
        reuseExistingServer: !process.env.CI,
      },
});
