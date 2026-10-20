import { expect, test } from "@playwright/test";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("set up the Family, move between views, sign out and back in", async ({ page }) => {
  await page.goto("/");
  await page.getByLabel("Setup code").fill("local-setup-code");
  await page.getByLabel("Family name").fill("Pires");
  await page.getByLabel("Your email").fill("david@example.com");
  await page.getByLabel("Your password").fill("correct horse battery");
  await page.getByRole("button", { name: "Create" }).click();

  // The app opens on today's day view, with the clock in the header.
  await expect(page).toHaveURL(/\/day\/\d{4}-\d{2}-\d{2}$/);
  await expect(page.getByTestId("header-time")).toHaveText(/^\d{2}:\d{2}$/);

  await page.getByRole("link", { name: "Week" }).click();
  await expect(page).toHaveURL(/\/week\/\d{4}-\d{2}-\d{2}$/);
  await page.goto("/month/2026-10");
  await expect(page.getByRole("heading", { name: "October 2026" })).toBeVisible();
  await page.getByRole("link", { name: "Next" }).click();
  await expect(page).toHaveURL(/\/month\/2026-11$/);
  await page.goBack();
  await expect(page).toHaveURL(/\/month\/2026-10$/);

  await page.getByRole("link", { name: "Settings" }).click();
  await page.getByRole("link", { name: "This device" }).click();
  await page.getByLabel("Language on this device").selectOption("pt-PT");
  await expect(page.getByRole("heading", { name: "Definições" })).toBeVisible();
  await page.getByLabel("Idioma deste dispositivo").selectOption("en");

  await page.getByRole("button", { name: "Sign out on this device" }).click();
  await page.getByLabel("Email", { exact: true }).fill("David@Example.com");
  await page.getByLabel("Password", { exact: true }).fill("wrong password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByRole("alert")).toHaveText("Wrong email or password.");

  await page.getByLabel("Password", { exact: true }).fill("correct horse battery");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByTestId("header-time")).toBeVisible();

  // Signing in again keeps the page it was on: still in Settings.
  await page.getByRole("link", { name: "Account and security" }).click();
  const account = page.locator("section section", {
    has: page.getByRole("heading", { name: "Your account" }),
  });
  await expect(account).toContainText("david@example.com · Owner");
  page.on("dialog", (dialog) => dialog.accept());
  const passwordSection = page.locator("section section", {
    has: page.getByRole("heading", { name: "Change your password" }),
  });
  await passwordSection.getByLabel("Current password").fill("correct horse battery");
  await passwordSection.getByLabel("New password").fill("a brand new phrase");
  await passwordSection.getByRole("button", { name: "Change password" }).click();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();
});
