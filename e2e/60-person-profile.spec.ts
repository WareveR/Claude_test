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
