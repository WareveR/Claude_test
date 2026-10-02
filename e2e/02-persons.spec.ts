import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("add, edit and archive a Person", async ({ page }) => {
  await signIn(page);
  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("link", { name: "Add person" }).click();
  await page.getByLabel("Name", { exact: true }).fill("Ana Pires");
  await page.getByLabel("Date of birth (optional)").fill("2015-03-14");
  await page.getByLabel("Nicknames (optional)").fill("Aninhas, Di");
  await page.getByRole("button", { name: "Save" }).click();

  const ana = page.getByRole("link", { name: /Ana Pires/ });
  await expect(ana).toBeVisible();
  await expect(page.getByRole("img", { name: "Ana Pires" })).toHaveText("AP");

  await ana.click();
  await expect(page.getByLabel("Nicknames (optional)")).toHaveValue("Aninhas, Di");
  await page.getByRole("button", { name: "Archive" }).click();
  await expect(page.getByRole("link", { name: /Ana Pires archived/ })).toBeVisible();
});
