import { test, expect } from "@playwright/test";

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
  const version = await request.get("version.json");
  expect(version.ok()).toBeTruthy();
  expect(process.env.EXPECTED_SHA, "Hosted checks require EXPECTED_SHA").toBeTruthy();
  expect((await version.json()).sha).toBe(process.env.EXPECTED_SHA);
  expect(errors).toEqual([]);
});
