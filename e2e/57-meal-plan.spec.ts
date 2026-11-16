import { expect, test, type Page } from "@playwright/test";
import { lisbonDate, openView, signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

const ORIGIN = { Origin: "http://localhost:4173" };
// The database is shared by every spec: this spec's recipes all end in this mark.
const MARK = "x57";

async function cleanUp(page: Page) {
  const today = lisbonDate(0);
  for (const slot of ["lunch", "dinner"]) {
    await page.request.delete(`/api/meals/${today}/${slot}`, { headers: ORIGIN });
  }
  const recipes = (await (await page.request.get("/api/recipes")).json()) as {
    id: string;
    name: string;
  }[];
  for (const recipe of recipes.filter((r) => r.name.endsWith(MARK))) {
    await page.request.delete(`/api/recipes/${recipe.id}`, { headers: ORIGIN });
  }
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await cleanUp(page);
});

test.afterEach(async ({ page }) => {
  await cleanUp(page);
});

test("the meal plan sets a recipe for dinner and free text for lunch, shows them in the Day view and removes one", async ({
  page,
}) => {
  const today = lisbonDate(0);
  const name = `Bacalhau à Brás ${MARK}`;
  const created = await page.request.post("/api/recipes", {
    headers: ORIGIN,
    data: { name, servings: 6 },
  });
  expect(created.ok()).toBe(true);
  const recipe = (await created.json()) as { id: string };

  // From the Recipe Book, the switch opens this week's plan; the Recipes icon stays active.
  await openView(page, "Recipes");
  await expect(
    page.getByTestId("plan-switch").getByRole("link", { name: "Recipes" }),
  ).toHaveAttribute("aria-current", "page");
  await page.getByTestId("plan-switch").getByRole("link", { name: "Meal plan" }).click();
  await expect(page).toHaveURL(new RegExp(`/meals/${today}$`));
  await expect(page.getByRole("heading", { name: /^Week \d+, \d{4}$/ })).toBeVisible();
  await expect(
    page.locator("nav[data-view-nav]").getByRole("link", { name: "Recipes" }),
  ).toHaveClass(/bg-accent/);
  await expect(page.getByTestId("meal-plan").locator("[data-testid^='meal-day-']")).toHaveCount(7);
  const day = page.getByTestId(`meal-day-${today}`);
  await expect(day).toHaveAttribute("data-today", "true");
  await expect(day.getByTestId("meal-slot-dinner")).toContainText("Add");

  // Dinner: a recipe from the book, never planned, with its own servings.
  await day.getByTestId("meal-slot-dinner").getByRole("button").first().click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("searchbox", { name: "Search recipes" }).fill(MARK);
  const row = dialog.getByRole("button", { name: new RegExp(name) });
  await expect(row).toContainText("Never planned");
  await row.click();
  await expect(dialog.getByText("6 servings")).toBeVisible();
  await dialog.getByRole("button", { name: "Fewer servings" }).click();
  const saved = page.waitForResponse(
    (r) => r.url().includes(`/api/meals/${today}/dinner`) && r.request().method() === "PUT",
  );
  await dialog.getByRole("button", { name: "Save" }).click();
  expect((await saved).ok()).toBe(true);
  await expect(dialog).toHaveCount(0);
  const dinner = day.getByTestId("meal-slot-dinner");
  await expect(dinner).toContainText(name);
  await expect(dinner).toContainText("5 servings");
  await expect(dinner.getByRole("link", { name: `Open the recipe ${name}` })).toHaveAttribute(
    "href",
    `/recipes/${recipe.id}`,
  );

  // Lunch: free text from a quick chip.
  await day.getByTestId("meal-slot-lunch").getByRole("button").first().click();
  await dialog.getByRole("button", { name: "Leftovers" }).click();
  await expect(dialog.getByLabel("Or write what is planned")).toHaveValue("Leftovers");
  const lunchSaved = page.waitForResponse(
    (r) => r.url().includes(`/api/meals/${today}/lunch`) && r.request().method() === "PUT",
  );
  await dialog.getByRole("button", { name: "Save" }).click();
  expect((await lunchSaved).ok()).toBe(true);
  await expect(day.getByTestId("meal-slot-lunch")).toContainText("Leftovers");

  // The Day view carries one discreet line, which opens the plan.
  await page.goto(`/day/${today}`);
  const line = page.getByTestId(`meals-line-${today}`);
  await expect(line).toHaveText(`Lunch: Leftovers · Dinner: ${name}`);
  await line.click();
  await expect(page).toHaveURL(new RegExp(`/meals/${today}$`));

  // A recipe planned already says when it was last; removing a meal empties its slot.
  await day.getByTestId("meal-slot-dinner").getByRole("button").first().click();
  const removed = page.waitForResponse(
    (r) => r.url().includes(`/api/meals/${today}/dinner`) && r.request().method() === "DELETE",
  );
  await page.getByRole("button", { name: "Remove" }).click();
  expect((await removed).ok()).toBe(true);
  await expect(day.getByTestId("meal-slot-dinner")).toContainText("Add");
  await expect(day.getByTestId("meal-slot-lunch")).toContainText("Leftovers");
  await page.goto(`/day/${today}`);
  await expect(page.getByTestId(`meals-line-${today}`)).toHaveText("Lunch: Leftovers");

  // The line is gone when the day has no meals.
  await page.request.delete(`/api/meals/${today}/lunch`, { headers: ORIGIN });
  await page.reload();
  await expect(page.getByTestId("day-title")).toBeVisible();
  await expect(page.getByTestId(`meals-line-${today}`)).toHaveCount(0);
});

test("a recipe deleted leaves its meal reading the same, and the plan moves by week", async ({
  page,
}) => {
  const today = lisbonDate(0);
  const name = `Sopa ${MARK}`;
  const created = await page.request.post("/api/recipes", { headers: ORIGIN, data: { name } });
  const recipe = (await created.json()) as { id: string };
  const put = await page.request.put(`/api/meals/${today}/dinner`, {
    headers: ORIGIN,
    data: { recipeId: recipe.id, text: "", servings: null },
  });
  expect(put.ok()).toBe(true);
  await page.request.delete(`/api/recipes/${recipe.id}`, { headers: ORIGIN });

  await page.goto(`/meals/${today}`);
  const dinner = page.getByTestId(`meal-day-${today}`).getByTestId("meal-slot-dinner");
  await expect(dinner).toContainText(name);
  await expect(dinner.getByRole("link")).toHaveCount(0);

  // Next week shows no such meal; Previous comes back.
  await page.getByRole("link", { name: "Next" }).click();
  await expect(page.getByTestId("meal-plan")).not.toContainText(name);
  await page.getByRole("link", { name: "Previous" }).click();
  await expect(page.getByTestId("meal-plan")).toContainText(name);
});
