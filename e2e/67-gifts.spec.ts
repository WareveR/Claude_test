import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

const ORIGIN = { Origin: "http://localhost:4173" };

test("gift ideas for a Person are noted on their page, ticked given and listed for Christmas", async ({
  page,
}) => {
  await signIn(page);
  const bia = (
    (await (
      await page.request.post("/api/persons", {
        headers: ORIGIN,
        data: { name: "Bia x67", color: "#c8e6c9", nicknames: [] },
      })
    ).json()) as { id: string }
  ).id;
  try {
    await page.goto(`/settings/persons/${bia}`);
    const section = page.getByTestId("person-gifts");
    await section.getByLabel("Gift idea").fill("Lego x67");
    await section.getByLabel("For when").selectOption("christmas");
    await section.getByRole("button", { name: "Add idea" }).click();
    await expect(section.getByTestId("gift")).toHaveCount(1);
    await expect(section.getByLabel("Gift idea")).toHaveValue("");
    await section.getByLabel("Gift idea").fill("Book x67");
    await section.getByRole("button", { name: "Add idea" }).click();
    await expect(section.getByTestId("gift")).toHaveCount(2);
    await section.getByRole("checkbox", { name: "Book x67 given" }).click();
    await expect(section.getByRole("checkbox", { name: "Book x67 given" })).toBeChecked();

    await page.goto("/settings/family");
    const christmas = page.getByTestId("christmas-gifts");
    await christmas.getByRole("button", { name: "See ideas for 1 Person" }).click();
    await expect(christmas).toContainText("Lego x67");
    await expect(christmas).not.toContainText("Book x67");
  } finally {
    await page.request.delete(`/api/persons/${bia}`, { headers: ORIGIN });
  }
});
