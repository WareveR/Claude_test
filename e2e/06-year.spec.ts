import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("the year view fills High days and dots the others", async ({ page }) => {
  await signIn(page);
  await page.goto("/entries/new?date=2026-12-24");
  await page.getByLabel("Title").fill("Christmas Eve dinner");
  await page.getByLabel("Importance").selectOption("high");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).not.toHaveURL(/\/entries\//);

  await page.goto("/year/2026");
  await expect(page.getByTestId("year-day-2026-12-24")).toHaveAttribute("data-high", "true");
  await expect(page.getByTestId("year-day-2026-11-04").getByTestId("year-dot")).toBeVisible();
  await page.getByTestId("year-day-2026-12-24").click();
  await expect(page).toHaveURL(/\/month\/2026-12\?day=2026-12-24$/);
});
