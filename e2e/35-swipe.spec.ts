import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon", hasTouch: true });

/** A quick sideways finger swipe across the middle of the page. */
async function swipe(page: Page, direction: "left" | "right") {
  const [from, to] = direction === "left" ? [300, 100] : [100, 300];
  // As a string: the e2e code is type-checked without the browser's types.
  await page.evaluate(`(() => {
    const target = document.body;
    const touch = (x) => new Touch({ identifier: 1, target, clientX: x, clientY: 300 });
    const fire = (type, touches, changed) =>
      target.dispatchEvent(new TouchEvent(type, { touches, changedTouches: changed, bubbles: true }));
    fire("touchstart", [touch(${from})], [touch(${from})]);
    fire("touchend", [], [touch(${to})]);
  })()`);
}

test("swiping left and right moves to the next and previous period", async ({ page }) => {
  await signIn(page);
  await page.goto("/week/2026-10-12");
  await expect(page.getByRole("link", { name: "Next" })).toBeVisible();
  // Each swipe waits for the page to show its week, as a finger would.
  const next = page.getByRole("link", { name: "Next" });
  await swipe(page, "left");
  await expect(page).toHaveURL(/\/week\/2026-10-19$/);
  await expect(next).toHaveAttribute("href", "/week/2026-10-26");
  await swipe(page, "right");
  await expect(page).toHaveURL(/\/week\/2026-10-12$/);
  await expect(next).toHaveAttribute("href", "/week/2026-10-19");
  await swipe(page, "right");
  await expect(page).toHaveURL(/\/week\/2026-10-05$/);

  await page.goto("/month/2026-10");
  await expect(page.getByRole("link", { name: "Next" })).toBeVisible();
  await swipe(page, "left");
  await expect(page).toHaveURL(/\/month\/2026-11$/);
});

/**
 * A quick sideways swipe that begins on the year's sideways-scrolling grid. `scrollDuring`
 * moves the grid while the finger is down, as the finger's own scroll would.
 */
async function swipeOnYear(
  page: Page,
  direction: "left" | "right",
  scrollDuring?: "start" | "end",
) {
  const [from, to] = direction === "left" ? [300, 100] : [100, 300];
  const during =
    scrollDuring === "start" ? "0" : scrollDuring === "end" ? "grid.scrollWidth" : "null";
  await page.evaluate(`(() => {
    const grid = document.querySelector('[data-testid="year-detail"]');
    const target = grid.querySelector("table");
    const touch = (x) => new Touch({ identifier: 1, target, clientX: x, clientY: 300 });
    const fire = (type, touches, changed) =>
      target.dispatchEvent(new TouchEvent(type, { touches, changedTouches: changed, bubbles: true }));
    fire("touchstart", [touch(${from})], [touch(${from})]);
    const during = ${during};
    if (during !== null) grid.scrollLeft = during;
    fire("touchend", [], [touch(${to})]);
  })()`);
}

/** Scrolls the year's grid to `left` px from its start ("end" for its far end). */
async function scrollYear(page: Page, left: number | "end") {
  await page.evaluate(`(() => {
    const grid = document.querySelector('[data-testid="year-detail"]');
    grid.scrollLeft = ${left === "end" ? "grid.scrollWidth" : left};
  })()`);
}

test.describe("on a phone", () => {
  test.use({ viewport: { width: 400, height: 800 } });

  test("a new swipe at an end of the year's grid changes the year", async ({ page }) => {
    await signIn(page);
    await page.goto("/year/2026");
    const grid = page.getByTestId("year-detail");
    await expect(grid).toBeVisible();
    // The grid is wider than the phone, so a swipe on it scrolls it rather than change year...
    expect(await grid.evaluate((el) => el.scrollWidth > el.clientWidth)).toBe(true);
    await scrollYear(page, 100);
    await swipeOnYear(page, "left");
    await swipeOnYear(page, "right");
    // ...and a swipe that only brings the grid to its end does not change the year either.
    await swipeOnYear(page, "left", "end");
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/year\/2026$/);

    // Already at the right end, a new swipe left brings the next year.
    await swipeOnYear(page, "left");
    await expect(page).toHaveURL(/\/year\/2027$/);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("2027");

    // A swipe right that brings the grid back to its start stays in the year...
    await scrollYear(page, 100);
    await swipeOnYear(page, "right", "start");
    await page.waitForTimeout(300);
    await expect(page).toHaveURL(/\/year\/2027$/);
    // ...and a new one, at the left end, brings the year before.
    await swipeOnYear(page, "right");
    await expect(page).toHaveURL(/\/year\/2026$/);
  });
});
