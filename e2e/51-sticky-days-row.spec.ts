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

test("on a phone the year's names column keeps its width and the switch its place in both modes", async ({
  page,
}) => {
  await signIn(page);
  const measure = async () => {
    const each = page.getByRole("button", { name: "A line for each person" });
    const day = page.getByTestId("days-row").locator("th").nth(1);
    return [(await each.boundingBox())?.x ?? 0, (await day.boundingBox())?.x ?? 0];
  };
  await page.goto("/year/2026");
  await expect(page.getByTestId("year-detail")).toBeVisible();
  const detail = await measure();
  await page.getByRole("button", { name: "A line for each person" }).click();
  await expect(page.getByTestId("year-detail")).toHaveCount(0);
  expect(await measure()).toEqual(detail);
  // The same month names in both.
  await expect(page.getByTestId("year-month-2")).toHaveText("February");
});

test("at the end of a view one more scroll down hides the days row, and the first one up shows it", async ({
  page,
}) => {
  await page.setViewportSize({ width: 762, height: 346 });
  await signIn(page);
  for (const path of ["/month/2026-10", "/year/2026"]) {
    await page.goto(path);
    const row = page.getByTestId("days-row");
    await expect(row).toBeVisible();
    await page.mouse.move(380, 250);
    // Down to the end (the year grows as its Entries arrive): the row stays while there is still
    // somewhere to go.
    await page.waitForLoadState("networkidle");
    const atBottom = `(() => { const el = document.querySelector("nav[data-view-nav]").parentElement;
      return el.scrollTop + el.clientHeight >= el.scrollHeight - 1; })()`;
    await expect
      .poll(async () => {
        await scrollPage(page, 5000);
        return page.evaluate(atBottom);
      })
      .toBe(true);
    await expect(row).toBeVisible();
    // The view may still be settling (the year draws its Entries late), so the swipe is tried again.
    await expect(async () => {
      await page.mouse.wheel(0, 200);
      await expect(row).toBeHidden({ timeout: 1000 });
    }).toPass();
    // Back up: the row comes back first and the view doesn't move back. (The browser may keep
    // the content in place as the row returns, which scrolls down by its height, never up.)
    const scrolled = () =>
      page.evaluate(`document.querySelector("nav[data-view-nav]").parentElement.scrollTop`);
    const before = (await scrolled()) as number;
    await page.mouse.wheel(0, -200);
    await expect(row).toBeVisible();
    expect(await scrolled()).toBeGreaterThanOrEqual(before - 1);
    // Then the view scrolls back as usual.
    await page.mouse.wheel(0, -200);
    await expect.poll(scrolled).toBeLessThan(before - 1);
  }
});
