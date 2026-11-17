import { expect, test } from "@playwright/test";
import { lisbonDate, signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("the week finds free time and plans an Entry in it", async ({ page }) => {
  await signIn(page);
  await page.goto(`/week/${lisbonDate(7)}`);
  await expect(page.getByTestId("view-title")).toBeVisible();
  const button = page.getByRole("button", { name: "Find free time" });
  // On a narrow bar the view's options fold into a menu.
  if (!(await button.isVisible())) await page.getByTestId("view-options").click();
  await button.click();
  const dialog = page.getByRole("dialog", { name: "Find free time" });
  await dialog.getByRole("button", { name: "2 hours" }).click();
  const slot = dialog.getByTestId("free-slots").getByRole("button").first();
  await expect(slot).toBeVisible();
  await expect(slot).toHaveText(/^\d\d:\d\d–\d\d:\d\d$/);
  await slot.click();
  await expect(page).toHaveURL(/\/entries\/new$/);
});
