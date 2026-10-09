import { expect, test } from "@playwright/test";
import { openToEdit, signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

/** A date some days from today on Lisbon's wall clock, as the app's date fields want it. */
function lisbonDate(days: number) {
  const date = new Date(Date.now() + days * 86_400_000);
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Lisbon" }).format(date);
}

async function addTask(page: import("@playwright/test").Page, title: string, due?: string) {
  await page.goto("/tasks");
  await page.getByRole("link", { name: "New task" }).click();
  await page.getByLabel("Title").fill(title);
  if (due) await page.getByLabel("Due date (optional)").fill(due);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/tasks$/);
}

test("the Tasks view groups Tasks and ticks them done", async ({ page }) => {
  await signIn(page);
  await addTask(page, "Renew the passport", lisbonDate(-2));
  await addTask(page, "Buy school books", lisbonDate(3));
  await addTask(page, "Fix the bike");

  await expect(page.getByRole("region", { name: "Overdue" })).toContainText("Renew the passport");
  await expect(page.getByRole("region", { name: "Upcoming" })).toContainText("Buy school books");
  await expect(page.getByRole("region", { name: "No date" })).toContainText("Fix the bike");

  // A ticked Task leaves its group at once, so its box is clicked rather than checked.
  await page.getByRole("checkbox", { name: "Done: Fix the bike" }).click();
  await expect(page.getByRole("region", { name: "No date" })).toHaveCount(0);
  await page.getByLabel(/Show done/).check();
  const done = page.getByRole("region", { name: "Done" });
  await expect(done.getByText("Fix the bike")).toHaveClass(/line-through/);

  await expect(done.getByRole("checkbox", { name: "Done: Fix the bike" })).toBeChecked();
  await done.getByRole("checkbox", { name: "Done: Fix the bike" }).click();
  await expect(page.getByRole("region", { name: "No date" })).toContainText("Fix the bike");

  await openToEdit(page, page.getByRole("link", { name: /Buy school books/ }));
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Delete task" }).click();
  await expect(page).toHaveURL(/\/tasks$/);
  await expect(page.getByText("Buy school books")).toHaveCount(0);
});

test("ticking a repeating Task brings up the next one", async ({ page }) => {
  await signIn(page);
  await page.goto("/tasks");
  await page.getByRole("link", { name: "New task" }).click();
  await page.getByLabel("Title").fill("Water the plants");
  await page.getByLabel("Due date (optional)").fill(lisbonDate(-3));
  await page.getByLabel("Repeats").selectOption("weekly");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/tasks$/);

  await page.getByRole("checkbox", { name: "Done: Water the plants" }).click();
  // The next one is due on the first weekly date after today, so it is not overdue.
  await expect(page.getByRole("region", { name: "Upcoming" })).toContainText("Water the plants");
  await expect(page.getByRole("region", { name: "Overdue" })).not.toContainText("Water the plants");
});
