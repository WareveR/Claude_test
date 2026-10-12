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

  await page.goto("/summary");
  await expect(page.getByTestId("hourly-strip")).toBeVisible();
  await expect(page.getByTestId("hour-cell").first()).toContainText("%");
  await expect(page.getByTestId("hour-cell").first()).toContainText(/\d+h/);
  // Today's sunrise and sunset show without turning the Sun Layer on.
  await expect(page.getByTestId("sun-band")).toContainText(/Sunrise \d\d:\d\d/);
  await expect(page.getByTestId("sun-band")).toContainText(/Daylight \d+ h \d\d/);
  // The sun sits on its arc between the two.
  await expect(page.getByTestId("sun-band").getByTestId("sun-dot")).toHaveCount(1);

  await page.goto("/");
  await page.getByRole("link", { name: "Week", exact: true }).click();
  // The week shows each day's chance of rain too.
  await expect(page.locator('[data-testid^="week-weather-"]').nth(1)).toContainText("%");
  // The corner button hides the weather for more hours, remembered on this device.
  await page.getByRole("button", { name: "Hide weather" }).click();
  await expect(page.locator('[data-testid^="week-weather-"]')).toHaveCount(0);
  await page.reload();
  await expect(page.getByRole("button", { name: "Show weather" })).toBeVisible();
  await expect(page.locator('[data-testid^="week-weather-"]')).toHaveCount(0);
  await page.getByRole("button", { name: "Show weather" }).click();
  await expect(page.locator('[data-testid^="week-weather-"]').nth(1)).toContainText("%");

  // A past day keeps the last weather read for it, and its hours.
  const yesterday = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(
    new Date(Date.now() - 86_400_000),
  );
  await page.goto(`/day/${yesterday}`);
  await expect(page.locator("nav").getByText("15°/8°")).toBeVisible();
  // Its hours only when asked for, remembered on this device.
  await expect(page.getByTestId("hourly-strip")).toHaveCount(0);
  await page.getByRole("button", { name: "Show the weather by the hour" }).click();
  await expect(page.getByTestId("hourly-strip")).toContainText("9°");

  // Today has its weather too: highest and lowest, rain and wind, without UV or humidity.
  await page.goto("/");
  const today = page.getByTestId("day-weather");
  await expect(today).toContainText("20°/10°");
  await expect(today).toContainText("km/h");
  await expect(today).not.toContainText("UV");
  await expect(today).not.toContainText("70%");
  await expect(page.getByTestId("hourly-strip")).toContainText("%");
  await page.getByRole("button", { name: "Hide the weather by the hour" }).click();
  await expect(page.getByTestId("hourly-strip")).toHaveCount(0);

  await page.goto("/");
  await page.getByRole("link", { name: "Month", exact: true }).click();
  await page.locator('[aria-current="date"]').click();
  await expect(page.getByTestId("picked-day").getByRole("button").first()).toContainText("20°/10°");
});

test("on a phone the Day view's hour by hour detail shows sunrise and sunset when its switch is on", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await signIn(page);
  // A day past the forecast's reach: the times are worked out, not read from the forecast.
  const later = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
  await page.goto(`/day/${later}`);
  await expect(page.getByTestId("sun-times")).toHaveCount(0);
  // They live in the hour by hour detail, not beside the title.
  await page.getByTestId("day-hours").click();
  await page.getByLabel("Person filter").first().click();
  await page
    .getByRole("group", { name: "Person filter" })
    .getByRole("switch", { name: "Sunrise and sunset (Day view)" })
    .check();
  await page.keyboard.press("Escape");
  const sun = page.getByTestId("sun-times");
  await expect(sun).toBeVisible();
  await expect(sun).toContainText(/Sunrise \d\d:\d\d, Sunset \d\d:\d\d/);
  // Today and a day gone by show them too, left of the hours.
  await page.goto("/");
  await expect(page.getByTestId("hourly-strip").getByTestId("sun-times")).toBeVisible();
  const before = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
  await page.goto(`/day/${before}`);
  await expect(page.getByTestId("sun-times")).toBeVisible();
  // Hiding the hours hides them too; the switch is kept on this device, so put it back.
  await page.getByTestId("day-hours").click();
  await expect(page.getByTestId("sun-times")).toHaveCount(0);
});

test("tapping the weather asks before leaving for the forecast site", async ({ page }) => {
  await signIn(page);
  await page.getByTestId("header-weather").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Open the forecast on IPMA?");
  // The weather in detail: now, the Sun and Moon, the next hours and days.
  await expect(dialog.getByRole("heading", { name: "Lisboa" })).toBeVisible();
  await expect(dialog.getByTestId("forecast-now")).toContainText("17°");
  await expect(dialog.getByTestId("forecast-now")).toContainText("Feels like 16°");
  await expect(dialog.getByTestId("forecast-now")).toContainText("72%");
  await expect(dialog.getByTestId("forecast-now")).toContainText("18 km/h");
  await expect(dialog.getByTestId("forecast-sky")).toContainText(/Sunrise \d\d:\d\d/);
  await expect(dialog.getByTestId("forecast-moon")).toContainText(/% lit/);
  await expect(dialog.getByTestId("forecast-hour").first()).toContainText(/\d+h/);
  await expect(dialog.getByTestId("forecast-hour").first()).toContainText("12km/h");
  await expect(dialog.getByTestId("forecast-day").first()).toContainText("Today");
  await expect(dialog.getByTestId("forecast-day").nth(1)).toContainText("21°");
  // One row like the hours: tomorrow sits beside today, and the dialog never slides sideways.
  const today = await dialog.getByTestId("forecast-day").first().boundingBox();
  const tomorrow = await dialog.getByTestId("forecast-day").nth(1).boundingBox();
  expect(tomorrow!.y).toBe(today!.y);
  expect(tomorrow!.x).toBeGreaterThan(today!.x);
  const box = await dialog.boundingBox();
  expect(today!.x).toBeGreaterThanOrEqual(box!.x);
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await page.getByTestId("header-weather").click();
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
