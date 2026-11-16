import { expect, test, type Page } from "@playwright/test";
import { openView, signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

const ORIGIN = { Origin: "http://localhost:4173" };
// The database is shared by every spec: this spec's recipes all end in this mark.
const MARK = "x56";

async function cleanUp(page: Page) {
  const recipes = (await (await page.request.get("/api/recipes")).json()) as {
    id: string;
    name: string;
  }[];
  for (const recipe of recipes.filter((r) => r.name.endsWith(MARK))) {
    await page.request.delete(`/api/recipes/${recipe.id}`, { headers: ORIGIN });
  }
}

test.afterEach(async ({ page }) => {
  await cleanUp(page);
});

test("the Recipe Book adds a recipe, finds it by an ingredient, scales it, favours it and deletes it", async ({
  page,
}) => {
  await signIn(page);
  await openView(page, "Recipes");
  await expect(page).toHaveURL(/\/recipes$/);
  await expect(page.getByRole("heading", { name: "Recipe book" })).toBeVisible();

  await page.getByRole("link", { name: "New recipe" }).click();
  await expect(page).toHaveURL(/\/recipes\/new$/);
  await page.getByLabel("Name", { exact: true }).fill(`Sopa de grão ${MARK}`);
  await page.getByLabel("Time (min)").fill("40");
  await page.getByText("Soup", { exact: true }).click();

  // An ingredient is read from a line: quantity, unit and name; staples start as pantry.
  const box = page.getByLabel("Add an ingredient").first();
  await box.fill("400 g grão");
  await box.press("Enter");
  await box.fill("q.b. sal");
  await box.press("Enter");
  const rows = page.getByTestId("ingredient-row");
  await expect(rows).toHaveCount(2);
  await expect(rows.nth(0).getByRole("textbox")).toHaveValue("400 g grão");
  await expect(page.getByRole("checkbox", { name: "sal: pantry" })).toBeChecked();
  await expect(page.getByRole("checkbox", { name: "grão: pantry" })).not.toBeChecked();

  await page.getByLabel("Method").fill("Demolhar o grão\nCozer\nTemperar");
  await page.getByLabel("Source").fill("https://example.com/sopa");
  const saved = page.waitForResponse(
    (r) => r.url().endsWith("/api/recipes") && r.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Save" }).click();
  expect((await saved).ok()).toBe(true);
  await expect(page).toHaveURL(/\/recipes\/[^/]+$/);

  // Back in the list, found by an ingredient, accents and case aside.
  await openView(page, "Recipes");
  const card = page.getByTestId("recipe-card").filter({ hasText: `Sopa de grão ${MARK}` });
  await expect(card).toBeVisible();
  await expect(card).toContainText("40 min");
  await expect(card).toContainText("Soup");
  const search = page.getByRole("searchbox", { name: "Search recipes" });
  await search.fill("GRAO");
  await expect(card).toBeVisible();
  await search.fill("couve");
  await expect(card).toHaveCount(0);
  await search.fill("");
  await page.getByRole("group", { name: "Tags" }).getByRole("button", { name: "Soup" }).click();
  await expect(card).toBeVisible();

  // The recipe: quantities scale with the servings shown, the pantry ones muted.
  await card.click();
  await expect(page.getByRole("heading", { name: `Sopa de grão ${MARK}` })).toBeVisible();
  const ingredients = page.getByTestId("recipe-ingredient");
  await expect(ingredients.first()).toContainText("400 g grão");
  await expect(ingredients.nth(1)).toContainText("Pantry");
  await expect(page.getByText("4 servings")).toBeVisible();
  await page.getByRole("button", { name: "More servings" }).click();
  await page.getByRole("button", { name: "More servings" }).click();
  await expect(page.getByText("6 servings")).toBeVisible();
  await expect(ingredients.first()).toContainText("600 g grão");
  await expect(page.getByRole("listitem").filter({ hasText: "Cozer" })).toBeVisible();
  await expect(page.getByRole("link", { name: "https://example.com/sopa" })).toBeVisible();

  // Favourite, kept on the server.
  const favourited = page.waitForResponse(
    (r) => r.url().includes("/api/recipes/") && r.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "Favourite" }).click();
  expect((await favourited).ok()).toBe(true);
  await page.reload();
  await expect(page.getByRole("button", { name: "Remove from favourites" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );

  // Deleting asks first.
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: "Delete" }).click();
  await expect(page).toHaveURL(/\/recipes$/);
  await expect(page.getByTestId("recipe-card").filter({ hasText: MARK })).toHaveCount(0);
});
