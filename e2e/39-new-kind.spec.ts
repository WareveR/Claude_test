import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("one New for Entries and Tasks, picked from the title or by hand", async ({ page }) => {
  await signIn(page);
  await page.goto("/day/2026-12-14");
  await page.getByRole("link", { name: "New", exact: true }).click();
  const kind = page.getByRole("radiogroup", { name: "Entry or task" });
  await expect(kind.getByRole("radio", { name: "Entry" })).toBeChecked();

  // A title that starts with something to do turns the form into a Task on moving on.
  await page.getByLabel("Title").fill("Buy wrapping paper");
  await page.getByLabel("Title").press("Tab");
  await expect(page).toHaveURL(/\/tasks\/new/);
  await expect(kind.getByRole("radio", { name: "Task" })).toBeChecked();
  await expect(page.getByLabel("Title")).toHaveValue("Buy wrapping paper");
  await expect(page.getByLabel("Due date (optional)")).toHaveValue("2026-12-14");
  await page.getByLabel("Notes").fill("The red one");

  // Picked by hand it goes back to an Entry, keeping what was filled in, and stays one.
  await kind.getByText("Entry", { exact: true }).click();
  await expect(page).toHaveURL(/\/entries\/new/);
  await expect(page.getByLabel("Title")).toHaveValue("Buy wrapping paper");
  await expect(page.getByLabel("Notes")).toHaveValue("The red one");
  await expect(page.getByLabel("Date", { exact: true })).toHaveValue("2026-12-14");
  await page.getByLabel("Title").press("Tab");
  await expect(page).toHaveURL(/\/entries\/new/);
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByTestId("day-column-2026-12-14").getByTestId("entry")).toContainText(
    "Buy wrapping paper",
  );

  // An existing one turns into the other kind, keeping what both have.
  page.on("dialog", (dialog) => void dialog.accept());
  await page.getByTestId("day-column-2026-12-14").getByTestId("entry").click();
  await page.getByRole("dialog").getByRole("link", { name: "Edit" }).click();
  await page.getByRole("button", { name: "Turn into a task" }).click();
  await expect(page).toHaveURL(/\/tasks\/(?!new)[\w-]+$/);
  await expect(page.getByLabel("Title")).toHaveValue("Buy wrapping paper");
  await expect(page.getByLabel("Due date (optional)")).toHaveValue("2026-12-14");
  await page.getByRole("button", { name: "Turn into an entry" }).click();
  await expect(page).toHaveURL(/\/entries\/(?!new)[\w-]+$/);
  await expect(page.getByLabel("Title")).toHaveValue("Buy wrapping paper");
  await expect(page.getByLabel("Notes")).toHaveValue("The red one");
});
