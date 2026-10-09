import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon", viewport: { width: 360, height: 780 } });

test("on a phone no view is wider than the screen", async ({ page }) => {
  await signIn(page);
  // With weather (25-display-mode saved a place): its hourly strip and day badges are the
  // widest things on a page.
  await expect(page.getByTestId("header-weather")).toBeVisible();

  await page.goto("/");
  for (const view of ["Day", "Week", "Month", "Year", "Tasks"]) {
    await page.getByRole("link", { name: view, exact: true }).click();
    await page.waitForLoadState("networkidle");
    const sideways = await page.evaluate(
      "(() => { window.scrollTo(1000, 0); const x = window.scrollX; window.scrollTo(0, 0); return x; })()",
    );
    expect(sideways, `${view} scrolls sideways`).toBe(0);
  }
});
