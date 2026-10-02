import { expect, test } from "@playwright/test";

test.use({ locale: "en-GB" });

test("set up the Family, sign out and sign back in", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Setup code").fill("local-setup-code");
  await page.getByLabel("Family name").fill("Pires");
  await page.getByLabel("Family Password").fill("correct horse battery");
  await page.getByLabel("Recovery email").fill("david@example.com");
  await page.getByRole("button", { name: "Create" }).click();
  await expect(page.getByRole("heading", { name: "Pires" })).toBeVisible();

  await page.getByRole("button", { name: "Sign out on this device" }).click();
  await page.getByLabel("Family Password").fill("wrong password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toHaveText("Wrong password.");

  await page.getByLabel("Family Password").fill("correct horse battery");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("heading", { name: "Pires" })).toBeVisible();
});
