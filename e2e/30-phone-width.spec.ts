import { expect, test } from "@playwright/test";
import { openView, signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon", viewport: { width: 360, height: 780 } });

test("on a phone no view is wider than the screen", async ({ page }) => {
  await signIn(page);
  // With weather (25-display-mode saved a place): its hourly strip and day badges are the
  // widest things on a page.
  await expect(page.getByTestId("header-weather")).toBeVisible();

  await page.goto("/");
  for (const view of ["Day", "Week", "Month", "Year", "Agenda", "Tasks", "Shopping", "Summary"]) {
    if (view === "Summary") await page.goto("/summary");
    else await openView(page, view);
    await page.waitForLoadState("networkidle");
    const sideways = await page.evaluate(
      "(() => { window.scrollTo(1000, 0); const x = window.scrollX; window.scrollTo(0, 0); return x; })()",
    );
    expect(sideways, `${view} scrolls sideways`).toBe(0);
  }
});

test("on a phone the header stays one line, Suggestions included", async ({ page }) => {
  await signIn(page);
  await page.goto("/suggestions");
  const header = page.locator("header").first();
  await expect(header.getByTestId("header-date")).toBeVisible();
  const box = await header.boundingBox();
  expect(box?.height).toBeLessThan(64);
});

test("on a phone the wall shows all seven days without scrolling sideways", async ({ page }) => {
  await signIn(page);
  await page.getByRole("banner").getByRole("button", { name: "Wall" }).click();
  const days = page.getByTestId("wall-days");
  await expect(days).toBeVisible();
  // The seventh day's column ends inside the screen.
  const lastDay = days.locator("[data-drop-date]").nth(6);
  const box = await lastDay.boundingBox();
  expect((box?.x ?? 999) + (box?.width ?? 0)).toBeLessThanOrEqual(361);
  expect(await page.evaluate("document.documentElement.scrollWidth")).toBeLessThanOrEqual(360);
  await page.getByRole("banner").getByRole("button", { name: "Wall" }).click();
});

test("on a phone the month grid fills the free height", async ({ page }) => {
  await signIn(page);
  await page.goto("/month/2026-02");
  const days = page.locator("[data-testid^='month-day-']");
  await expect(days.first()).toBeVisible();
  // The last week's row reaches the bottom of the screen instead of leaving it empty.
  const last = await days.last().boundingBox();
  expect((last?.y ?? 0) + (last?.height ?? 0)).toBeGreaterThan(780 - 8);
  expect(last?.height ?? 0).toBeGreaterThan(64);
});

test("on a phone the week view gives an Entry's title the width, without its time", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/week/2026-03-02");
  const ORIGIN = { Origin: "http://localhost:4173" };
  const types = await (await page.request.get("/api/entry-types")).json();
  const res = await page.request.post("/api/entries", {
    headers: ORIGIN,
    data: {
      title: "Phone week title",
      entryTypeId: types[0].id,
      time: {
        allDay: false,
        startDate: "2026-03-03",
        startTime: "10:00",
        endDate: "2026-03-03",
        endTime: "11:00",
      },
      personIds: [],
      importance: "normal",
      location: "",
      notes: "",
      icon: null,
      private: false,
      reminders: [],
      repetition: null,
      birthYearKnown: false,
      prepare: false,
    },
  });
  expect(res.ok()).toBeTruthy();
  await page.reload();
  const block = page.getByTestId("entry").filter({ hasText: "Phone week title" });
  await expect(block).toBeVisible();
  await expect(block.getByText("10:00")).toBeHidden();
  const created = (await res.json()) as { id: string };
  await page.request.delete(`/api/entries/${created.id}`, { headers: ORIGIN });
});

test("on a phone the views bar stays one line, folding the views and options into menus", async ({
  page,
}) => {
  await signIn(page);
  const nav = page.locator("nav[data-view-nav]");
  for (const path of ["/day/2026-10-15", "/week/2026-10-12", "/month/2026-09", "/year/2026"]) {
    await page.goto(path);
    await expect(page.getByTestId("view-title")).toBeVisible();
    expect((await nav.boundingBox())?.height).toBeLessThan(56);
  }
  // The Filter stays on the bar; the weather and the period's Tasks are one tap away.
  await page.goto("/week/2026-10-12");
  await expect(nav.getByLabel("Person filter").first()).toBeVisible();
  await expect(page.getByTestId("weather-toggle")).toBeHidden();
  await page.getByTestId("view-options").click();
  await expect(page.getByTestId("weather-toggle")).toBeVisible();
  await openView(page, "Month");
  await expect(page).toHaveURL(/\/month\//);
});
