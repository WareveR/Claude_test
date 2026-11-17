import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

const ORIGIN = { Origin: "http://localhost:4173" };

test("a Person's profile keeps sizes and allergies, and a Recipe warns about them", async ({
  page,
}) => {
  await signIn(page);
  const person = (await (
    await page.request.post("/api/persons", {
      headers: ORIGIN,
      data: { name: "Bia x60", color: "#c8e6c9", nicknames: [] },
    })
  ).json()) as { id: string };
  const recipe = (await (
    await page.request.post("/api/recipes", {
      headers: ORIGIN,
      data: {
        name: "Bolo x60",
        servings: 8,
        ingredients: [{ quantity: 100, unit: "g", name: "manteiga de amendoim", pantry: false }],
      },
    })
  ).json()) as { id: string };

  try {
    await page.goto(`/settings/persons/${person.id}`);
    await page.getByText("Profile", { exact: true }).click();
    await page.getByLabel("Shoe size").fill("34");
    await page.getByLabel("Allergies").fill("amendoim, ovo");
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page).toHaveURL(/\/settings\/family$/);

    await page.goto(`/settings/persons/${person.id}`);
    // A filled-in profile opens by itself.
    await expect(page.getByLabel("Shoe size")).toHaveValue("34");
    await expect(page.getByLabel("Allergies")).toHaveValue("amendoim, ovo");

    await page.goto(`/recipes/${recipe.id}`);
    await expect(page.getByTestId("allergy-warnings")).toContainText(
      "Bia x60: amendoim (manteiga de amendoim)",
    );
  } finally {
    await page.request.delete(`/api/recipes/${recipe.id}`, { headers: ORIGIN });
    await page.request.delete(`/api/persons/${person.id}`, { headers: ORIGIN });
  }
});

test("an animal's page keeps its chip and food and puts the food on the shopping list", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/settings/persons/new");
  await page.getByRole("radio", { name: "Animal" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Bolinhas x60");
  await page.getByText("Profile", { exact: true }).click();
  await page.getByLabel("Species").fill("Cão");
  await page.getByLabel("Food").fill("Ração x60");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/settings\/family$/);

  const persons = (await (await page.request.get("/api/persons")).json()) as {
    id: string;
    name: string;
    kind: string;
  }[];
  const bolinhas = persons.find((p) => p.name === "Bolinhas x60")!;
  expect(bolinhas.kind).toBe("animal");
  try {
    await page.goto(`/settings/persons/${bolinhas.id}`);
    await page.getByRole("button", { name: 'Put "Ração x60" on the shopping list' }).click();
    await expect(page.getByRole("button", { name: "On the shopping list" })).toBeDisabled();
    const items = (await (await page.request.get("/api/shopping/items")).json()) as {
      id: string;
      name: string;
    }[];
    const food = items.find((i) => i.name === "Ração x60");
    expect(food).toBeDefined();
    await page.request.delete(`/api/shopping/items/${food!.id}`, { headers: ORIGIN });
  } finally {
    await page.request.delete(`/api/persons/${bolinhas.id}`, { headers: ORIGIN });
  }
});
