import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("the year view marks High days and lists the Entries of each day", async ({ page }) => {
  await signIn(page);
  await page.goto("/entries/new?date=2026-12-24");
  await page.getByLabel("Title").fill("Christmas Eve dinner");
  await page.getByLabel("Importance").selectOption("high");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).not.toHaveURL(/\/entries\//);

  await page.goto("/year/2026");
  await expect(page.getByTestId("year-day-2026-12-24")).toHaveAttribute("data-high", "true");
  await expect(
    page.getByTestId("year-day-2026-11-04").getByTestId("year-entry").first(),
  ).toBeVisible();
  await page.getByTestId("year-day-2026-12-24").click();
  await expect(page).toHaveURL(/\/month\/2026-12\?day=2026-12-24$/);
});

test("Detail shows a line per Person and one for the Family in each month", async ({ page }) => {
  await signIn(page);
  await page.goto("/year/2026");
  await page.getByRole("link", { name: "Detail" }).click();
  await expect(page).toHaveURL(/\/year\/2026\?detail=1$/);
  const detail = page.getByTestId("year-detail");
  await expect(detail).toBeVisible();
  // Christmas Eve dinner is for no Person in particular, so it sits on the Family line.
  await expect(detail.getByTestId("year-cell-2026-12-24-family")).toBeVisible();
  await expect(detail.getByTestId("year-line-12-family")).toContainText("Family");
  // The same 37 Saturday-to-Sunday columns as the year grid.
  await expect(detail.getByTestId("year-line-12-family").locator("td")).toHaveCount(37);
  await detail.getByTestId("year-cell-2026-12-24-family").click();
  await expect(page).toHaveURL(/\/month\/2026-12\?day=2026-12-24$/);

  await page.goto("/year/2026?detail=1");
  await page.getByRole("link", { name: "Detail" }).click();
  await expect(page).toHaveURL(/\/year\/2026$/);
  await expect(page.getByTestId("year-detail")).toHaveCount(0);
});
