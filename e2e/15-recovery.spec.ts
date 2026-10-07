import { expect, test } from "@playwright/test";
import { PASSWORD, signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("Forgot password gives the same answer for any address", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Forgot password?" }).click();
  await page.getByLabel("Recovery email").fill("nobody@example.com");
  await page.getByRole("button", { name: "Send recovery link" }).click();
  await expect(page.getByRole("status")).toHaveText(
    "If that address is registered, a recovery link is on its way. Check your inbox.",
  );
});

test("a used or unknown recovery link is refused", async ({ page }) => {
  await page.goto("/recover?token=not-a-real-token");
  await page.getByLabel("New password").fill("a long enough phrase");
  await page.getByRole("button", { name: "Choose password" }).click();
  await expect(page.getByText("This link is no longer valid. Ask for a new one.")).toBeVisible();
});

test("changing the recovery email waits for the new address to confirm", async ({ page }) => {
  await signIn(page);
  await page.goto("/settings/account");
  const section = page.locator("section section", {
    has: page.getByRole("heading", { name: "Recovery email" }),
  });
  await section.getByLabel("Current password").fill(PASSWORD);
  await section.getByLabel("New recovery email").fill("family@example.com");
  await section.getByRole("button", { name: "Change recovery email" }).click();
  await expect(section).toContainText("We sent a confirmation link to family@example.com.");
});
