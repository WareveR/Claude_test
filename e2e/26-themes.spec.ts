import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("a theme picked in Settings recolours the app and stays after a reload", async ({ page }) => {
  await signIn(page);
  const html = page.locator("html");
  await expect(html).not.toHaveAttribute("data-theme");

  await page.goto("/settings");
  await page.getByLabel("Theme on this device").selectOption({ label: "Spring" });
  await expect(html).toHaveAttribute("data-theme", "spring");
  const header = page.locator("header");
  await expect(header).toHaveCSS("background-color", "rgb(103, 65, 217)");

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "spring");

  await page
    .getByLabel("Theme on this device")
    .selectOption({ label: "Automatic (follows the device)" });
  await expect(html).not.toHaveAttribute("data-theme");
});
