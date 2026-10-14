import { expect, test } from "@playwright/test";
import { signIn } from "./helpers";

test.use({ locale: "en-GB", timezoneId: "Europe/Lisbon" });

test("a theme picked in Settings recolours the app and stays after a reload", async ({ page }) => {
  await signIn(page);
  const html = page.locator("html");
  await expect(html).not.toHaveAttribute("data-theme");

  await page.goto("/settings/device");
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

test("the four themes for different ages each change the look, not only the colours", async ({
  page,
}) => {
  await signIn(page);
  const html = page.locator("html");
  const header = page.locator("header").first();
  const picker = page.getByLabel("Theme on this device");
  await page.goto("/settings/device");

  await picker.selectOption({ label: "Playground (bright, for children)" });
  await expect(html).toHaveAttribute("data-theme", "playground");
  await expect(header).toHaveCSS("background-color", "rgb(214, 51, 108)");
  await expect(picker).toHaveCSS("border-radius", "12px");

  await picker.selectOption({ label: "Neon (dark, for teenagers)" });
  await expect(html).toHaveAttribute("data-theme", "neon");
  await expect(header).toHaveCSS("color", "rgb(46, 242, 255)");
  await expect(picker).toHaveCSS("border-radius", "0px");

  await picker.selectOption({ label: "Paper (calm, serif)" });
  await expect(html).toHaveAttribute("data-theme", "paper");
  await expect(header).toHaveCSS("background-color", "rgb(250, 247, 240)");
  await expect(header).toHaveCSS("font-family", /Georgia|serif/);

  await picker.selectOption({ label: "High contrast (large text)" });
  await expect(html).toHaveAttribute("data-theme", "contrast");
  await expect(header).toHaveCSS("background-color", "rgb(0, 0, 0)");
  await expect(html).toHaveCSS("font-size", "18px");
  await expect(picker).toHaveCSS("border-top-width", "2px");

  await page.reload();
  await expect(html).toHaveAttribute("data-theme", "contrast");
});
