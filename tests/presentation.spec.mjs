import { test, expect } from "@playwright/test";
import { copyFile, mkdir, readFile, readdir, unlink } from "node:fs/promises";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const agentSource = new URL("../.github/agents/brownfield-testing.agent.md", import.meta.url);
const agentSha256 = "bd45430850561dd59a71a482314ff54451dbb1c983983d42b13b6966b8e8c61e";

test("PAGE-01: complete ten-stage tutorial and handout", async ({ page, request }) => {
  await page.goto("/");
  await expect(page).toHaveTitle("Brownfield testing with GitHub Copilot");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("From legacy code to release confidence");
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

test("PAGE-09: bookmarked stage survives a page reload", async ({ page }) => {
  await page.goto("/#stage-8");
  await expect(page.locator("#stage-8")).toBeInViewport();
  await page.reload();
  await expect(page).toHaveURL(/#stage-8$/);
  await expect(page.locator("#stage-8")).toBeInViewport();
  await expect(page.locator('section[data-stage="8"] pre code')).toContainText("Implement Playwright coverage");
});

test("PAGE-10: chapter navigation and back-to-top reach their destinations", async ({ page }) => {
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "Presentation navigation" });
  for (const [label, target] of [
    ["Overview", "overview"], ["10 stages", "tutorial"], ["Coverage", "coverage"],
    ["Skills", "skills"], ["Demo & CI", "demo"], ["Test tools", "tools"],
    ["Azure at scale", "azure"], ["Testing agent", "agent"], ["References", "references"],
  ]) {
    await navigation.getByRole("link", { name: label, exact: true }).click();
    await expect(page.locator(`#${target}`)).toBeInViewport();
  }
  await page.getByRole("link", { name: "back to top", exact: true }).click();
  await expect(page.getByRole("main")).toBeFocused();
  await expect(page.getByRole("heading", { level: 1 })).toBeInViewport();
});

test.describe("Progressive enhancement", () => {
  test.use({ javaScriptEnabled: false });

  test("PAGE-11: tutorial and navigation remain usable without JavaScript", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("From legacy code to release confidence");
    await expect(page.locator("section[data-stage]")).toHaveCount(10);
    await expect(page.locator('section[data-stage="10"] pre code')).toContainText("Integrate the accepted test suite");
    await expect(page.getByRole("button")).toHaveCount(0);
    await page.getByRole("navigation", { name: "Tutorial stages" }).getByRole("link", { name: "7. Explore", exact: true }).click();
    await expect(page.locator("#stage-7")).toBeInViewport();
    await expect(page.getByRole("link", { name: "Markdown handout" })).toHaveAttribute("href", "playbook.md");
  });
});

test("PAGE-12: headings and accessible stage labels are unique and ordered", async ({ page }) => {
  await page.goto("/");
  const ids = await page.locator("[id]").evaluateAll(elements => elements.map(element => element.id));
  expect(ids.every(Boolean)).toBeTruthy();
  expect(new Set(ids).size).toBe(ids.length);
  const levels = await page.locator("h1, h2, h3, h4, h5, h6").evaluateAll(
    headings => headings.map(heading => Number(heading.tagName.slice(1))),
  );
  expect(levels[0]).toBe(1);
  for (let index = 1; index < levels.length; index++) {
    expect(levels[index]).toBeLessThanOrEqual(levels[index - 1] + 1);
  }
  for (let stage = 1; stage <= 10; stage++) {
    await expect(page.locator(`section[data-stage="${stage}"]`)).toHaveAccessibleName(new RegExp(`^Step ${stage}\\.`));
  }
});

test("PAGE-13: every code sample has a uniquely named copy control and live feedback", async ({ page }) => {
  await page.goto("/");
  const samples = page.locator("pre code");
  const buttons = page.getByRole("button", { name: /^Copy text block \d+$/ });
  await expect(buttons).toHaveCount(await samples.count());
  const controls = await page.locator("pre").evaluateAll(blocks => blocks.map(block => {
    const tools = block.previousElementSibling;
    return {
      label: tools?.querySelector("button")?.getAttribute("aria-label"),
      status: tools?.querySelector('[role="status"]') !== null,
    };
  }));
  expect(controls.every(control => control.status && control.label)).toBeTruthy();
  expect(new Set(controls.map(control => control.label)).size).toBe(controls.length);
});

test("PAGE-14: copy can recover after a transient clipboard failure", async ({ page }) => {
  await page.addInitScript(() => {
    let attempts = 0;
    Object.defineProperty(navigator, "clipboard", {
      value: {
        writeText: async () => {
          if (attempts++ === 0) throw new DOMException("Temporary denial", "NotAllowedError");
        },
      },
    });
  });
  await page.goto("/");
  const section = page.locator('section[data-stage="1"]');
  const button = section.getByRole("button");
  const label = await button.getAttribute("aria-label");
  expect(label).toMatch(/^Copy text block \d+$/);
  await button.click();
  await expect(section.getByRole("status")).toHaveText("Copy failed. Select and copy the text manually.");
  await button.click();
  await expect(section.getByRole("status")).toHaveText(label.replace(/^Copy/, "Copied") + ".");
  await expect(button).toBeEnabled();
});

test("PAGE-15: every displayed code sample preserves the handout text", async ({ page }) => {
  const source = (await readFile(new URL("../playbook.md", import.meta.url), "utf8")).replaceAll("\r\n", "\n");
  const expected = [...source.matchAll(/^```[a-z]+\n([\s\S]*?)^```/gm)].map(match => match[1]);
  expect(expected.length).toBeGreaterThanOrEqual(10);
  await page.goto("/");
  const actual = await page.locator("pre code").allTextContents();
  expect(actual).toEqual(expected);
});

test("PAGE-16: customer-facing content replaces internal presentation notes", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("From legacy code to release confidence");
  await expect(page.getByRole("heading", { name: "1. Build confidence before generating tests", exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "11. Release-readiness checklist", exact: true })).toBeVisible();
  const content = await page.getByRole("main").innerText();
  for (const phrase of [
    "Yes, an existing application", "Recommended presentation title", "Speaker note:",
    "Suggested speaker lines", "Important wording for the presentation", "corrections to the initial approach",
    "Demonstration plan for an audience", "What the audience should notice",
  ]) {
    expect(content).not.toContain(phrase);
  }
});

test("PAGE-17: delivery and intentional-failure evidence are clearly separated", async ({ page }) => {
  await page.goto("/#demo");
  const passing = page.getByRole("link", { name: "View delivery runs", exact: true });
  const failing = page.getByRole("link", { name: "View intentional failure demo", exact: true });
  await expect(passing).toHaveAttribute("href", "https://github.com/ashikaiapps/copilot-brownfield-testing/actions/workflows/site.yml");
  await expect(failing).toHaveAttribute("href", "https://github.com/ashikaiapps/copilot-brownfield-testing/actions/workflows/failure-demo.yml");
  await expect(page.getByText("exactly one failed test", { exact: false })).toBeVisible();
  await expect(page.getByText("It has no deployment permissions", { exact: false })).toBeVisible();
  await expect(page.getByText("DEMO-01 first verifies", { exact: false })).toBeVisible();
});

test("PAGE-18: reference tables are keyboard-scrollable on narrow screens", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/#agenda");
  const table = page.getByRole("region", { name: "Scrollable reference table", exact: true }).filter({
    has: page.getByRole("columnheader", { name: "Session", exact: true }),
  });
  await table.focus();
  await expect(table).toBeFocused();
  expect(await table.evaluate(element => element.scrollWidth > element.clientWidth)).toBeTruthy();
  await page.keyboard.press("ArrowRight");
  await expect.poll(() => table.evaluate(element => element.scrollLeft)).toBeGreaterThan(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test("PAGE-19: tool comparison separates runners, drivers, assertions, and instrumentation", async ({ page }) => {
  await page.goto("/#tools");
  await expect(page.locator("#tools")).toHaveText("13. Choosing the right test tools: Playwright, Cypress, Mocha, and Chai");
  await expect(page.locator("#tools")).toBeInViewport();
  for (const phrase of [
    "Cypress bundles Mocha and Chai internally.",
    "Mocha does not drive browsers or supply built-in assertions.",
    "Chai is an assertion library, not a test runner or browser driver.",
    "Browser automation does not require code-coverage counters.",
    "Playwright's JavaScript/CSS Coverage API is Chromium-only.",
    "The plugin does not instrument the application automatically.",
  ]) {
    await expect(page.getByText(phrase, { exact: false })).toBeVisible();
  }
  for (const [name, url] of [
    ["Playwright Coverage API: Chromium only", "https://playwright.dev/docs/api/class-coverage"],
    ["Cypress bundled libraries: Mocha and Chai", "https://docs.cypress.io/app/references/bundled-libraries"],
    ["Mocha documentation", "https://mochajs.org/"],
    ["Chai documentation", "https://www.chaijs.com/"],
  ]) {
    await expect(page.getByRole("link", { name, exact: true })).toHaveAttribute("href", url);
  }
  const selection = page.locator("pre").filter({ hasText: "Assess test tooling for [CAPABILITY]" });
  await expect(selection).toContainText("Do not install dependencies, migrate suites, instrument builds");
  await expect(selection.locator("xpath=preceding-sibling::*[1]").getByRole("button")).toHaveAccessibleName(/^Copy text block \d+$/);
});

test("PAGE-20: Azure guidance distinguishes cloud browsers from authorized protocol load", async ({ page }) => {
  await page.goto("/#azure");
  await expect(page.locator("#azure")).toHaveText("14. Azure at scale: Playwright Workspaces and Azure Load Testing");
  await expect(page.locator("#azure")).toBeInViewport();
  await expect(page.getByText("Azure Load Testing does not directly ingest ordinary Playwright specs.", { exact: false })).toBeVisible();
  await expect(page.getByText("Apache JMeter and Locust", { exact: false })).toBeVisible();
  await expect(page.getByText("Twenty Playwright workers are not a model of twenty production virtual users.", { exact: true })).toBeVisible();
  await expect(page.getByText("Budget alerts are notifications, not a hard cost cutoff", { exact: false })).toBeVisible();
  await expect(page.getByText("It does not configure or run Azure tests", { exact: false })).toBeVisible();
  for (const [name, url] of [
    ["official Azure Load Testing overview", "https://learn.microsoft.com/en-us/azure/app-testing/load-testing/overview-what-is-azure-load-testing"],
    ["official Workspaces quickstart", "https://learn.microsoft.com/en-us/azure/app-testing/playwright-workspaces/quickstart-run-end-to-end-tests"],
    ["Edge/Chrome recording extension", "https://learn.microsoft.com/en-us/azure/app-testing/load-testing/quickstart-create-run-load-tests-from-recording"],
    ["official Azure Load Testing CI/CD guide", "https://learn.microsoft.com/en-us/azure/app-testing/load-testing/how-to-configure-load-test-cicd"],
  ]) {
    await expect(page.getByRole("link", { name, exact: true })).toHaveAttribute("href", url);
  }
  const cloudPrompt = page.locator("pre").filter({ hasText: "Assess whether our approved Playwright suite" });
  await expect(cloudPrompt).toContainText("without explicit approval.");
  const loadPrompt = page.locator("pre").filter({ hasText: "Use approved [SCENARIO_ID], its contracts" });
  await expect(loadPrompt).toContainText("Never load-test this presentation's Pages site.");
});

test("PAGE-21: canonical agent has valid manual-invocation metadata and approved safety/workflow content", async () => {
  const bytes = await readFile(agentSource);
  const profile = bytes.toString("utf8");
  expect(profile.length).toBeLessThan(30000);
  expect(profile).not.toContain("\r");
  expect(profile.charCodeAt(0)).not.toBe(0xfeff);
  expect(profile.endsWith("\n")).toBeTruthy();
  expect(createHash("sha256").update(bytes).digest("hex")).toBe(agentSha256);
  const header = profile.match(/^---\n([\s\S]*?)\n---\n/);
  expect(header, "Agent requires YAML frontmatter").not.toBeNull();
  const fields = Object.fromEntries(header[1].split("\n").map(line => {
    expect(line).toMatch(/^[a-z-]+: \S.+$/);
    const colon = line.indexOf(": ");
    return [line.slice(0, colon), line.slice(colon + 2)];
  }));
  expect(fields).toEqual({
    name: "brownfield-testing",
    description: expect.stringContaining("Evidence-backed discovery, risk-based test planning"),
    "disable-model-invocation": "true",
    "user-invocable": "true",
  });
  expect(fields.description.length).toBeGreaterThan(50);
  expect(profile.match(/^## \d+\./gm)).toHaveLength(11);
  for (const obligation of [
    "Version: 1.0.0",
    "Default discovery is read-only.",
    "Tool restrictions and approval denials must not be bypassed.",
    "Do not generate acceptance assertions for disputed rules.",
    "Do not weaken assertions, hide errors",
    "Browser contexts isolate browser state, not shared server-side data.",
    "Do not commit, push, publish artifacts",
    "do not claim direct ingestion of ordinary Playwright specs.",
    "No provisioning, cloud identity changes, load execution",
    "not a tool installer, a security boundary",
    "scenario_id, rule_ids, persona, priority",
    "https://github.com/morluto/rea",
    "https://github.com/petrkindlmann/qa-skills",
  ]) {
    expect(profile).toContain(obligation);
  }
});

test("PAGE-22: agent navigation, safe installation guidance, and real download preserve canonical bytes", async ({ page, request }, testInfo) => {
  await page.goto("/");
  await page.getByRole("navigation", { name: "Presentation navigation" })
    .getByRole("link", { name: "Testing agent", exact: true }).click();
  await expect(page).toHaveURL(/#agent$/);
  await expect(page.locator("#agent")).toBeInViewport();
  const link = page.getByRole("link", { name: "Download Brownfield Testing Agent", exact: true });
  await expect(link).toBeVisible();
  await expect(link).toHaveAttribute("href", "downloads/brownfield-testing.agent.md");
  await expect(link).toHaveAttribute("download", "brownfield-testing.agent.md");
  await expect(page.getByText("~/.copilot/agents/brownfield-testing.agent.md", { exact: true })).toBeVisible();
  await expect(page.getByText("$HOME\\.copilot\\agents\\brownfield-testing.agent.md", { exact: true })).toBeVisible();
  await expect(page.getByText("Downloading the file does not install dependencies", { exact: false })).toBeVisible();
  await expect(page.getByText("restart or reload an existing session if needed", { exact: false })).toBeVisible();
  const starter = page.locator("pre").filter({ hasText: "Assess [AUTHORIZED_REPOSITORY_OR_COMPONENT]" });
  await expect(starter).toContainText("Start with discovery only.");
  await expect(starter).toContainText("until separately approved.");
  await expect(starter.locator("xpath=preceding-sibling::*[1]").getByRole("button"))
    .toHaveAccessibleName(/^Copy text block \d+$/);
  const canonical = await readFile(agentSource);
  const response = await request.get("downloads/brownfield-testing.agent.md");
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("text/markdown");
  expect(await response.body()).toEqual(canonical);
  expect((await request.get(".github/agents/brownfield-testing.agent.md")).status()).toBe(404);
  const downloading = page.waitForEvent("download");
  await link.click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("brownfield-testing.agent.md");
  expect(await download.failure()).toBeNull();
  const saved = testInfo.outputPath("brownfield-testing.agent.md");
  await download.saveAs(saved);
  expect(await readFile(saved)).toEqual(canonical);
  await page.setViewportSize({ width: 320, height: 800 });
  await expect(link).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBeTruthy();
});

test("PAGE-23: packaging allowlists exact public files and fails on missing canonical input", async ({}, testInfo) => {
  const fixture = testInfo.outputPath("package-input");
  const agentDirectory = join(fixture, ".github", "agents");
  await mkdir(agentDirectory, { recursive: true });
  const copiedAgent = join(agentDirectory, "brownfield-testing.agent.md");
  await copyFile(agentSource, copiedAgent);
  for (const file of ["index.html", "playbook.md"]) {
    await copyFile(new URL("../" + file, import.meta.url), join(fixture, file));
  }
  const packager = fileURLToPath(new URL("../package-site.mjs", import.meta.url));
  const revision = "0".repeat(40);
  const run = () => spawnSync(process.execPath, [packager], {
    cwd: fixture, env: { ...process.env, REVISION: revision }, encoding: "utf8",
  });
  const packaged = run();
  expect(packaged.error).toBeUndefined();
  expect(packaged.status, packaged.stderr).toBe(0);
  const site = join(fixture, "_site");
  expect((await readdir(site)).sort()).toEqual(["downloads", "index.html", "playbook.md", "version.json"]);
  expect(await readdir(join(site, "downloads"))).toEqual(["brownfield-testing.agent.md"]);
  expect(await readFile(join(site, "downloads", "brownfield-testing.agent.md"))).toEqual(await readFile(agentSource));
  for (const file of ["index.html", "playbook.md"]) {
    expect(await readFile(join(site, file))).toEqual(await readFile(new URL("../" + file, import.meta.url)));
  }
  expect(JSON.parse(await readFile(join(site, "version.json"), "utf8"))).toEqual({ sha: revision });
  const reused = run();
  expect(reused.status).not.toBe(0);
  expect(reused.stderr).toContain("EEXIST");
  await unlink(copiedAgent);
  const missing = run();
  expect(missing.status).not.toBe(0);
  expect(missing.stderr).toContain("ENOENT");
  expect(missing.stderr).toContain("brownfield-testing.agent.md");
});
