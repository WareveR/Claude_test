import { expect, test, type Page } from "@playwright/test";
import { lisbonDate, signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

const ORIGIN = { Origin: "http://localhost:4173" };
// The database is shared by every spec: this spec's recipes and shopping items all end in this mark.
const MARK = "x58";

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
  const items = (await (await page.request.get("/api/shopping/items")).json()) as {
    id: string;
    name: string;
  }[];
  for (const item of items.filter((i) => i.name.endsWith(MARK))) {
    await page.request.delete(`/api/shopping/items/${item.id}`, { headers: ORIGIN });
  }
}

test.beforeEach(async ({ page }) => {
  await signIn(page);
  await cleanUp(page);
});

test.afterEach(async ({ page }) => {
  await cleanUp(page);
});

async function plan(page: Page, today: string, slot: string, name: string, lines: string[]) {
  const created = await page.request.post("/api/recipes", {
    headers: ORIGIN,
    data: {
      name,
      servings: 4,
      ingredients: lines.map((line) => {
        const [quantity, unit, ...rest] = line.split(" ");
        return /^\d/.test(quantity)
          ? { quantity: Number(quantity), unit, name: rest.join(" "), pantry: false }
          : {
              quantity: null,
              unit: "",
              name: line.replace(/^q\.b\. /, ""),
              pantry: /sal/.test(line),
            };
      }),
    },
  });
  expect(created.ok()).toBe(true);
  const recipe = (await created.json()) as { id: string };
  const put = await page.request.put(`/api/meals/${today}/${slot}`, {
    headers: ORIGIN,
    data: { recipeId: recipe.id, text: "", servings: null },
  });
  expect(put.ok()).toBe(true);
}

test("the meal plan adds the week's ingredients to the shopping list, summed, and undoes it", async ({
  page,
}) => {
  const today = lisbonDate(0);
  const fish = `Bacalhau à Brás ${MARK}`;
  const soup = `Sopa de grão ${MARK}`;
  await plan(page, today, "lunch", fish, [
    `400 g bacalhau ${MARK}`,
    `200 g cebola ${MARK}`,
    `q.b. sal ${MARK}`,
  ]);
  await plan(page, today, "dinner", soup, [`200 g cebola ${MARK}`, `1 lata grão ${MARK}`]);

  await page.goto(`/meals/${today}`);
  await page.getByTestId("meal-shopping-button").click();
  const sheet = page.getByTestId("meal-shopping-dialog");
  await expect(sheet.getByRole("heading").first()).toContainText("Shopping for");

  // The two onions are one line; the staple waits in the Pantry, unticked.
  const onion = sheet.getByRole("listitem").filter({ hasText: `cebola ${MARK}` });
  await expect(onion).toContainText("400 g");
  await expect(onion).toContainText(`${fish}, ${soup}`);
  await expect(onion.getByRole("checkbox")).toBeChecked();
  const salt = sheet.getByRole("listitem").filter({ hasText: `sal ${MARK}` });
  await expect(salt.getByRole("checkbox")).not.toBeChecked();
  await expect(sheet.getByRole("heading", { name: "Pantry" })).toBeVisible();
  await expect(sheet.getByRole("button", { name: "Add 3" })).toBeVisible();

  await sheet.getByRole("button", { name: "Add 3" }).click();
  await expect(sheet).toHaveCount(0);
  const toast = page.getByRole("status");
  await expect(toast).toContainText("Added to the shopping list");

  // The list has the onion once, with the sum and both recipes; the salt was left out.
  await toast.getByRole("link", { name: "Open shopping list" }).click();
  await expect(page).toHaveURL(/\/shopping$/);
  const item = page.getByTestId("shopping-item").filter({ hasText: `cebola ${MARK}` });
  await expect(item).toHaveCount(1);
  await expect(item).toContainText("400 g");
  await expect(item).toContainText(`${fish}, ${soup}`);
  await expect(page.getByTestId("shopping-item").filter({ hasText: `sal ${MARK}` })).toHaveCount(0);

  // Adding again merges into the open items instead of repeating them.
  await page.goto(`/meals/${today}`);
  await page.getByTestId("meal-shopping-button").click();
  await expect(sheet.getByTestId("meal-shopping-existing").first()).toContainText(
    "already on the list",
  );
  await sheet.getByRole("button", { name: "Add 3" }).click();
  await expect(sheet).toHaveCount(0);
  await page.getByRole("status").getByRole("link", { name: "Open shopping list" }).click();
  await expect(item).toHaveCount(1);
  await expect(item).toContainText("800 g");
  await expect(item).toContainText(`${fish}, ${soup}`);

  // Undo puts the first quantity back.
  await page.goto(`/meals/${today}`);
  await page.getByTestId("meal-shopping-button").click();
  await expect(sheet.getByTestId("meal-shopping-existing").first()).toContainText(
    "already on the list",
  );
  await sheet.getByRole("button", { name: "Add 3" }).click();
  await page.getByRole("status").getByRole("button", { name: "Undo" }).click();
  await expect(page.getByRole("status")).toContainText("Undone");
  await page.goto("/shopping");
  await expect(item).toContainText("800 g");
});

test("the button is disabled when the week has no recipe meals", async ({ page }) => {
  await page.goto(`/meals/${lisbonDate(0)}`);
  await expect(page.getByTestId("meal-plan")).toBeVisible();
  await expect(page.getByTestId("meal-shopping-button")).toBeDisabled();
});
