import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

async function addEntry(page: Page, date: string, title: string, notes: string) {
  await page.goto(`/entries/new?date=${date}`);
  await page.getByLabel("Title").fill(title);
  await page.getByLabel("Notes").fill(notes);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).not.toHaveURL(/\/entries\//);
}

test("Search finds Entries and Tasks by any word, exact text and exclusions", async ({ page }) => {
  await signIn(page);
  await addEntry(page, "2027-06-02", "Orthodontist check-up", "Bring the health card");
  await addEntry(page, "2027-06-20", "Orthodontist cleaning", "Cancelled by the clinic");
  await addEntry(page, "2027-07-01", "Reunião de orçamento", "Na escola");
  await page.goto("/tasks");
  await page.getByRole("link", { name: "New task" }).click();
  await page.getByLabel("Title").fill("Buy floss for the orthodontist");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/tasks$/);

  await page.goto("/month/2027-06");
  await page.getByRole("link", { name: "Search" }).click();
  await expect(page).toHaveURL(/\/search$/);
  const box = page.getByLabel("Search for");
  const results = page.getByTestId("search-result");

  await box.fill("orthodontist");
  await expect(results).toHaveCount(3);
  await expect(page).toHaveURL(/q=orthodontist/);

  await box.fill("orthodontist -cancelled");
  await expect(results).toHaveCount(2);

  await box.fill('"health card"');
  await expect(results).toHaveCount(1);
  await expect(results.first()).toContainText("Orthodontist check-up");
  await expect(results.first().locator("mark")).toHaveText("health card");

  // Case and accents don't matter.
  await box.fill("ORCAMENTO");
  await expect(results).toHaveCount(1);
  await expect(results.first()).toContainText("Reunião de orçamento");

  await box.fill("orthodontist");
  await page.getByLabel("What").selectOption("tasks");
  await expect(results).toHaveCount(1);
  await expect(results.first()).toContainText("Buy floss");

  await page.getByLabel("What").selectOption("entries");
  await page.getByLabel("When").selectOption("custom");
  await page.getByLabel("From").fill("2027-06-10");
  await expect(results).toHaveCount(1);
  await expect(results.first()).toContainText("Orthodontist cleaning");

  // A result opens in a popup first.
  await results.first().click();
  await expect(page.getByRole("dialog", { name: "Orthodontist cleaning" })).toBeVisible();
  await page.getByRole("dialog").getByRole("link", { name: "Edit" }).click();
  await expect(page).toHaveURL(/\/entries\//);
});
