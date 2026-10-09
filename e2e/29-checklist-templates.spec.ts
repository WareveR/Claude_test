import { expect, test, type Page } from "@playwright/test";
import { openToEdit, signIn } from "./helpers";

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

/** Presses on one element and drags to another with the mouse, in small steps. */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + 15, from.y + 5, { steps: 3 });
  await page.mouse.move(to.x, to.y, { steps: 10 });
}

async function centre(locator: import("@playwright/test").Locator) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test("a Task dragged onto a Checklist moves in, and items swipe away with Undo", async ({
  page,
}) => {
  // Tall enough for the Task and the Checklist to be on screen together.
  await page.setViewportSize({ width: 1280, height: 1600 });
  await signIn(page);
  await page.goto("/tasks/new");
  await page.getByLabel("Title").fill("Pack the pencil case");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).not.toHaveURL(/\/tasks\/new$/);
  await page.goto("/tasks");

  const task = page.getByTestId("task").filter({ hasText: "Pack the pencil case" });
  const school = page.getByTestId("checklist").filter({ hasText: "Back to school" });
  await expect(school).toContainText("0 of 9");
  await drag(page, await centre(task.getByRole("link")), await centre(school));
  await expect(school).toHaveClass(/ring-2/);
  await page.mouse.up();

  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText('Add "Pack the pencil case" to "Back to school"?');
  await dialog.getByRole("button", { name: "Move" }).click();
  await expect(dialog).toHaveCount(0);
  await expect(task).toHaveCount(0);
  await expect(school).toContainText("0 of 10");

  // A plain click still opens the Checklist, through its preview.
  await openToEdit(page, school);
  const detail = page.getByTestId("checklist-detail");
  const items = detail.getByTestId("checklist-item");
  await expect(items.last()).toContainText("Pack the pencil case");

  // Swiping an item sideways removes it, with an Undo.
  const kit = items.filter({ hasText: "Sports kit" });
  const from = await centre(kit.getByText("Sports kit"));
  await drag(page, from, { x: from.x - 250, y: from.y });
  await page.mouse.up();
  await expect(kit).toHaveCount(0);
  await expect(detail).toContainText("0 of 9");
  await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
  await expect(kit).toBeVisible();
  await expect(detail).toContainText("0 of 10");

  await drag(page, from, { x: from.x + 250, y: from.y });
  await page.mouse.up();
  await expect(kit).toHaveCount(0);
  // Leaving the page deletes it for good.
  await page.goBack();
  await expect(school).toContainText("0 of 9");
});

test("a loose Task's form adds a copy of it to a Checklist", async ({ page }) => {
  await signIn(page);
  await page.goto("/tasks/new");
  await page.getByLabel("Title").fill("Buy glue sticks");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).not.toHaveURL(/\/tasks\/new$/);
  await page.goto("/tasks");
  await openToEdit(
    page,
    page.getByTestId("task").filter({ hasText: "Buy glue sticks" }).getByRole("link"),
  );
  await page.getByLabel("Which checklist").selectOption({ label: "Back to school" });
  await page.getByRole("button", { name: "Duplicate" }).click();
  await expect(page.getByRole("status")).toContainText('Added a copy to "Back to school"');
  await page.goto("/tasks");
  await expect(page.getByTestId("task").filter({ hasText: "Buy glue sticks" })).toBeVisible();
  await expect(page.getByTestId("checklist").filter({ hasText: "Back to school" })).toContainText(
    "0 of 10",
  );
});
