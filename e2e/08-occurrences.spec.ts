import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("edit one Occurrence, then delete this and the following", async ({ page }) => {
  await signIn(page);
  await page.goto("/week/2026-10-12");
  const tuesday = page.getByTestId("day-column-2026-10-13").getByTestId("entry");
  await tuesday.click();
  await expect(page).toHaveURL(/occurrence=2026-10-13/);
  await page.getByLabel("Time", { exact: true }).selectOption("17");
  await page.getByLabel("Time: minutes", { exact: true }).selectOption("00");
  await page.getByRole("button", { name: "Save" }).click();
  await page.getByRole("button", { name: "This Occurrence only" }).click();

  await expect(page).toHaveURL(/\/week\/2026-10-12$/);
  await expect(tuesday).toContainText("17:00");
  const thursday = page.getByTestId("day-column-2026-10-15").getByTestId("entry");
  await expect(thursday).toContainText("18:00");

  await thursday.click();
  await page.getByRole("button", { name: "Delete entry" }).click();
  await page.getByRole("button", { name: "This and the following" }).click();
  await expect(page).toHaveURL(/\/week\/2026-10-12$/);
  await expect(thursday).toHaveCount(0);
  await expect(tuesday).toContainText("17:00");
  await page.goto("/week/2026-10-19");
  await expect(page.getByTestId("day-column-2026-10-20").getByTestId("entry")).toHaveCount(0);
});
