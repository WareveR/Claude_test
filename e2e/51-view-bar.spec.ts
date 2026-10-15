import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";
test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });
test("on a wide screen the views bar shows every view and option", async ({ page }) => {
  await signIn(page);
  await page.goto("/week/2026-10-12");
  await expect(page.getByTestId("weather-toggle")).toBeVisible();
  await expect(page.getByTestId("views-menu")).toHaveCount(0);
  await expect(page.getByTestId("view-options")).toHaveCount(0);
});
