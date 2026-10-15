import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon", viewport: { width: 360, height: 780 } });

/** Scrolls the page's scroller (the box the views scroll in) down by `by` px. */
async function scrollPage(page: Page, by: number) {
  await page.evaluate(`(() => {
    let el = document.querySelector("nav[data-view-nav]").parentElement;
    while (el && getComputedStyle(el).overflowY !== "auto") el = el.parentElement;
    el.scrollBy(0, ${by});
  })()`);
}

/** The days row's top and the options bar's bottom, in px from the top of the screen. */
async function rowUnderNav(page: Page) {
  const nav = await page.locator("nav[data-view-nav]").boundingBox();
  const row = await page.getByTestId("days-row").boundingBox();
  return { navBottom: (nav?.y ?? 0) + (nav?.height ?? 0), rowTop: row?.y ?? -1 };
}

test("on a phone the month's weekday row stays under the bar while the weeks scroll", async ({
  page,
}) => {
  await signIn(page);
  // A short phone (or a big zoom), where the weeks do not fit and the page scrolls.
  await page.setViewportSize({ width: 360, height: 420 });
  await page.goto("/month/2026-11");
  await expect(page.getByTestId("days-row")).toBeVisible();
  const week = page.getByTestId("month-week-2026-10-26");
  const before = (await week.boundingBox())?.y ?? 0;
  await scrollPage(page, 1000);
  await expect(async () => {
    const { navBottom, rowTop } = await rowUnderNav(page);
    expect(Math.abs(rowTop - navBottom)).toBeLessThan(2);
  }).toPass();
  // The weeks moved up under it.
  const row = await page.getByTestId("days-row").boundingBox();
  const after = (await week.boundingBox())?.y ?? 999;
  expect(after).toBeLessThan(before - 10);
  expect(after).toBeLessThan((row?.y ?? 0) + (row?.height ?? 0));
});

test("on a phone the year's weekday letters stay under the bar and scroll sideways with the days", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/year/2026");
  const grid = page.getByTestId("year-detail");
  await expect(grid).toBeVisible();
  await scrollPage(page, 400);
  await expect(async () => {
    const { navBottom, rowTop } = await rowUnderNav(page);
    expect(Math.abs(rowTop - navBottom)).toBeLessThan(2);
  }).toPass();
  await grid.evaluate((el) => el.scrollTo({ left: 150 }));
  await expect.poll(() => page.getByTestId("days-row").evaluate((el) => el.scrollLeft)).toBe(150);
});

test("on a phone the year's months and Persons stay at the left while the days scroll sideways", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/year/2026");
  const grid = page.getByTestId("year-detail");
  await expect(grid).toBeVisible();
  const month = grid.getByTestId("year-month-3");
  const person = grid.locator('[data-testid^="year-line-3-"] th').first();
  const left = (await month.boundingBox())?.x ?? 0;
  await grid.evaluate((el) => el.scrollTo({ left: 300 }));
  await expect.poll(async () => (await month.boundingBox())?.x).toBeCloseTo(left, 0);
  expect((await person.boundingBox())?.x ?? 0).toBeCloseTo(left, -1);
  // The switch over them stays too.
  const each = page.getByRole("button", { name: "A line for each person" });
  expect((await each.boundingBox())?.x ?? 0).toBeLessThan(left + 64);
});
