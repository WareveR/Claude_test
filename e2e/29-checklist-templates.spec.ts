import { expect, test, type Page } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

const templatesIn = (page: Page) => page.getByRole("region", { name: "Checklist templates" });

test("a Checklist starts from a built-in template and is saved as a new one", async ({ page }) => {
  await signIn(page);
  await page.goto("/checklists/new");
  await page.getByLabel("Start from").selectOption({ label: "Back to school" });
  await expect(page.getByLabel("Name", { exact: true })).toHaveValue("Back to school");
  await expect(page.getByTestId("template-preview")).toContainText("9 items: Buy the textbooks");
  await page.getByRole("button", { name: "Save" }).click();

  const detail = page.getByTestId("checklist-detail");
  await expect(detail.getByRole("heading", { name: "Back to school" })).toBeVisible();
  await expect(detail).toContainText("0 of 9");
  const items = detail.getByTestId("checklist-item");
  await expect(items.first()).toContainText("Buy the textbooks");
  await expect(items.last()).toContainText("Medical and dental check-up");

  // A blank Checklist of our own becomes a template too.
  await page.goto("/checklists/new");
  await page.getByLabel("Name", { exact: true }).fill("Picnic");
  await page.getByRole("button", { name: "Save" }).click();
  for (const title of ["Blanket", "Sandwiches"]) {
    await detail.getByLabel("New item").fill(title);
    await detail.getByRole("button", { name: "Add", exact: true }).click();
    await expect(detail.getByTestId("checklist-item").filter({ hasText: title })).toBeVisible();
  }
  await detail.getByRole("button", { name: "Save as template" }).click();
  await expect(detail.getByRole("status")).toContainText('Saved as the template "Picnic"');

  await page.goto("/settings/family");
  await expect(templatesIn(page).getByRole("link", { name: /^Picnic/ })).toContainText("2 items");
});

test("templates are edited, deleted and restored to their defaults", async ({ page }) => {
  await signIn(page);
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto("/settings/family");
  const templates = templatesIn(page);

  // Edit our own: rename, add, reorder and remove items.
  await templates.getByRole("link", { name: /^Picnic/ }).click();
  await page.getByLabel("Template name").fill("Beach picnic");
  await page.getByLabel("New item").fill("Umbrella");
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Move Umbrella up" }).click();
  await page.getByRole("button", { name: "Remove Blanket" }).click();
  await expect(page.getByTestId("template-items").getByRole("textbox")).toHaveCount(2);
  await expect(page.getByLabel("Item 1")).toHaveValue("Umbrella");
  await expect(page.getByLabel("Item 2")).toHaveValue("Sandwiches");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/settings\/family$/);
  await expect(templates.getByRole("link", { name: /^Beach picnic/ })).toContainText("2 items");

  // And delete it.
  await templates.getByRole("link", { name: /^Beach picnic/ }).click();
  await page.getByRole("button", { name: "Delete template" }).click();
  await expect(page).toHaveURL(/\/settings\/family$/);
  await expect(templates.getByRole("link", { name: /^Beach picnic/ })).toHaveCount(0);

  // Change one built-in template and delete another; Restore defaults brings both back.
  await templates.getByRole("link", { name: /^Shopping/ }).click();
  await page.getByLabel("Template name").fill("Groceries");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(templates.getByRole("link", { name: /^Groceries/ })).toBeVisible();
  await templates.getByRole("link", { name: /^Decluttering/ }).click();
  await page.getByRole("button", { name: "Delete template" }).click();
  await expect(templates.getByRole("link", { name: /^Decluttering/ })).toHaveCount(0);

  await templates.getByRole("button", { name: "Restore defaults" }).click();
  await expect(templates.getByRole("link", { name: /^Decluttering/ })).toBeVisible();
  await expect(templates.getByRole("link", { name: /^Shopping/ })).toBeVisible();
  await expect(templates.getByRole("link", { name: /^Groceries/ })).toHaveCount(0);
});
