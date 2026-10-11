import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("the Agenda lists Entries and Tasks day by day, in time order", async ({ page }) => {
  await signIn(page);
  await page.goto("/entries/new?date=2027-05-10&time=18:00");
  await page.getByLabel("Title").fill("School play");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).not.toHaveURL(/\/entries\//);

  await page.goto("/tasks");
  await page.getByRole("link", { name: "New task" }).click();
  await page.getByLabel("Title").fill("Buy flowers");
  await page.getByLabel("Due date (optional)").fill("2027-05-10");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/tasks$/);

  await page.goto("/month/2027-05");
  await page.getByRole("link", { name: "Agenda" }).click();
  await expect(page).toHaveURL(/\/agenda\/2027-05-01$/);
  const day = page.getByTestId("agenda-day-2027-05-10");
  await expect(day).toContainText("Monday 10 May");
  // The Task without a time comes before the 18:00 Entry.
  await expect(day.locator("li").first()).toContainText("Buy flowers");
  await expect(day.locator("li").nth(1)).toContainText("School play");
  // Days with nothing are left out.
  await expect(page.getByTestId("agenda-day-2027-05-11")).toHaveCount(0);

  await page.getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL(/\/agenda\/2027-05-31$/);
});
