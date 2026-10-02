import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("Portugal's Public Holidays show by default and each device can hide them", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/month/2026-12?day=2026-12-01");
  await expect(page.getByTestId("holiday-2026-12-25")).toHaveText("Christmas Day");
  await page.goto("/week/2026-04-20");
  await expect(page.getByTestId("holiday-2026-04-25")).toBeVisible();

  await page.getByLabel("Person filter").first().click();
  await page
    .getByRole("group", { name: "Person filter" })
    .getByRole("checkbox", { name: "Show Public Holidays" })
    .uncheck();
  await expect(page.getByTestId("holiday-2026-04-25")).toHaveCount(0);
  await page
    .getByRole("group", { name: "Person filter" })
    .getByRole("checkbox", { name: "Show Public Holidays" })
    .check();
  await expect(page.getByTestId("holiday-2026-04-25")).toBeVisible();
});

test("the Family adds and removes holiday countries in Settings", async ({ page }) => {
  await signIn(page);
  await page.goto("/settings");
  await expect(page.getByRole("button", { name: "Remove Portugal" })).toBeVisible();
  await page.getByLabel("Country").selectOption("ES");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await expect(page.getByRole("button", { name: "Remove Spain" })).toBeVisible();

  await page.goto("/month/2026-10?day=2026-10-12");
  await expect(page.getByTestId("holiday-2026-10-12")).toBeVisible();

  await page.goto("/settings");
  await page.getByRole("button", { name: "Remove Spain" }).click();
  await expect(page.getByRole("button", { name: "Remove Spain" })).toHaveCount(0);
});
