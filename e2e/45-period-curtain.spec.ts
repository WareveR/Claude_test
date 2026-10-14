import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

/** A date `months` months from the first of this month, as "YYYY-MM-DD". */
function monthFromNow(months: number, day: number): string {
  const now = new Date();
  const d = new Date(Date.UTC(now.getFullYear(), now.getMonth() + months, day));
  return d.toISOString().slice(0, 10);
}

async function addEntry(page: Page, date: string, title: string) {
  await page.goto(`/entries/new?date=${date}`);
  await page.getByLabel("Title").fill(title);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).not.toHaveURL(/\/entries\//);
}

/** Moves on with "Next": the curtain names the new period, stays a second, and lifts on its Entries. */
async function nextShowsCurtain(page: Page, label: string) {
  const curtain = page.getByTestId("period-curtain");
  // The view opened afresh may show it while its own Entries come; that one lifts first.
  await expect(curtain).toHaveCount(0);
  await page.getByRole("link", { name: "Next" }).click();
  await expect(curtain).toBeVisible();
  await expect(curtain).toHaveText(label);
  const shown = Date.now();
  await expect(curtain).toHaveCount(0);
  expect(Date.now() - shown).toBeGreaterThanOrEqual(800);
}

test("moving to the next month shows its name while its Entries come", async ({ page }) => {
  await signIn(page);
  const next = monthFromNow(1, 10);
  await addEntry(page, next, "Curtain month check");

  await page.goto(`/month/${monthFromNow(0, 1).slice(0, 7)}`);
  const name = new Intl.DateTimeFormat("en-GB", { month: "long", timeZone: "UTC" }).format(
    new Date(`${next}T00:00:00Z`),
  );
  await nextShowsCurtain(page, `${name} ${next.slice(0, 4)}`);
  await expect(page).toHaveURL(new RegExp(`/month/${next.slice(0, 7)}$`));
  await expect(page.getByTestId(`month-day-${next}`)).toContainText("Curtain month check");
});

test("moving to the next year shows the year while its Entries come", async ({ page }) => {
  await signIn(page);
  const year = new Date().getFullYear() + 1;
  await addEntry(page, `${year}-03-10`, "Curtain year check");

  await page.goto(`/year/${year - 1}?detail=0`);
  await nextShowsCurtain(page, String(year));
  await expect(page).toHaveURL(new RegExp(`/year/${year}\\?detail=0$`));
  await expect(
    page.getByTestId(`year-day-${year}-03-10`).getByTestId("year-entry").first(),
  ).toBeVisible();
});

test("the Wall shows the curtain too, with the season's picture under the Month theme", async ({
  page,
}) => {
  await signIn(page);
  await page.evaluate(() => localStorage.setItem("theme", "month"));
  await page.goto("/");
  await page.getByRole("banner").getByRole("button", { name: "Wall" }).click();
  const board = page.getByTestId("display-board");
  await expect(board).toBeVisible();
  const curtain = page.getByTestId("period-curtain");
  await expect(curtain).toHaveCount(0);

  await board.getByRole("button", { name: "Next" }).click();
  await expect(curtain).toBeVisible();
  await expect(curtain.getByTestId("curtain-season")).toBeAttached();
  // It names the week's days and its year.
  await expect(curtain).toContainText(String(new Date(Date.now() + 7 * 86_400_000).getFullYear()));
  await expect(curtain).toHaveCount(0);

  await page.getByRole("banner").getByRole("button", { name: "Wall" }).click();
  await page.evaluate(() => localStorage.removeItem("theme"));
});
