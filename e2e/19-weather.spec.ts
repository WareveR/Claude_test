import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

async function savePlace(page: import("@playwright/test").Page, query: string, name: string) {
  await page.getByLabel("Town").fill(query);
  await page.getByRole("button", { name: "Search", exact: true }).click();
  await page.getByRole("button", { name: `Save ${name}` }).click();
  await expect(page.getByRole("button", { name: `Remove ${name}` })).toBeVisible();
}

test("without a saved place nothing shows weather", async ({ page }) => {
  await signIn(page);
  await expect(page.getByTestId("header-weather")).toHaveCount(0);
  await expect(page.getByTestId("hourly-strip")).toHaveCount(0);
  await expect(page.getByTestId("sun-band")).toHaveCount(0);
});

test("the first saved place is selected and its weather shows in every view", async ({ page }) => {
  await signIn(page);
  await page.goto("/settings/calendar");
  await savePlace(page, "Lis", "Lisboa");
  await expect(page.getByText("Selected", { exact: true })).toBeVisible();

  await expect(page.getByTestId("header-weather")).toHaveText("20°/10°");

  await page.goto("/");
  await expect(page.getByTestId("hourly-strip")).toBeVisible();
  await expect(page.getByTestId("hour-cell").first()).toContainText("%");
  // Today's sunrise and sunset show without turning the Sun Layer on.
  await expect(page.getByTestId("sun-band")).toContainText(/Sunrise \d\d:\d\d/);
  await expect(page.getByTestId("sun-band")).toContainText(/Daylight \d+ h \d\d/);

  await page.getByRole("link", { name: "Week", exact: true }).click();
  await expect(page.locator('[data-testid^="week-weather-"]').first()).toBeVisible();

  await page.goto("/");
  await page.getByRole("link", { name: "Month", exact: true }).click();
  await expect(page.getByTestId("picked-day").getByRole("button")).toContainText("20°/10°");
});

test("tapping the weather asks before leaving for the forecast site", async ({ page }) => {
  await signIn(page);
  await page.getByTestId("header-weather").click();
  await expect(page.getByRole("dialog")).toContainText("Open the forecast on IPMA?");
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  await page.goto("/settings/calendar");
  await savePlace(page, "Mad", "Madrid");
  await page.getByRole("button", { name: "Use Madrid" }).click();
  await expect(page.getByRole("button", { name: "Use Lisboa" })).toBeVisible();

  await page.goto("/");
  await page.evaluate(
    `window.opened = []; window.open = (url) => { window.opened.push(String(url)); return null; };`,
  );
  await page.getByTestId("header-weather").click();
  await expect(page.getByRole("dialog")).toContainText("Open the forecast on yr.no?");
  await page.getByRole("button", { name: "Open", exact: true }).click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  const opened = await page.evaluate<string[]>("window.opened");
  expect(opened).toHaveLength(1);
  expect(opened[0]).toContain("yr.no");
});

test("removing the places clears the weather", async ({ page }) => {
  await signIn(page);
  await page.goto("/settings/calendar");
  await page.getByRole("button", { name: "Remove Madrid" }).click();
  await expect(page.getByRole("button", { name: "Remove Madrid" })).toHaveCount(0);
  await page.getByRole("button", { name: "Remove Lisboa" }).click();
  await expect(page.getByRole("button", { name: "Remove Lisboa" })).toHaveCount(0);
  await page.goto("/");
  await expect(page.getByTestId("header-weather")).toHaveCount(0);
});
