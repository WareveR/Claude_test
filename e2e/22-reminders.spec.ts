import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("a device chooses its Reminders and the choice persists", async ({ page }) => {
  await signIn(page);
  await page.goto("/settings");
  const section = page.locator("section", {
    has: page.getByRole("heading", { name: "Reminders" }),
  });
  await expect(section.getByRole("button", { name: "Allow notifications" })).toBeVisible();

  const on = section.getByRole("checkbox", { name: "Reminders on" });
  await expect(on).toBeChecked();
  await on.click();
  await expect(on).not.toBeChecked();
  await on.click();
  await expect(on).toBeChecked();

  await expect(section.getByRole("checkbox", { name: "Everyone" })).toBeChecked();
  await section.getByRole("checkbox", { name: "Everyone" }).click();
  const caio = section.getByRole("checkbox", { name: "Caio" });
  await caio.click();
  await expect(caio).not.toBeChecked();
  await caio.click();
  await expect(caio).toBeChecked();
  await expect(section.getByRole("checkbox", { name: "Everyone" })).not.toBeChecked();

  await page.reload();
  await expect(section.getByRole("checkbox", { name: "Everyone" })).not.toBeChecked();
  await expect(section.getByRole("checkbox", { name: "Caio" })).toBeChecked();
  await expect(section.getByRole("button", { name: "Allow notifications" })).toBeVisible();

  await section.getByRole("checkbox", { name: "Reminders on" }).click();
  await page.reload();
  await expect(section.getByRole("checkbox", { name: "Reminders on" })).not.toBeChecked();
  await section.getByRole("checkbox", { name: "Reminders on" }).click();
});
