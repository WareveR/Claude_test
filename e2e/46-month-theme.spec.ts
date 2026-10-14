import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("the Month theme takes the colours and drawing of the month being looked at", async ({
  page,
}) => {
  await signIn(page);
  await page.goto("/settings/device");
  await page
    .getByLabel("Theme on this device")
    .selectOption({ label: "Month (changes with the month)" });
  const html = page.locator("html");
  await expect(html).toHaveAttribute("data-theme", "month");

  const header = page.locator("header");
  await page.goto("/month/2026-12");
  await expect(html).toHaveAttribute("data-month", "12");
  await expect(header).toHaveCSS("background-color", "rgb(155, 28, 44)");
  await expect(header.getByTestId("month-motif")).toBeAttached();

  // Moving to the next month changes the look with it.
  await page.getByRole("link", { name: "Next" }).click();
  await expect(html).toHaveAttribute("data-month", "1");
  await expect(header).toHaveCSS("background-color", "rgb(47, 93, 138)");

  // Another theme leaves nothing of the month behind.
  await page.goto("/settings/device");
  await page.getByLabel("Theme on this device").selectOption({ label: "Light" });
  await expect(html).not.toHaveAttribute("data-month");
  await expect(page.getByTestId("month-motif")).toHaveCount(0);
  await page
    .getByLabel("Theme on this device")
    .selectOption({ label: "Automatic (follows the device)" });
});
