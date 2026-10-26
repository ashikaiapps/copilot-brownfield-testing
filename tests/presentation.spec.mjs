import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

test("PAGE-01: complete ten-stage tutorial and handout", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Brownfield testing with GitHub Copilot");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("From brownfield application to a trusted automated test suite");
  await expect(page.locator("section[data-stage]")).toHaveCount(10);
  for (let stage = 1; stage <= 10; stage++) {
    const section = page.locator(`section[data-stage="${stage}"]`);
    await expect(section.getByRole("heading", { level: 3 })).toContainText(`Step ${stage}.`);
    await expect(section).toContainText("Intent:");
    await expect(section).toContainText("Expected output:");
    await expect(section).toContainText("Review gate:");
    await expect(section.locator("pre code")).toHaveCount(1);
  }
  const handout = await request.get("/playbook.md");
  expect(handout.ok()).toBeTruthy();
  expect(await handout.text()).toBe(await readFile(new URL("../playbook.md", import.meta.url), "utf8"));
});

test("PAGE-02: third-party references and explicit limitations", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("link", { name: "morluto/rea - Reverse Engineer Anything", exact: true })).toHaveAttribute("href", "https://github.com/morluto/rea");
  await expect(page.getByRole("link", { name: "petrkindlmann/qa-skills - QA Skills for AI Agents", exact: true })).toHaveAttribute("href", "https://github.com/petrkindlmann/qa-skills");
  await expect(page.getByText("REA is a third-party project", { exact: false })).toBeVisible();
  await expect(page.getByText("Installing individual skills does not install", { exact: false })).toBeVisible();
  await expect(page.getByText("This is not 100% application coverage.", { exact: false })).toBeVisible();
});

test("PAGE-03: navigation reaches every stage and anchors exist", async ({ page }) => {
  await page.goto("/");
  const links = page.getByRole("navigation", { name: "Tutorial stages" }).getByRole("link");
  for (let stage = 1; stage <= 10; stage++) {
    await links.nth(stage - 1).click();
    await expect(page).toHaveURL(new RegExp(`#stage-${stage}$`));
    await expect(page.locator(`#stage-${stage}`)).toBeInViewport();
  }
  const invalid = await page.locator('a[href^="#"]').evaluateAll(anchors =>
    anchors.map(anchor => anchor.getAttribute("href").slice(1)).filter(id => !document.getElementById(id)),
  );
  expect(invalid).toEqual([]);
});

test("PAGE-04: copy writes the exact prompt to the real clipboard", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/");
  const prompt = page.locator('section[data-stage="1"] pre code');
  const expected = await prompt.textContent();
  const section = page.locator('section[data-stage="1"]');
  await section.getByRole("button", { name: /Copy text block/ }).click();
  await expect(section.getByRole("status")).toContainText("Copied text block");
  const clipboard = await page.evaluate(() => navigator.clipboard.readText());
  // Windows converts clipboard newlines to CRLF; prompt content must remain unchanged.
  expect(clipboard.replaceAll("\r\n", "\n")).toBe(expected);
});

test("PAGE-05: denied clipboard access provides explicit recovery", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new DOMException("Denied", "NotAllowedError")) },
    });
  });
  await page.goto("/");
  const section = page.locator('section[data-stage="1"]');
  await section.getByRole("button", { name: /Copy text block/ }).click();
  await expect(section.getByRole("status")).toHaveText("Copy failed. Select and copy the text manually.");
  await expect(section.locator("pre code")).toBeVisible();
});

test("PAGE-06: keyboard skip link and semantic basics", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: () => Promise.reject(new DOMException("Denied", "NotAllowedError")) },
    });
  });
  await page.goto("/");
  await page.keyboard.press("Tab");
  await expect(page.getByRole("link", { name: "Skip to content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.getByRole("main")).toHaveCount(1);
  await expect(page.getByRole("button", { name: "Copy text block 1", exact: true })).toBeEnabled();
  const button = page.getByRole("button", { name: "Copy text block 1", exact: true });
  await button.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status").first()).toHaveText("Copy failed. Select and copy the text manually.");
});

test("PAGE-07: responsive layout, explicit and system themes, print", async ({ page }) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/?clawpilotTheme=light");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.goto("/?clawpilotTheme=dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 800 });
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
  }
  await page.emulateMedia({ media: "print" });
  await expect(page.getByRole("navigation", { name: "Presentation navigation" })).toBeHidden();
  await expect(page.getByRole("button").first()).toBeHidden();
  await expect(page.locator("#stage-10")).toBeVisible();
});

test("PAGE-08: no browser errors, failed requests, or missing local resources", async ({ page, request }) => {
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  page.on("console", message => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("requestfailed", failed => errors.push(failed.url()));
  const response = await page.goto("/");
  expect(response.status()).toBe(200);
  const localLinks = await page.locator('a[href]:not([href^="#"]):not([href^="https:"])').evaluateAll(
    links => [...new Set(links.map(link => link.getAttribute("href")))],
  );
  for (const link of localLinks) {
    const result = await request.get(link);
    expect(result.ok(), link).toBeTruthy();
  }
  await expect(page.getByRole("heading", { name: "12. References and community resources" })).toBeVisible();
  expect(errors).toEqual([]);
});
