import { expect } from "@playwright/test";
import { readFile } from "node:fs/promises";

export async function verifyAgentDownload(page, testInfo, activate) {
  const downloading = page.waitForEvent("download");
  await activate();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe("brownfield-testing.agent.md");
  expect(await download.failure()).toBeNull();
  const saved = testInfo.outputPath("brownfield-testing.agent.md");
  await download.saveAs(saved);
  const bytes = await readFile(saved);
  // Packaging preserves canonical LF UTF-8 bytes; do not normalize away delivery changes.
  expect(bytes).toEqual(await readFile(new URL("../.github/agents/brownfield-testing.agent.md", import.meta.url)));
  const profile = bytes.toString("utf8");
  expect(profile).not.toMatch(/^\s*(?:<!doctype html|<html\b|404(?:\s|$))/i);
  expect(profile).toMatch(/^---\nname: brownfield-testing\ndescription: Evidence-backed discovery,[^\n]+\n---\n/);
  expect(profile).toContain("# Brownfield Testing Agent\n\nVersion: 1.0.1\n");
  expect(profile).toContain("Default discovery is read-only.");
  expect(profile).toContain("Tool restrictions and approval denials must not be bypassed.");
  expect(profile).toContain("No provisioning, cloud identity changes, load execution");
}
