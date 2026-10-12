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

  // The year opens in Detail; the compact grid is behind the Detail toggle.
  await page.goto("/year/2026");
  await expect(page.getByTestId("year-detail")).toBeVisible();
  await page.getByRole("link", { name: "Detail" }).click();
  await expect(page).toHaveURL(/\/year\/2026\?detail=0$/);
  await expect(page.getByTestId("year-day-2026-12-24")).toHaveAttribute("data-high", "true");
  await expect(
    page.getByTestId("year-day-2026-11-04").getByTestId("year-entry").first(),
  ).toBeVisible();
  // A day opens over the year, without leaving it.
  await page.getByTestId("year-day-2026-12-24").click();
  await expect(page).toHaveURL(/\/year\/2026\?detail=0&day=2026-12-24$/);
  await expect(page.getByRole("dialog")).toContainText("Christmas Eve dinner");
  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();
  await expect(page).toHaveURL(/\/year\/2026\?detail=0$/);
  // The arrows keep the compact grid, but the year opened afresh is in Detail again.
  await page.getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL(/\/year\/2027\?detail=0$/);
  await page.goto("/year/2026");
  await expect(page.getByTestId("year-detail")).toBeVisible();
  await expect(page.getByRole("link", { name: "Detail" })).toHaveAttribute("aria-pressed", "true");
});

test("Detail shows a line per Person and one for the Family in each month", async ({ page }) => {
  await signIn(page);
  await page.goto("/year/2026");
  await expect(page.getByRole("link", { name: "Detail" })).toHaveAttribute("aria-pressed", "true");
  const detail = page.getByTestId("year-detail");
  await expect(detail).toBeVisible();
  // Christmas Eve dinner is for no Person in particular, so it sits on the Family line.
  await expect(detail.getByTestId("year-cell-2026-12-24-family")).toBeVisible();
  await expect(detail.getByTestId("year-line-12-family")).toContainText("Family");
  // The same 37 Saturday-to-Sunday columns as the year grid.
  await expect(detail.getByTestId("year-line-12-family").locator("td")).toHaveCount(37);
  await detail.getByTestId("year-cell-2026-12-24-family").click();
  await expect(page).toHaveURL(/\/year\/2026\?day=2026-12-24$/);
  await expect(page.getByRole("dialog")).toContainText("Christmas Eve dinner");

  await page.goto("/year/2026?detail=0");
  await expect(page.getByTestId("year-detail")).toHaveCount(0);
  await page.getByRole("link", { name: "Detail" }).click();
  await expect(page).toHaveURL(/\/year\/2026$/);
  await expect(page.getByTestId("year-detail")).toBeVisible();
});
