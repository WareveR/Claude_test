import { expect, test, type Locator, type Page } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

/** One hour's height in the time grid. */
const HOUR_PX = 44;

async function centre(locator: Locator) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

/** Presses on one spot and drags to another with the mouse, in small steps, then lets go. */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 10, from.y + 5, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 10 });
}

async function newEntry(page: Page, date: string, time: string, title: string) {
  await page.goto(`/entries/new?date=${date}&time=${time}`);
  await page.getByLabel("Title").fill(title);
}

test("an Entry dragged in the week view moves to another day and time", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1600 });
  await signIn(page);
  await newEntry(page, "2027-03-02", "10:00", "Dentist");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).not.toHaveURL(/\/entries\//);

  await page.goto("/week/2027-03-01");
  const dentist = page.getByTestId("day-column-2027-03-02").getByTestId("entry");
  await expect(dentist).toContainText("10:00");
  const from = await centre(dentist);
  const thursday = await centre(page.getByTestId("day-column-2027-03-04"));
  await drag(page, from, { x: thursday.x, y: from.y + 2 * HOUR_PX });
  await expect(page.getByTestId("drop-preview")).toBeVisible();
  await expect(page.getByTestId("drag-ghost")).toContainText("12:00");
  // The moved Entry shows at once; wait for the save before leaving the page.
  const savedWeek = page.waitForResponse((r) => r.request().method() === "PUT" && r.ok());
  await page.mouse.up();
  await savedWeek;

  const moved = page.getByTestId("day-column-2027-03-04").getByTestId("entry");
  await expect(moved).toContainText("Dentist");
  await expect(moved).toContainText("12:00");
  await expect(dentist).toHaveCount(0);
  // Letting go did not open the Entry.
  await expect(page).toHaveURL(/\/week\/2027-03-01$/);

  // In the month view a drag changes the day and keeps the time.
  await page.goto("/month/2027-03");
  const line = page.getByTestId("month-day-2027-03-04").getByText("Dentist");
  await drag(page, await centre(line), await centre(page.getByTestId("month-day-2027-03-09")));
  const saved = page.waitForResponse((r) => r.request().method() === "PUT" && r.ok());
  await page.mouse.up();
  await saved;
  await expect(page.getByTestId("month-day-2027-03-09")).toContainText("Dentist");
  await expect(page.getByTestId("month-day-2027-03-04")).not.toContainText("Dentist");
  await page.goto("/week/2027-03-08");
  await expect(page.getByTestId("day-column-2027-03-09").getByTestId("entry")).toContainText(
    "12:00",
  );
});

test("a repeating Entry dragged asks which Occurrences move", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 1600 });
  await signIn(page);
  await newEntry(page, "2027-03-15", "17:00", "Swimming");
  await page.getByLabel("Repeats").selectOption("weekly");
  await page.getByLabel("Ends").selectOption("count");
  await page.getByLabel("Number of times").fill("3");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).not.toHaveURL(/\/entries\//);

  await page.goto("/week/2027-03-15");
  const monday = page.getByTestId("day-column-2027-03-15").getByTestId("entry");
  const from = await centre(monday);
  const tuesday = await centre(page.getByTestId("day-column-2027-03-16"));
  await drag(page, from, { x: tuesday.x, y: from.y });
  await page.mouse.up();
  const savedOne = page.waitForResponse((r) => r.request().method() === "PUT" && r.ok());
  await page.getByRole("button", { name: "This Occurrence only" }).click();
  await savedOne;

  await expect(page.getByTestId("day-column-2027-03-16").getByTestId("entry")).toContainText(
    "Swimming",
  );
  await expect(monday).toHaveCount(0);
  await page.goto("/week/2027-03-22");
  await expect(page.getByTestId("day-column-2027-03-22").getByTestId("entry")).toContainText(
    "Swimming",
  );
});
