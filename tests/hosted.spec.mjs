import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { createHash } from "node:crypto";

test("HOST-01: deployed content and revision match the tested commit", async ({ page, request }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  const response = await page.goto("./");
  expect(response.status()).toBe(200);
  await expect(page).toHaveTitle(/Brownfield testing with GitHub Copilot/);
  await expect(page.locator("section[data-stage]")).toHaveCount(10);
  await expect(page.locator("#tools")).toHaveText("13. Choosing the right test tools: Playwright, Cypress, Mocha, and Chai");
  await expect(page.locator("#azure")).toHaveText("14. Azure at scale: Playwright Workspaces and Azure Load Testing");
  await expect(page.getByText("Azure Load Testing does not directly ingest ordinary Playwright specs.", { exact: false })).toBeVisible();
  await page.getByRole("navigation", { name: "Presentation navigation" })
    .getByRole("link", { name: "Testing agent", exact: true }).click();
  await expect(page.locator("#agent")).toBeInViewport();
  const downloadLink = page.getByRole("link", { name: "Download Brownfield Testing Agent", exact: true });
  await expect(downloadLink).toBeVisible();
  await expect(downloadLink).toHaveAttribute("href", "downloads/brownfield-testing.agent.md");
  await expect(downloadLink).toHaveAttribute("download", "brownfield-testing.agent.md");
  const download = await request.get("downloads/brownfield-testing.agent.md");
  expect(download.status()).toBe(200);
  const bytes = await download.body();
  expect(bytes).toEqual(await readFile(new URL("../.github/agents/brownfield-testing.agent.md", import.meta.url)));
  expect(createHash("sha256").update(bytes).digest("hex"))
    .toBe("6dad9f89feef256594fbee12d5c243df7fa18a42f5aae36878f14725bfe4dbae");
  const version = await request.get("version.json");
  expect(version.ok()).toBeTruthy();
  expect(process.env.EXPECTED_SHA, "Hosted checks require EXPECTED_SHA").toBeTruthy();
  expect((await version.json()).sha).toBe(process.env.EXPECTED_SHA);
  expect(errors).toEqual([]);
});
