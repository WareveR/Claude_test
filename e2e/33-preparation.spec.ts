import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("an Entry holds the Checklists and Tasks that prepare for it", async ({ page }) => {
  await signIn(page);
  await page.goto("/week/2026-11-02");
  await page.getByRole("link", { name: "New", exact: true }).click();
  await page.getByLabel("Title").fill("Grandma's visit");
  await page.getByLabel("Type", { exact: true }).selectOption({ label: "General" });
  await page.getByLabel("Date", { exact: true }).fill("2026-11-07");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).not.toHaveURL(/\/entries\/new/);
  // Another spec may put an Entry on the same day (25-display-mode's lands 8 days from today).
  await page
    .getByTestId("day-column-2026-11-07")
    .getByTestId("entry")
    .filter({ hasText: "Grandma's visit" })
    .click();

  // The summary only reads: with nothing linked it shows no preparation; the form links things.
  await expect(page.getByTestId("entry-summary")).toBeVisible();
  await expect(page.getByTestId("preparation")).toHaveCount(0);
  await page.getByRole("link", { name: "Edit" }).click();
  const preparation = page.getByTestId("preparation");
  await expect(preparation).toContainText("Nothing linked yet");
  // A new Checklist from the Entry is named after it and due on its day.
  await preparation.getByRole("link", { name: "New task with items" }).click();
  await expect(page.getByLabel("Name")).toHaveValue("Grandma's visit");
  await expect(page.getByLabel("Ends (optional)")).toHaveValue("2026-11-07");
  await expect(page.getByTestId("linked-entry")).toContainText("For: Grandma's visit");
  await page.getByRole("button", { name: "Save" }).click();
  const detail = page.getByTestId("checklist-detail");
  await detail.getByLabel("New item").fill("Cake");
  await detail.getByRole("button", { name: "Add", exact: true }).click();
  await expect(detail.getByTestId("checklist-item")).toHaveCount(1);

  await page.goto("/week/2026-11-02");
  await page
    .getByTestId("day-column-2026-11-07")
    .getByTestId("entry")
    .filter({ hasText: "Grandma's visit" })
    .click();
  await page.getByRole("link", { name: "Edit" }).click();
  await preparation.getByRole("link", { name: "New task", exact: true }).click();
  await expect(page.getByTestId("linked-entry")).toContainText("For: Grandma's visit");
  await page.getByLabel("Title").fill("Book the hall");
  await page.getByRole("button", { name: "Save" }).click();
  // Saved before leaving; going straight to another page can cut the save short.
  await expect(page).not.toHaveURL(/\/tasks\/new/);

  await page.goto("/week/2026-11-02");
  await page
    .getByTestId("day-column-2026-11-07")
    .getByTestId("entry")
    .filter({ hasText: "Grandma's visit" })
    .click();
  // The summary lists what is linked, with nothing to tick.
  await expect(preparation.getByRole("link", { name: /Grandma's visit/ })).toContainText("0 of 1");
  await expect(preparation.getByText("Book the hall")).toBeVisible();
  await expect(preparation.getByRole("checkbox")).toHaveCount(0);
  await page.getByRole("link", { name: "Edit" }).click();
  await preparation.getByRole("checkbox", { name: "Done: Book the hall" }).check();
  await expect(preparation.getByRole("checkbox", { name: "Done: Book the hall" })).toBeChecked();
  await page.screenshot({ path: "test-results/entry-preparation.png", fullPage: true });
});

test("a new Entry gets the list its title calls for, to read in its summary", async ({ page }) => {
  await signIn(page);
  await page.goto("/week/2026-11-09");
  await page.getByRole("link", { name: "New", exact: true }).click();
  await page.getByLabel("Title").fill("Swimming");
  await page.getByLabel("Date", { exact: true }).fill("2026-11-12");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).not.toHaveURL(/\/entries\/new/);
  // Only the Entry is on the calendar; its list goes with it.
  const day = page.getByTestId("day-column-2026-11-12").getByTestId("entry");
  await expect(day).toHaveCount(1);
  await day.click();
  const preparation = page.getByTestId("preparation");
  await expect(preparation).toContainText("Swimming bag");
  await expect(preparation).toContainText("Goggles");
  await expect(preparation.getByRole("checkbox")).toHaveCount(0);
});
