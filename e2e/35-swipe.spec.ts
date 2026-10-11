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
