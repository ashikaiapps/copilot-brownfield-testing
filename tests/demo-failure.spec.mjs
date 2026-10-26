import { test, expect } from "@playwright/test";

test("DEMO-01: intentional heading regression is caught by the approved assertion", async ({ page }) => {
  const heading = page.getByRole("heading", { level: 1 });
  await test.step("Verify the correct baseline", async () => {
    await page.goto("/");
    await expect(heading).toHaveText("From legacy code to release confidence");
  });
  await test.step("Inject a regression into this test browser only", async () => {
    await heading.evaluate(element => {
      element.textContent = "Release confidence unavailable";
    });
  });
  await test.step("Enforce the unchanged expectation: this step intentionally fails", async () => {
    await expect(heading, "DEMO-01: the deliberately regressed heading must fail this check")
      .toHaveText("From legacy code to release confidence");
  });
});
