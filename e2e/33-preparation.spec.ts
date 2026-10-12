import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("an Entry holds the Checklists and Tasks that prepare for it", async ({ page }) => {
  await signIn(page);
  await page.goto("/week/2026-11-02");
  await page.getByRole("link", { name: "New", exact: true }).click();
  await page.getByLabel("Title").fill("Birthday party");
  await page.getByLabel("Type", { exact: true }).selectOption({ label: "Appointment" });
  await page.getByLabel("Date", { exact: true }).fill("2026-11-07");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).not.toHaveURL(/\/entries\/new/);
  await page.getByTestId("day-column-2026-11-07").getByTestId("entry").click();

  // The summary only reads: with nothing linked it shows no preparation; the form links things.
  await expect(page.getByTestId("entry-summary")).toBeVisible();
  await expect(page.getByTestId("preparation")).toHaveCount(0);
  await page.getByRole("link", { name: "Edit" }).click();
  const preparation = page.getByTestId("preparation");
  await expect(preparation).toContainText("Nothing linked yet");
  // A new Checklist from the Entry is named after it and due on its day.
  await preparation.getByRole("link", { name: "New task with items" }).click();
  await expect(page.getByLabel("Name")).toHaveValue("Birthday party");
  await expect(page.getByLabel("Ends (optional)")).toHaveValue("2026-11-07");
  await expect(page.getByTestId("linked-entry")).toContainText("For: Birthday party");
  await page.getByRole("button", { name: "Save" }).click();
  const detail = page.getByTestId("checklist-detail");
  await detail.getByLabel("New item").fill("Cake");
  await detail.getByRole("button", { name: "Add", exact: true }).click();
  await expect(detail.getByTestId("checklist-item")).toHaveCount(1);

  await page.goto("/week/2026-11-02");
  await page.getByTestId("day-column-2026-11-07").getByTestId("entry").click();
  await page.getByRole("link", { name: "Edit" }).click();
  await preparation.getByRole("link", { name: "New task", exact: true }).click();
  await expect(page.getByTestId("linked-entry")).toContainText("For: Birthday party");
  await page.getByLabel("Title").fill("Book the hall");
  await page.getByRole("button", { name: "Save" }).click();
  // Saved before leaving; going straight to another page can cut the save short.
  await expect(page).not.toHaveURL(/\/tasks\/new/);

  await page.goto("/week/2026-11-02");
  await page.getByTestId("day-column-2026-11-07").getByTestId("entry").click();
  // The summary lists what is linked, with nothing to tick.
  await expect(preparation.getByRole("link", { name: /Birthday party/ })).toContainText("0 of 1");
  await expect(preparation.getByText("Book the hall")).toBeVisible();
  await expect(preparation.getByRole("checkbox")).toHaveCount(0);
  await page.getByRole("link", { name: "Edit" }).click();
  await preparation.getByRole("checkbox", { name: "Done: Book the hall" }).check();
  await expect(preparation.getByRole("checkbox", { name: "Done: Book the hall" })).toBeChecked();
  await page.screenshot({ path: "test-results/entry-preparation.png", fullPage: true });
});
