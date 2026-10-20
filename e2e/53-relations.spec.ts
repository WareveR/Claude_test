import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("a relation between two Persons links them in the family tree", async ({ page }) => {
  await signIn(page);
  for (const name of ["Sara Rel", "Carla Rel"]) {
    await page.goto("/settings/persons/new");
    await page.getByLabel("Name", { exact: true }).fill(name);
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/settings\/family$/);
  }
  await page.getByRole("link", { name: /Carla Rel/ }).click();
  const form = page.getByRole("form", { name: "Family relation" });
  await form.getByLabel("Carla Rel is").selectOption("sibling");
  await form.getByLabel("of", { exact: true }).selectOption({ label: "Sara Rel" });
  await form.getByRole("button", { name: "Save relation" }).click();
  await expect(form.getByRole("status")).toHaveText("They are now linked in the tree.");
  const tree = (await (await page.request.get("/api/relatives")).json()) as {
    name: string;
    parentIds: string[];
  }[];
  const [carla, sara] = ["Carla Rel", "Sara Rel"].map((n) => tree.find((r) => r.name === n)!);
  expect(carla.parentIds).toHaveLength(1);
  expect(sara.parentIds).toEqual(carla.parentIds);
});
