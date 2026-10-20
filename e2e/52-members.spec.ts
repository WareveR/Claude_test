import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("the Owner invites an adult, who shows as pending until they sign in", async ({ page }) => {
  await signIn(page);
  await page.goto("/settings/family");
  const form = page.getByRole("form", { name: "Invite an adult" });
  await form.getByLabel("Email").fill("carla@example.com");
  await form.getByLabel("Role").selectOption("admin");
  await form.getByRole("button", { name: "Send invite" }).click();
  await expect(form.getByRole("status")).toHaveText(
    "Invite sent to carla@example.com. It is valid for 7 days.",
  );
  const carla = page.getByTestId("member").filter({ hasText: "carla@example.com" });
  await expect(carla).toContainText("Invite pending");

  await carla.locator("summary").click();
  await carla.getByRole("button", { name: "Send the invite again" }).click();
  await expect(carla.getByRole("status")).toHaveText("We sent a link to carla@example.com.");

  page.once("dialog", (dialog) => dialog.accept());
  await carla.getByRole("button", { name: "Remove" }).click();
  await expect(carla).toHaveCount(0);
});

test("a used or unknown invite link is refused", async ({ page }) => {
  await page.goto("/invite?token=not-a-real-token");
  await page.getByLabel("Your password").fill("a long enough phrase");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(
    page.getByText("This invite is no longer valid. Ask whoever invited you for a new one."),
  ).toBeVisible();
});
