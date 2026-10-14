import { expect, test, type Locator, type Page } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

/** Today on Lisbon's wall clock, as the app's addresses want it. */
function lisbonToday() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(new Date());
}

/** The theme's accent colour, as the browser computes it. */
async function accent(page: Page) {
  // A string, as the specs are typed without the DOM.
  return page.evaluate<string>(`(() => {
    const probe = document.createElement("div");
    probe.style.color = "var(--accent)";
    document.body.append(probe);
    const color = getComputedStyle(probe).color;
    probe.remove();
    return color;
  })()`);
}

async function expectPill(page: Page, pill: Locator) {
  await expect(pill).toBeVisible();
  await expect(pill).toHaveCSS("background-color", await accent(page));
}

async function expectTint(cell: Locator) {
  await expect(cell).toBeVisible();
  await expect(cell).toHaveCSS("background-image", /gradient/);
}

test("today stands out in every view", async ({ page }) => {
  await signIn(page);
  const today = lisbonToday();
  // Something today, so the Agenda has a heading for it.
  await page.goto("/tasks");
  await page.getByRole("link", { name: "New task" }).click();
  await page.getByLabel("Title").fill("Today's errand");
  await page.getByLabel("Due date (optional)").fill(today);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/tasks$/);

  // Day: the date in a pill over a tinted column.
  await page.goto(`/day/${today}`);
  await expectPill(page, page.getByTestId("day-title"));
  await expectTint(page.getByTestId(`day-column-${today}`));

  // Week: only today's column is tinted, its day number in a pill.
  await page.goto(`/week/${today}`);
  await expectTint(page.getByTestId(`day-column-${today}`));
  await expect(page.locator("[data-testid^=day-column-][data-today]")).toHaveCount(1);
  await expectPill(page, page.locator(`[data-drop-date="${today}"] .rounded-full:visible`).first());

  // Month: the cell tinted, its number in a pill; picking it says it is today.
  await page.goto(`/month/${today.slice(0, 7)}`);
  const cell = page.getByTestId(`month-day-${today}`);
  await expectTint(cell);
  await expect(cell).toHaveAttribute("data-today", "true");
  await expectPill(page, cell.locator(".rounded-full").first());
  await cell.click();
  await expectPill(page, page.getByTestId("day-popup-today"));
  await page.keyboard.press("Escape");

  // Year, in Detail and in the compact grid.
  await page.goto(`/year/${today.slice(0, 4)}`);
  const head = page.getByTestId("year-detail-today");
  await expectTint(head);
  await expectPill(page, head.locator("span"));
  await page.goto(`/year/${today.slice(0, 4)}?detail=0`);
  const yearDay = page.getByTestId(`year-day-${today}`);
  await expect(yearDay).toHaveAttribute("data-today", "true");
  await expectPill(page, yearDay.locator("span").first());

  // Agenda: today's heading with an accent bar and a "Today" pill.
  await page.goto(`/agenda/${today}`);
  const day = page.getByTestId(`agenda-day-${today}`);
  await expect(day).toHaveAttribute("data-today", "true");
  await expect(day.locator("h2")).toHaveCSS("border-left-color", await accent(page));
  await expectPill(page, day.getByTestId("agenda-today"));

  // The Wall's grid starts today, tinted as in the week.
  await page.getByRole("banner").getByRole("button", { name: "Wall" }).click();
  await expect(page).toHaveURL(/\/display$/);
  await expectTint(page.getByTestId("display-board").getByTestId(`day-column-${today}`));
});
