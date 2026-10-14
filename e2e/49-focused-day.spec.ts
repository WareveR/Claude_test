import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("switching view keeps the day in focus", async ({ page }) => {
  await signIn(page);
  await page.goto("/day/2031-11-19");
  const nav = page.locator("nav[data-view-nav]");
  const view = (name: string) => nav.getByRole("link", { name, exact: true }).click();

  // Out to the month and the week and back: the same day, not the period's first.
  await view("Month");
  await expect(page).toHaveURL(/\/month\/2031-11$/);
  await view("Day");
  await expect(page).toHaveURL(/\/day\/2031-11-19$/);
  await view("Week");
  await expect(page).toHaveURL(/\/week\/2031-11-17$/);
  await view("Day");
  await expect(page).toHaveURL(/\/day\/2031-11-19$/);

  // A day picked in the month is then the one in focus, through the year too.
  await page.goto("/month/2031-12?day=2031-12-08");
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await view("Year");
  await expect(page).toHaveURL(/\/year\/2031/);
  await view("Day");
  await expect(page).toHaveURL(/\/day\/2031-12-08$/);

  // Moved to a month without it, the view opens on that month's first day.
  await view("Month");
  await nav.getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL(/\/month\/2032-01$/);
  await view("Day");
  await expect(page).toHaveURL(/\/day\/2032-01-01$/);
});
