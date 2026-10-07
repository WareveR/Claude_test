import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("built-in Entry Types translate until renamed, and custom ones can be added", async ({
  page,
}) => {
  await signIn(page);
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByRole("link", { name: "Appointment" })).toBeVisible();

  await page.getByRole("link", { name: "This device" }).click();
  await page.getByLabel("Language on this device").selectOption("pt-PT");
  await page.getByRole("link", { name: "Família" }).click();
  await expect(page.getByRole("link", { name: "Consulta" })).toBeVisible();
  await page.getByRole("link", { name: "Este dispositivo" }).click();
  await page.getByLabel("Idioma deste dispositivo").selectOption("en");
  await page.getByRole("link", { name: "Family", exact: true }).click();

  await page.getByRole("link", { name: "Holiday", exact: true }).click();
  await page.getByLabel("Name", { exact: true }).fill("Summer break");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("link", { name: "Summer break" })).toBeVisible();

  await page.getByRole("link", { name: "Add type" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Swimming");
  await page.getByLabel("trophy").dispatchEvent("click");
  await page.getByLabel("Repetition").selectOption("weekly");
  await page.getByLabel("1 hour before").check();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("link", { name: "Swimming" })).toBeVisible();

  await page.getByRole("link", { name: "Swimming" }).click();
  await expect(page.getByLabel("Repetition")).toHaveValue("weekly");
  await expect(page.getByLabel("1 hour before")).toBeChecked();
});
