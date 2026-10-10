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

test("on a phone the header stays one line, Suggestions included", async ({ page }) => {
  await signIn(page);
  await page.goto("/suggestions");
  const header = page.locator("header").first();
  await expect(header.getByTestId("header-date")).toBeVisible();
  const box = await header.boundingBox();
  expect(box?.height).toBeLessThan(64);
});

test("on a phone the wall shows all seven days without scrolling sideways", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Wall", exact: true }).click();
  const days = page.getByTestId("wall-days");
  await expect(days).toBeVisible();
  // The seventh day's column ends inside the screen.
  const lastDay = days.locator("[data-drop-date]").nth(6);
  const box = await lastDay.boundingBox();
  expect((box?.x ?? 999) + (box?.width ?? 0)).toBeLessThanOrEqual(361);
  expect(await page.evaluate("document.documentElement.scrollWidth")).toBeLessThanOrEqual(360);
  await page.getByRole("button", { name: "Leave wall view" }).click();
});
