import { defineConfig, devices } from "@playwright/test";
import config from "./playwright.config.mjs";

export default defineConfig({
  ...config,
  retries: 0,
  workers: 1,
  outputDir: "test-results-demo",
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report-demo" }],
    ["json", { outputFile: "test-results-demo/results.json" }],
  ],
  use: { ...config.use, baseURL: "http://127.0.0.1:4173" },
  projects: [{ name: "failure-demo", testMatch: "demo-failure.spec.mjs", use: devices["Desktop Chrome"] }],
  webServer: {
    command: "npm start",
    url: "http://127.0.0.1:4173",
    reuseExistingServer: false,
  },
});
