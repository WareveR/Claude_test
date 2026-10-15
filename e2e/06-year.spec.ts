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

  // The year opens with a line for each person; switched off, the whole Family's grid.
  await page.goto("/year/2026");
  await expect(page.getByTestId("year-detail")).toBeVisible();
  await page.getByRole("button", { name: "A line for each person" }).click();
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
  // The arrows keep the Family's grid, but the year opened afresh has each person's lines again.
  await page.getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL(/\/year\/2027\?detail=0$/);
  await page.goto("/year/2026");
  await expect(page.getByTestId("year-detail")).toBeVisible();
  await expect(page.getByRole("button", { name: "A line for each person" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

test("Detail shows a line per Person and one for the Family in each month", async ({ page }) => {
  await signIn(page);
  await page.goto("/year/2026");
  await expect(page.getByRole("button", { name: "A line for each person" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
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

  await page.getByRole("dialog").getByRole("button", { name: "Close" }).click();

  // A day with nothing on opens too, and offers to go to the day.
  await detail.getByTestId("year-detail-day-2026-12-23").click();
  await expect(page).toHaveURL(/\/year\/2026\?day=2026-12-23$/);
  await expect(page.getByRole("dialog")).toContainText("Nothing on this day.");
  await page.getByRole("dialog").getByRole("link", { name: "Open the day" }).click();
  await expect(page).toHaveURL(/\/day\/2026-12-23$/);

  // A month's name opens the month.
  await page.goto("/year/2026");
  await page.getByTestId("year-month-12").click();
  await expect(page).toHaveURL(/\/month\/2026-12$/);

  await page.goto("/year/2026?detail=0");
  await expect(page.getByTestId("year-detail")).toHaveCount(0);
  const each = page.getByRole("button", { name: "A line for each person" });
  await expect(each).toHaveAttribute("aria-pressed", "false");
  await each.click();
  await expect(page).toHaveURL(/\/year\/2026$/);
  await expect(page.getByTestId("year-detail")).toBeVisible();
});
