import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test("Settings areas have their own addresses and Sign out stays in view", async ({ page }) => {
  await signIn(page);
  await page.goto("/settings");
  await page.getByRole("link", { name: "Calendar", exact: true }).click();
  await expect(page).toHaveURL(/\/settings\/calendar$/);
  await expect(page.getByRole("heading", { name: "Weather" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign out" })).toBeInViewport();
});
